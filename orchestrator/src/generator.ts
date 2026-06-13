/**
 * Test Script Generator — uses kiro-cli headless mode with hook prompts.
 * Reads the EXACT prompt from .kiro/hooks/ files and passes to kiro-cli.
 * This guarantees identical behavior to clicking the hook in Kiro IDE.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import type { OrchestratorConfig, GenerateSource } from './types.js';

export type { GenerateSource };

/** Available kiro-cli models for user selection */
export const KIRO_MODELS = [
  { id: 'auto', label: 'Auto (recommended)', hint: 'routes optimally, 1.0x cost' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', hint: 'near-opus intelligence, 1.3x cost' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', hint: 'strongest coder, 2.2x cost' },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', hint: 'fast & cheap, 0.4x cost' },
  { id: 'minimax-m2.5', label: 'MiniMax M2.5', hint: 'near-opus at 0.25x cost' },
  { id: 'qwen3-coder-next', label: 'Qwen3 Coder Next', hint: 'cheapest, 0.05x cost' },
];

/** Hook file paths relative to project root */
const HOOK_FILES: Record<GenerateSource, string> = {
  codebase: '.kiro/hooks/generate-tests-codebase.kiro.hook',
  requirements: '.kiro/hooks/generate-tests-requirements.kiro.hook',
  excel: '.kiro/hooks/generate-tests-excel.kiro.hook',
};

/**
 * Runs test generation via kiro-cli using the EXACT hook prompt.
 * Reads the hook file → extracts prompt → passes to kiro-cli headless.
 * Result is identical to clicking the hook in Kiro IDE.
 */
export async function runGenerator(
  config: OrchestratorConfig,
  source: GenerateSource,
  modelId: string,
  _platform?: 'android' | 'ios',
  onProgress?: (message: string) => void
): Promise<string> {
  // Read the hook file to get the exact prompt
  const hookPath = path.join(config.projectRoot, HOOK_FILES[source]);

  if (!fs.existsSync(hookPath)) {
    // Fallback: check in the original project root (before repo clone override)
    const fallbackRoot = path.resolve(process.cwd(), '..');
    const fallbackHookPath = path.join(fallbackRoot, HOOK_FILES[source]);

    if (!fs.existsSync(fallbackHookPath)) {
      throw new Error(`Hook file not found: ${hookPath}\nMake sure .kiro/hooks/ exists in project root.`);
    }

    return runWithHook(fallbackHookPath, config.projectRoot, modelId, onProgress);
  }

  return runWithHook(hookPath, config.projectRoot, modelId, onProgress);
}

/**
 * Reads hook file, extracts prompt, runs kiro-cli.
 */
async function runWithHook(
  hookPath: string,
  cwd: string,
  modelId: string,
  onProgress?: (message: string) => void
): Promise<string> {
  // Parse hook JSON to extract prompt
  const hookContent = fs.readFileSync(hookPath, 'utf-8');
  const hook = JSON.parse(hookContent) as { then?: { prompt?: string } };
  const prompt = hook?.then?.prompt;

  if (!prompt) {
    throw new Error(`No prompt found in hook file: ${hookPath}`);
  }

  // Set model
  onProgress?.(`Setting model: ${modelId}...`);
  await execa('kiro-cli', ['settings', 'chat.defaultModel', modelId], { reject: false });

  onProgress?.('Launching kiro-cli (headless, using hook prompt)...');

  // Run kiro-cli with the exact hook prompt
  const result = await execa('kiro-cli', [
    'chat',
    '--no-interactive',
    '--trust-all-tools',
    prompt,
  ], {
    cwd,
    timeout: 15 * 60 * 1000, // 15 min (comprehensive generation takes time)
    reject: false,
  });

  if (result.exitCode !== 0) {
    const errMsg = result.stderr || result.stdout || 'Unknown error';
    if (errMsg.includes('No such file or directory')) {
      throw new Error('kiro-cli not properly initialized. Run: kiro-cli doctor');
    }
    if (errMsg.includes('auth') || errMsg.includes('login')) {
      throw new Error('kiro-cli not authenticated. Run: kiro-cli login --license pro');
    }
    throw new Error(`kiro-cli failed (exit ${result.exitCode}): ${errMsg.slice(0, 500)}`);
  }

  onProgress?.('Generation complete.');
  return result.stdout?.slice(-1000) || 'Done. Check e2e-tests/ folder.';
}
