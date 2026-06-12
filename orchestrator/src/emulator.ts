/**
 * Android emulator management.
 * Handles starting, stopping, and querying emulator instances.
 */

import { execaCommand, execa } from 'execa';
import type { Emulator } from './types.js';

/** Base port for emulators — increments by 2 per instance */
const BASE_PORT = 5554;

/** Max wait time for emulator boot (ms) */
const BOOT_TIMEOUT_MS = 120_000;

/** Poll interval for boot check (ms) */
const BOOT_POLL_INTERVAL_MS = 3000;

/**
 * Lists currently running emulators via `adb devices`.
 * @returns Array of active emulator device IDs
 */
export async function listRunningEmulators(): Promise<Emulator[]> {
  const { stdout } = await execaCommand('adb devices');
  const lines = stdout.split('\n').slice(1); // skip header

  const emulators: Emulator[] = [];

  for (const line of lines) {
    const match = line.match(/^(emulator-(\d+))\s+(device|offline)/);
    if (match) {
      emulators.push({
        id: match[1],
        port: parseInt(match[2], 10),
        name: match[1],
        status: match[3] === 'device' ? 'ready' : 'booting',
      });
    }
  }

  return emulators;
}

/**
 * Lists available AVDs (Android Virtual Devices) configured on the system.
 * @returns Array of AVD names
 */
export async function listAvailableAvds(): Promise<string[]> {
  const { stdout } = await execaCommand('emulator -list-avds');
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Starts an emulator with a specific AVD name.
 * Does not wait for boot — use waitForBoot() after.
 *
 * @param avdName - Name of the AVD to launch
 * @param port - Port to use (determines device ID as emulator-{port})
 * @returns The spawned emulator info
 */
export async function startEmulator(avdName: string, port: number): Promise<Emulator> {
  // Start emulator in background (detached)
  const process = execa('emulator', ['-avd', avdName, '-port', String(port), '-no-snapshot-save', '-no-audio'], {
    detached: true,
    stdio: 'ignore',
  });

  // Unref so orchestrator can exit without waiting
  process.unref();

  return {
    id: `emulator-${port}`,
    port,
    name: avdName,
    status: 'booting',
  };
}

/**
 * Waits for an emulator to fully boot.
 * Polls `adb -s <device> shell getprop sys.boot_completed` until it returns "1".
 *
 * @param deviceId - Device identifier (e.g., "emulator-5554")
 * @param timeoutMs - Max time to wait
 * @returns true if booted, false if timed out
 */
export async function waitForBoot(deviceId: string, timeoutMs = BOOT_TIMEOUT_MS): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const { stdout } = await execa('adb', ['-s', deviceId, 'shell', 'getprop', 'sys.boot_completed']);
      if (stdout.trim() === '1') {
        return true;
      }
    } catch {
      // Device not ready yet, keep polling
    }

    await sleep(BOOT_POLL_INTERVAL_MS);
  }

  return false;
}

/**
 * Installs an APK on a specific emulator.
 *
 * @param deviceId - Target device
 * @param apkPath - Absolute path to APK file
 */
export async function installApk(deviceId: string, apkPath: string): Promise<void> {
  await execa('adb', ['-s', deviceId, 'install', '-r', apkPath]);
}

/**
 * Stops a specific emulator.
 *
 * @param deviceId - Device to stop
 */
export async function stopEmulator(deviceId: string): Promise<void> {
  try {
    await execa('adb', ['-s', deviceId, 'emu', 'kill']);
  } catch {
    // Emulator may already be stopped
  }
}

/**
 * Starts N emulators using available AVDs.
 * Assigns ports starting from BASE_PORT.
 *
 * @param count - Number of emulators to start
 * @returns Array of started emulators
 */
export async function startMultipleEmulators(count: number): Promise<Emulator[]> {
  const avds = await listAvailableAvds();
  if (avds.length === 0) {
    throw new Error('No AVDs found. Create AVDs with Android Studio AVD Manager first.');
  }

  // Check what's already running
  const running = await listRunningEmulators();
  const usedPorts = new Set(running.map((e) => e.port));

  const emulators: Emulator[] = [];
  let nextPort = BASE_PORT;

  // Reuse already running emulators first
  for (const emu of running) {
    if (emulators.length >= count) break;
    if (emu.status === 'ready') {
      emulators.push(emu);
    }
  }

  // Start additional if needed
  const needed = count - emulators.length;
  for (let i = 0; i < needed; i++) {
    // Find next available port
    while (usedPorts.has(nextPort)) {
      nextPort += 2;
    }

    // Use AVDs round-robin (usually there's 1 AVD, which can have multiple instances)
    const avdName = avds[i % avds.length];
    const emu = await startEmulator(avdName, nextPort);
    emulators.push(emu);
    usedPorts.add(nextPort);
    nextPort += 2;
  }

  return emulators;
}

/**
 * Waits for all emulators to boot.
 *
 * @param emulators - Array of emulators to wait for
 * @param onBoot - Callback when each emulator boots
 * @returns Array of emulators with updated status
 */
export async function waitForAllBoots(
  emulators: Emulator[],
  onBoot?: (emu: Emulator) => void
): Promise<Emulator[]> {
  const results = await Promise.all(
    emulators.map(async (emu) => {
      if (emu.status === 'ready') {
        onBoot?.(emu);
        return emu;
      }

      const booted = await waitForBoot(emu.id);
      const updated: Emulator = {
        ...emu,
        status: booted ? 'ready' : 'error',
      };
      if (booted) onBoot?.(updated);
      return updated;
    })
  );

  return results;
}

/**
 * Calculates the port for the Nth emulator.
 * @param index - Zero-based index
 * @returns Port number
 */
export function portForIndex(index: number): number {
  return BASE_PORT + index * 2;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
