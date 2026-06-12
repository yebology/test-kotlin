/**
 * Report Generator — produces report.md and defect-analysis.json after a test run.
 * Reads results JSON files from the run directory and generates:
 *   - report.md: Human-readable markdown summary
 *   - defect-analysis.json: Structured failure data for downstream tools
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AgentProcess } from './types.js';
import type { TestResult } from './executor.js';

interface DefectEntry {
  testId: string;
  module: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  expected: string;
  actual: string;
  screenshot?: string;
  likelyCause: string;
  suggestedFix: string;
}

/**
 * Generates report.md and defect-analysis.json for a completed run.
 *
 * @param runDir - Run directory path
 * @param agents - Completed agent results
 */
export function generateReport(runDir: string, agents: AgentProcess[]): void {
  const allResults = loadAllResults(runDir, agents);
  const reportMd = buildReportMarkdown(agents, allResults);
  const defects = buildDefectAnalysis(allResults, agents);

  fs.writeFileSync(path.join(runDir, 'report.md'), reportMd, 'utf-8');
  fs.writeFileSync(path.join(runDir, 'defect-analysis.json'), JSON.stringify(defects, null, 2), 'utf-8');
}

/**
 * Loads all test results from per-module JSON files.
 */
function loadAllResults(runDir: string, agents: AgentProcess[]): TestResult[] {
  const results: TestResult[] = [];

  for (const agent of agents) {
    const resultsFile = path.join(runDir, `${agent.moduleFolder}-results.json`);
    if (fs.existsSync(resultsFile)) {
      const content = fs.readFileSync(resultsFile, 'utf-8');
      const moduleResults = JSON.parse(content) as TestResult[];
      results.push(...moduleResults);
    }
  }

  return results;
}

/**
 * Builds the report.md markdown content.
 */
