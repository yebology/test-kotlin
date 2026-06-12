/**
 * Resume and retry logic.
 * Tracks run state, detects incomplete modules, enables partial re-runs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { AgentProcess, ModuleDefinition, OrchestratorConfig, RunMetadata, ModuleRunMeta } from './types.js';
import { readTcVersion } from './modules.js';

/**
 * Creates a new run directory with timestamp-based naming.
 *
 * @param config - Orchestrator config
 * @returns Path to the created run directory
 */
export function createRunDirectory(config: OrchestratorConfig): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  const runId = `run-${dd}-${mm}-${yy}_(${hh}-${min})`;
  const runDir = path.join(config.e2eRunsDir, runId);

  fs.mkdirSync(path.join(runDir, 'screenshots'), { recursive: true });

  return runDir;
}

/**
 * Finds the latest incomplete run for resumption.
 *
 * @param config - Orchestrator config
 * @returns Path to the run directory and its metadata, or null if no resumable run found
 */
export function findResumableRun(config: OrchestratorConfig): { runDir: string; metadata: RunMetadata } | null {
  if (!fs.existsSync(config.e2eRunsDir)) return null;

  const runs = fs.readdirSync(config.e2eRunsDir)
    .filter((d) => d.startsWith('run-'))
    .sort()
    .reverse(); // Latest first

  for (const run of runs) {
    const runDir = path.join(config.e2eRunsDir, run);
    const metadataPath = path.join(runDir, 'metadata.yaml');

    if (!fs.existsSync(metadataPath)) continue;

    const content = fs.readFileSync(metadataPath, 'utf-8');
    const metadata = parseYaml(content) as RunMetadata;

    if (metadata.status === 'in-progress' || metadata.status === 'partial') {
      return { runDir, metadata };
    }
  }

  return null;
}

/**
 * Determines which modules need to be (re)run based on metadata.
 *
 * @param metadata - Run metadata from previous session
 * @param allModules - All available modules
 * @returns Modules that are incomplete or failed
 */
export function getIncompleteModules(metadata: RunMetadata, allModules: ModuleDefinition[]): ModuleDefinition[] {
  const completed = new Set(
    metadata.modules
      .filter((m) => m.status === 'passed')
      .map((m) => m.folder)
  );

  return allModules.filter((m) => !completed.has(m.folder));
}

/**
 * Writes initial run metadata.
 *
 * @param runDir - Run directory path
 * @param config - Orchestrator config
 * @param modules - Modules being executed
 * @param agents - Agent assignments
 */
export function writeMetadata(
  runDir: string,
  config: OrchestratorConfig,
  modules: ModuleDefinition[],
  agents: AgentProcess[]
): void {
  const metadata: RunMetadata = {
    runId: path.basename(runDir),
    startTime: new Date().toISOString(),
    tcVersion: readTcVersion(config),
    device: agents.map((a) => a.deviceId).join(', '),
    status: 'in-progress',
    modules: modules.map((mod) => {
      const agent = agents.find((a) => a.moduleFolder === mod.folder);
      return {
        name: mod.name,
        folder: mod.folder,
        status: 'pending',
        deviceId: agent?.deviceId ?? 'unassigned',
        testCasesTotal: agent?.testCasesTotal ?? 0,
        testCasesPassed: 0,
        testCasesFailed: 0,
        testCasesSkipped: 0,
        attempts: 1,
      };
    }),
  };

  const metadataPath = path.join(runDir, 'metadata.yaml');
  fs.writeFileSync(metadataPath, stringifyYaml(metadata), 'utf-8');
}

/**
 * Updates run metadata after execution completes.
 *
 * @param runDir - Run directory path
 * @param agents - Completed agent results
 */
export function updateMetadata(runDir: string, agents: AgentProcess[]): void {
  const metadataPath = path.join(runDir, 'metadata.yaml');
  if (!fs.existsSync(metadataPath)) return;

  const content = fs.readFileSync(metadataPath, 'utf-8');
  const metadata = parseYaml(content) as RunMetadata;

  metadata.endTime = new Date().toISOString();

  // Update module statuses from agent results
  for (const agent of agents) {
    const moduleMeta = metadata.modules.find((m) => m.folder === agent.moduleFolder);
    if (moduleMeta) {
      moduleMeta.status = agent.status;
      moduleMeta.testCasesPassed = agent.testCasesPassed;
      moduleMeta.testCasesFailed = agent.testCasesFailed;
      moduleMeta.testCasesSkipped = agent.testCasesSkipped;
    }
  }

  // Determine overall status
  const allDone = metadata.modules.every((m) => m.status === 'passed' || m.status === 'failed' || m.status === 'skipped');
  const anyIncomplete = metadata.modules.some((m) => m.status === 'timeout' || m.status === 'pending' || m.status === 'running');

  if (allDone && !anyIncomplete) {
    metadata.status = 'completed';
  } else {
    metadata.status = 'partial';
  }

  fs.writeFileSync(metadataPath, stringifyYaml(metadata), 'utf-8');
}
