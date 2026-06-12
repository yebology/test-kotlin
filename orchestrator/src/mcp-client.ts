/**
 * Persistent MCP Client — maintains a long-running connection to mobile-mcp.
 * Uses JSON-RPC 2.0 over stdio (stdin/stdout) to communicate.
 *
 * Fixes gap #2: One persistent connection per device instead of one-shot spawns.
 */

import { execa, type ResultPromise } from 'execa';
import { EventEmitter } from 'node:events';

/** JSON-RPC 2.0 request */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 response */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Persistent MCP client that maintains a stdio connection to mobile-mcp server.
 * One instance per device/emulator.
 */
export class McpClient extends EventEmitter {
  private process: ResultPromise | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private buffer = '';
  private initialized = false;
  private deviceId: string;

  constructor(deviceId: string) {
    super();
    this.deviceId = deviceId;
  }

  /**
   * Starts the mobile-mcp server process and performs MCP initialization handshake.
   */
  async connect(): Promise<void> {
    const androidHome = process.env.ANDROID_HOME || '/Users/yobel/Library/Android/sdk';

    this.process = execa('npx', ['-y', '@mobilenext/mobile-mcp@latest'], {
      env: { ...process.env, ANDROID_HOME: androidHome },
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Handle stdout (JSON-RPC responses)
    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (chunk: Buffer) => {
      // Log errors but don't crash
      const msg = chunk.toString().trim();
      if (msg) this.emit('error', msg);
    });

    this.process.on('exit', (code) => {
      this.initialized = false;
      this.emit('disconnect', code);
      // Reject all pending requests
      for (const [, pending] of this.pendingRequests) {
        pending.reject(new Error(`MCP process exited with code ${code}`));
      }
      this.pendingRequests.clear();
    });

    // MCP initialization handshake
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'e2e-orchestrator', version: '1.0.0' },
    });

    // Send initialized notification
    this.sendNotification('notifications/initialized', {});
    this.initialized = true;
  }

  /**
   * Calls an MCP tool and returns the result.
   *
   * @param toolName - Name of the tool to call
   * @param args - Tool arguments
   * @returns Tool result content as string
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized. Call connect() first.');
    }

    const result = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args,
    }) as { content?: Array<{ type: string; text?: string }> };

    if (result?.content) {
      return result.content
        .map((c) => c.text || JSON.stringify(c))
        .join('\n');
    }

    return JSON.stringify(result);
  }

  /**
   * Disconnects the MCP client and kills the server process.
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.initialized = false;
    this.pendingRequests.clear();
  }

  /** Whether the client is connected and initialized */
  get isConnected(): boolean {
    return this.initialized;
  }

  /**
   * Sends a JSON-RPC request and waits for the response.
   */
  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request) + '\n';
      this.process?.stdin?.write(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${method} timed out after 30s`));
        }
      }, 30_000);
    });
  }

  /**
   * Sends a JSON-RPC notification (no response expected).
   */
  private sendNotification(method: string, params?: Record<string, unknown>): void {
    const message = JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n';
    this.process?.stdin?.write(message);
  }

  /**
   * Processes buffered stdout data, extracting complete JSON-RPC messages.
   */
  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const response = JSON.parse(trimmed) as JsonRpcResponse;

        if (response.id !== undefined && this.pendingRequests.has(response.id)) {
          const pending = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(`MCP error: ${response.error.message}`));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // Not valid JSON — might be a log line, ignore
      }
    }
  }
}

/**
 * Manages multiple MCP clients — one per device.
 */
export class McpClientPool {
  private clients = new Map<string, McpClient>();

  /**
   * Gets or creates a persistent MCP client for a device.
   *
   * @param deviceId - Device identifier
   * @returns Connected MCP client
   */
  async getClient(deviceId: string): Promise<McpClient> {
    if (this.clients.has(deviceId) && this.clients.get(deviceId)!.isConnected) {
      return this.clients.get(deviceId)!;
    }

    const client = new McpClient(deviceId);
    await client.connect();
    this.clients.set(deviceId, client);
    return client;
  }

  /**
   * Disconnects all clients and cleans up.
   */
  async disconnectAll(): Promise<void> {
    for (const [, client] of this.clients) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}
