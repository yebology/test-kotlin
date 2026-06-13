/**
 * Terminal progress display.
 * Shows real-time per-module status with colors and symbols.
 */

import pc from 'picocolors';
import type { AgentProcess, ModuleStatus } from './types.js';

/** Status symbols for terminal display */
const STATUS_SYMBOLS: Record<ModuleStatus, string> = {
  pending: '○',
  running: '◐',
  passed: '✔',
  failed: '✖',
  timeout: '⏱',
  skipped: '⊘',
};

/** Status colors */
const STATUS_COLORS: Record<ModuleStatus, (s: string) => string> = {
  pending: pc.dim,
  running: pc.cyan,
  passed: pc.green,
  failed: pc.red,
  timeout: pc.yellow,
  skipped: pc.gray,
};

/**
 * Formats a single agent's status line for terminal output.
 *
 * @param agent - Agent to format
 * @returns Formatted status string
 */
export function formatAgentStatus(agent: AgentProcess): string {
  const symbol = STATUS_SYMBOLS[agent.status];
  const colorFn = STATUS_COLORS[agent.status];

  let detail: string;

  switch (agent.status) {
    case 'pending':
      detail = `waiting (${agent.testCasesTotal} tests)`;
      break;
    case 'running': {
      const done = agent.testCasesPassed + agent.testCasesFailed + agent.testCasesSkipped;
      const parts = [];
      if (agent.testCasesPassed > 0) parts.push(pc.green(`${agent.testCasesPassed}✔`));
      if (agent.testCasesFailed > 0) parts.push(pc.red(`${agent.testCasesFailed}✖`));
      if (agent.testCasesSkipped > 0) parts.push(pc.gray(`${agent.testCasesSkipped}⊘`));
      const progress = parts.length > 0 ? parts.join(' ') : '0';
      detail = `running (${done}/${agent.testCasesTotal}) ${progress}`;
      break;
    }
    case 'passed':
      detail = `${pc.green(`${agent.testCasesPassed}✔`)} ${agent.testCasesFailed > 0 ? pc.red(`${agent.testCasesFailed}✖`) : ''} ${agent.testCasesSkipped > 0 ? pc.gray(`${agent.testCasesSkipped}⊘`) : ''} (${agent.testCasesTotal} total)`.trim();
      break;
    case 'failed':
      detail = `${pc.green(`${agent.testCasesPassed}✔`)} ${pc.red(`${agent.testCasesFailed}✖`)} ${agent.testCasesSkipped > 0 ? pc.gray(`${agent.testCasesSkipped}⊘`) : ''} (${agent.testCasesTotal} total)`.trim();
      break;
    case 'timeout':
      detail = `timed out — ${pc.green(`${agent.testCasesPassed}✔`)} ${pc.red(`${agent.testCasesFailed}✖`)} ${pc.gray(`${agent.testCasesSkipped}⊘`)}`;
      break;
    case 'skipped':
      detail = 'skipped';
      break;
  }

  const duration = agent.endTime && agent.startTime
    ? ` [${Math.round((agent.endTime - agent.startTime) / 1000)}s]`
    : agent.startTime
      ? ` [${Math.round((Date.now() - agent.startTime) / 1000)}s]`
      : '';

  return colorFn(`${symbol} ${agent.moduleName} — ${detail}${duration}`);
}

/**
 * Renders all agents' status to terminal.
 * Uses ANSI escape to overwrite previous output for live updates.
 *
 * @param agents - All tracked agents
 * @param clear - Whether to clear previous lines
 */
export function renderProgress(agents: AgentProcess[], clear = true): void {
  if (clear && agents.length > 0) {
    // Move cursor up N lines and clear
    process.stdout.write(`\x1B[${agents.length + 2}A`);
  }

  const lines = agents.map(formatAgentStatus);
  const separator = pc.dim('─'.repeat(60));

  console.log(separator);
  for (const line of lines) {
    // Clear line and print
    process.stdout.write('\x1B[2K');
    console.log(`  ${line}`);
  }
  console.log(separator);
}

/**
 * Prints initial progress header (before live updates begin).
 *
 * @param agents - All agents to display
 */
export function printProgressHeader(agents: AgentProcess[]): void {
  console.log('');
  console.log(pc.bold('📊 Execution Progress'));
  renderProgress(agents, false);
}

/**
 * Prints final summary after all agents complete.
 *
 * @param agents - Completed agents
 */
export function printFinalSummary(agents: AgentProcess[]): void {
  console.log('');
  console.log(pc.bold('═'.repeat(60)));
  console.log(pc.bold('  📋 Final Results'));
  console.log(pc.bold('═'.repeat(60)));
  console.log('');

  for (const agent of agents) {
    console.log(`  ${formatAgentStatus(agent)}`);
  }

  console.log('');

  const totalPassed = agents.reduce((sum, a) => sum + a.testCasesPassed, 0);
  const totalFailed = agents.reduce((sum, a) => sum + a.testCasesFailed, 0);
  const totalSkipped = agents.reduce((sum, a) => sum + a.testCasesSkipped, 0);
  const total = totalPassed + totalFailed + totalSkipped;
  const passRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : '0.0';

  console.log(pc.bold('  Totals:'));
  console.log(`    ${pc.green(`✔ ${totalPassed} passed`)}  ${pc.red(`✖ ${totalFailed} failed`)}  ${pc.gray(`⊘ ${totalSkipped} skipped`)}`);
  console.log(`    Pass Rate: ${parseFloat(passRate) >= 80 ? pc.green(passRate + '%') : pc.red(passRate + '%')}`);

  const starts = agents.filter((a) => a.startTime).map((a) => a.startTime!);
  const ends = agents.filter((a) => a.endTime).map((a) => a.endTime!);
  if (starts.length > 0 && ends.length > 0) {
    const wallTime = Math.round((Math.max(...ends) - Math.min(...starts)) / 1000);
    console.log(`    Duration: ${wallTime}s (wall clock, parallel)`);
  }

  console.log('');
}
