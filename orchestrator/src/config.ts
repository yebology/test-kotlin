/**
 * Orchestrator configuration management.
 * Resolves paths relative to project root and provides defaults.
 */

import path from 'node:path';
import type { OrchestratorConfig, CliOptions, GenerateSource } from './types.js';

/** Default timeout per module: 30 minutes */
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

/** Default number of workers (emulators) */
const DEFAULT_WORKERS = 2;

/** Max retry count for failed modules */
const DEFAULT_RETRY_COUNT = 2;

/** Batch size per agent session */
const DEFAULT_BATCH_SIZE = 10;

/**
 * Resolves the project root (parent of orchestrator/).
 * @returns Absolute path to project root
 */
export function getProjectRoot(): string {
  // wizard.sh runs from orchestrator/ dir. Project root = parent.
  return path.resolve(process.cwd(), '..');
}

/**
 * Builds orchestrator config from CLI options.
 * @param options - Parsed CLI options
 * @returns Full orchestrator configuration
 */
export function buildConfig(options: CliOptions): OrchestratorConfig {
  const projectRoot = getProjectRoot();

  return {
    projectRoot,
    e2eTestsDir: path.join(projectRoot, 'e2e-tests'),
    e2eRunsDir: path.join(projectRoot, 'e2e-runs'),
    promptDir: path.join(projectRoot, 'prompt'),
    maxWorkers: options.workers,
    timeoutMs: options.timeout,
    retryCount: DEFAULT_RETRY_COUNT,
    batchSize: DEFAULT_BATCH_SIZE,
  };
}

/**
 * Parses CLI arguments into options.
 * @param args - Raw process.argv slice
 * @returns Parsed CLI options
 */
export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    workers: DEFAULT_WORKERS,
    resume: false,
    verbose: false,
    timeout: DEFAULT_TIMEOUT_MS,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--modules':
        options.modules = args[++i]?.split(',').map((m) => m.trim());
        break;
      case '--workers':
        options.workers = parseInt(args[++i], 10) || DEFAULT_WORKERS;
        break;
      case '--resume':
        options.resume = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--timeout':
        options.timeout = (parseInt(args[++i], 10) || 1800) * 1000;
        break;
      case '--apk':
        options.apkPath = args[++i];
        break;
      case '--generate':
        options.generate = (args[++i] as GenerateSource) || 'codebase';
        break;
      case '--compare':
        options.compare = true;
        break;
      case '--execute':
        options.execute = true;
        break;
      case '--model':
        options.model = args[++i];
        break;
    }
  }

  return options;
}