function buildReportMarkdown(agents: AgentProcess[], results: TestResult[]): string {
  const totalPassed = results.filter((r) => r.status === 'passed').length;
  const totalFailed = results.filter((r) => r.status === 'failed').length;
  const totalSkipped = results.filter((r) => r.status === 'skipped').length;
  const total = results.length;
  const passRate = total > 0 ? ((totalPassed / total) * 100).toFixed(1) : '0.0';

  const duration = agents.reduce((sum, a) => {
    if (a.startTime && a.endTime) return sum + (a.endTime - a.startTime);
    return sum;
  }, 0);

  // Group by level
  const byLevel = groupByLevel(results);

  // Group by module
  const byModule = groupByModule(results, agents);

  let md = `# E2E Test Report\n\n`;
  md += `**Date:** ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
  md += `**Duration:** ${Math.round(duration / 1000)}s\n`;
  md += `**Workers:** ${agents.length}\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Tests | ${total} |\n`;
  md += `| Passed | ${totalPassed} |\n`;
  md += `| Failed | ${totalFailed} |\n`;
  md += `| Skipped | ${totalSkipped} |\n`;
  md += `| Pass Rate | ${passRate}% |\n\n`;

  // By level
  if (Object.keys(byLevel).length > 0) {
    md += `## Coverage by Level\n\n`;
    md += `| Level | Description | Total | Passed | Failed | Pass Rate |\n`;
    md += `|-------|-------------|-------|--------|--------|----------|\n`;
    for (const [level, levelResults] of Object.entries(byLevel)) {
      const p = levelResults.filter((r) => r.status === 'passed').length;
      const f = levelResults.filter((r) => r.status === 'failed').length;
      const t = levelResults.length;
      const desc = LEVEL_DESCRIPTIONS[level as keyof typeof LEVEL_DESCRIPTIONS] || '';
      md += `| ${level} | ${desc} | ${t} | ${p} | ${f} | ${t > 0 ? ((p / t) * 100).toFixed(0) : 0}% |\n`;
    }
    md += `\n`;
  }

  // By module
  md += `## Results by Module\n\n`;
  for (const [moduleName, moduleResults] of Object.entries(byModule)) {
    const p = moduleResults.filter((r) => r.status === 'passed').length;
    const f = moduleResults.filter((r) => r.status === 'failed').length;
    const icon = f === 0 ? '✔' : '✖';
    md += `### ${icon} ${moduleName}\n\n`;
    md += `${p} passed, ${f} failed (${moduleResults.length} total)\n\n`;

    const failures = moduleResults.filter((r) => r.status === 'failed');
    if (failures.length > 0) {
      md += `| Test | Expected | Actual |\n|------|----------|--------|\n`;
      for (const f of failures) {
        md += `| ${f.testId} | ${f.expected.slice(0, 50)} | ${f.actual.slice(0, 50)} |\n`;
      }
      md += `\n`;
    }
  }

  // Repaired tests
  const repaired = results.filter((r) => r.repaired);
  if (repaired.length > 0) {
    md += `## Self-Repaired Tests\n\n`;
    md += `${repaired.length} test(s) were repaired by AI during execution:\n\n`;
    for (const r of repaired) {
      md += `- ${r.testId}: ${r.name}\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Builds structured defect analysis for failed tests.
 */
function buildDefectAnalysis(results: TestResult[], agents: AgentProcess[]): DefectEntry[] {
  const failures = results.filter((r) => r.status === 'failed');
  const moduleMap = new Map(agents.map((a) => [a.moduleFolder, a.moduleName]));

  return failures.map((f) => {
    const severity = classifySeverity(f);
    const likelyCause = inferCause(f);

    return {
      testId: f.testId,
      module: moduleMap.get(f.testId.split('-')[0]?.toLowerCase() || '') || 'Unknown',
      name: f.name,
      severity,
      expected: f.expected,
      actual: f.actual,
      screenshot: f.screenshot,
      likelyCause,
      suggestedFix: suggestFix(likelyCause),
    };
  });
}

/**
 * Classifies severity based on failure type.
 */
function classifySeverity(result: TestResult): DefectEntry['severity'] {
  const actual = result.actual.toLowerCase();
  if (actual.includes('crash') || actual.includes('exception') || actual.includes('anr')) return 'critical';
  if (actual.includes('not found') || actual.includes('step failed')) return 'high';
  if (actual.includes('mismatch') || actual.includes('different')) return 'medium';
  return 'low';
}

/**
 * Infers likely cause from failure message.
 */
function inferCause(result: TestResult): string {
  const actual = result.actual.toLowerCase();
  if (actual.includes('not found')) return 'Element missing or changed — UI may have been updated';
  if (actual.includes('timeout')) return 'Element took too long to appear — possible performance issue';
  if (actual.includes('crash')) return 'Application crashed during test execution';
  if (actual.includes('step failed')) return 'Action could not be performed — element may be obscured or disabled';
  return 'Unexpected state — manual investigation needed';
}

/**
 * Suggests a fix based on the cause.
 */
function suggestFix(cause: string): string {
  if (cause.includes('missing or changed')) return 'Update test selector to match current UI. Check if element was renamed or moved.';
  if (cause.includes('too long')) return 'Add explicit wait or increase timeout. Check if API call is slow.';
  if (cause.includes('crashed')) return 'Check crash logs. This is likely a bug in the app, not the test.';
  if (cause.includes('obscured')) return 'Dismiss keyboard or scroll to element before interacting.';
  return 'Review screenshot and app state. Re-run test manually to reproduce.';
}

function groupByLevel(results: TestResult[]): Record<string, TestResult[]> {
  const groups: Record<string, TestResult[]> = {};
  for (const r of results) {
    const level = r.level || 'L2'; // Default to L2 if unspecified
    if (!groups[level]) groups[level] = [];
    groups[level].push(r);
  }
  return groups;
}

function groupByModule(results: TestResult[], agents: AgentProcess[]): Record<string, TestResult[]> {
  const groups: Record<string, TestResult[]> = {};
  // Group by prefix of testId (e.g., SI-HP-001 → SI module)
  for (const agent of agents) {
    groups[agent.moduleName] = [];
  }
  // Assign results to modules based on the order they were produced
  let resultIdx = 0;
  for (const agent of agents) {
    const count = agent.testCasesPassed + agent.testCasesFailed + agent.testCasesSkipped;
    const moduleResults = results.slice(resultIdx, resultIdx + count);
    groups[agent.moduleName] = moduleResults;
    resultIdx += count;
  }
  return groups;
}

const LEVEL_DESCRIPTIONS = {
  L1: 'Structure — screens load, elements present',
  L2: 'Interaction — tap, type, swipe, navigate',
  L3: 'CRUD — create, read, update, delete flows',
  L4: 'Business Logic — cross-module, conditional rules',
};
