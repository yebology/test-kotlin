/**
 * Run comparison — compare two test runs to detect regressions and fixes.
 * Fixes gap #19: baseline-integration run comparison feature.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import pc from 'picocolors';
import type { OrchestratorConfig, RunMetadata } from './types.js';

interface ComparisonResult {
  regressions: Array<{ module: string; was: string; now: string }>;
  fixes: Array<{ module: string; was: string; now: string }>;
  unchanged: Array<{ module: string; status: string }>;
  summary: string;
}

/**
 * Lists all available runs for comparison.
 *
 * @param config - Orchestrator config
 * @returns Array of run directory names sorted by date
 */
export function listRuns(config: OrchestratorConfig): string[] {
  if (!fs.existsSync(config.e2eRunsDir)) return [];

  return fs.readdirSync(config.e2eRunsDir)
    .filter((d) => d.startsWith('run-'))
    .sort();
}

/**
 * Compares two runs and reports regressions/fixes.
 *
 * @param config - Orchestrator config
 * @param runA - First run directory name (older)
 * @param runB - Second run directory name (newer)
 * @returns Comparison result
 */
export function compareRuns(
  config: OrchestratorConfig,
  runA: string,
  runB: string
): ComparisonResult {
  const metaA = loadRunMetadata(config, runA);
  const metaB = loadRunMetadata(config, runB);

  if (!metaA || !metaB) {
    return {
      regressions: [],
      fixes: [],
      unchanged: [],
      summary: 'Cannot compare — one or both runs missing metadata.yaml',
    };
  }

  const regressions: ComparisonResult['regressions'] = [];
  const fixes: ComparisonResult['fixes'] = [];
  const unchanged: ComparisonResult['unchanged'] = [];

  // Map modules from run A
  const moduleMapA = new Map(metaA.modules.map((m) => [m.folder, m.status]));

  for (const modB of metaB.modules) {
    const statusA = moduleMapA.get(modB.folder);

    if (!statusA) {
      // New module in run B
      unchanged.push({ module: modB.name, status: `new (${modB.status})` });
      continue;
    }

    if (statusA === 'passed' && modB.status === 'failed') {
      regressions.push({ module: modB.name, was: 'passed', now: 'failed' });
    } else if (statusA === 'failed' && modB.status === 'passed') {
      fixes.push({ module: modB.name, was: 'failed', now: 'passed' });
    } else {
      unchanged.push({ module: modB.name, status: modB.status });
    }
  }

  const summary = [
    `Comparing ${runA} → ${runB}:`,
    regressions.length > 0 ? `  ${pc.red(`⬇ ${regressions.length} regression(s)`)}` : '',
    fixes.length > 0 ? `  ${pc.green(`⬆ ${fixes.length} fix(es)`)}` : '',
    `  ${unchanged.length} unchanged`,
  ].filter(Boolean).join('\n');

  return { regressions, fixes, unchanged, summary };
}

/**
 * Loads metadata from a run directory.
 */
function loadRunMetadata(config: OrchestratorConfig, runName: string): RunMetadata | null {
  const metaPath = path.join(config.e2eRunsDir, runName, 'metadata.yaml');
  if (!fs.existsSync(metaPath)) return null;

  const content = fs.readFileSync(metaPath, 'utf-8');
  return parseYaml(content) as RunMetadata;
}

/**
 * Prints comparison result to terminal.
 */
export function printComparison(result: ComparisonResult): void {
  console.log(result.summary);
  console.log('');

  if (result.regressions.length > 0) {
    console.log(pc.red(pc.bold('  Regressions:')));
    for (const r of result.regressions) {
      console.log(pc.red(`    ⬇ ${r.module}: ${r.was} → ${r.now}`));
    }
  }

  if (result.fixes.length > 0) {
    console.log(pc.green(pc.bold('  Fixes:')));
    for (const f of result.fixes) {
      console.log(pc.green(`    ⬆ ${f.module}: ${f.was} → ${f.now}`));
    }
  }
}
