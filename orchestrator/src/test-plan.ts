/**
 * Test Plan Approval — human gate between generate and execute.
 * Shows a summary of what was generated, lets user review/edit before running.
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ModuleDefinition, OrchestratorConfig } from './types.js';

interface TestPlanSummary {
  modules: ModulePlanEntry[];
  totalTests: number;
  byLevel: Record<string, number>;
  byType: Record<string, number>;
}

interface ModulePlanEntry {
  name: string;
  folder: string;
  testCount: number;
  tests: Array<{ id: string; name: string; type: string; level: string }>;
}

/**
 * Shows the test plan summary and asks user for approval before execution.
 * Returns the approved modules (user can deselect some).
 *
 * @param config - Orchestrator config
 * @param modules - Available modules
 * @returns Approved modules to execute (or null if cancelled)
 */
export async function showTestPlanApproval(
  config: OrchestratorConfig,
  modules: ModuleDefinition[]
): Promise<ModuleDefinition[] | null> {
  const plan = buildTestPlan(config, modules);

  if (plan.totalTests === 0) {
    p.log.warn('No test scripts found. Generate tests first.');
    return null;
  }

  // Display summary
  p.log.info(pc.bold('═══════════════════════════════════════════'));
  p.log.info(pc.bold('  📋 Test Plan Summary'));
  p.log.info(pc.bold('═══════════════════════════════════════════'));
  p.log.info('');
  p.log.info(`  Total tests: ${pc.cyan(String(plan.totalTests))}`);
  p.log.info('');

  // By level
  if (Object.keys(plan.byLevel).length > 0) {
    p.log.info(pc.dim('  By Level:'));
    for (const [level, count] of Object.entries(plan.byLevel)) {
      p.log.info(`    ${level}: ${count} tests`);
    }
    p.log.info('');
  }

  // By module
  p.log.info(pc.dim('  By Module:'));
  for (const mod of plan.modules) {
    p.log.info(`    ${mod.name}: ${mod.testCount} tests`);
  }
  p.log.info('');
  p.log.info(pc.bold('═══════════════════════════════════════════'));

  // Ask for approval
  const action = await p.select({
    message: 'How would you like to proceed? (↑↓ navigate, Enter select)',
    options: [
      { value: 'approve', label: '✅ Approve and execute all', hint: `run all ${plan.totalTests} tests` },
      { value: 'select', label: '🔧 Select specific modules', hint: 'Space toggle, Enter confirm' },
      { value: 'details', label: '📄 Show detailed plan', hint: 'list every test case' },
      { value: 'cancel', label: '❌ Cancel', hint: 'go back' },
    ],
  });

  if (p.isCancel(action) || action === 'cancel') return null;

  if (action === 'details') {
    // Show full detail
    for (const mod of plan.modules) {
      p.log.info('');
      p.log.info(pc.bold(`  ${mod.name} (${mod.testCount} tests):`));
      for (const test of mod.tests) {
        const levelTag = test.level ? pc.dim(`[${test.level}]`) : '';
        p.log.info(`    ${pc.dim(test.id)} ${test.name} ${levelTag}`);
      }
    }
    p.log.info('');

    // Ask again after showing details
    const confirm = await p.confirm({ message: 'Execute all tests?' });
    if (p.isCancel(confirm) || !confirm) return null;
    return modules;
  }

  if (action === 'select') {
    const choices = plan.modules.map((m) => ({
      value: m.folder,
      label: `${m.name} (${m.testCount} tests)`,
      hint: m.tests.map((t) => t.type).filter((v, i, a) => a.indexOf(v) === i).join(', '),
    }));

    const selected = await p.multiselect({
      message: 'Select modules to execute (space = toggle, enter = confirm):',
      options: choices,
      initialValues: choices.map((c) => c.value),
    });

    if (p.isCancel(selected)) return null;
    return modules.filter((m) => (selected as string[]).includes(m.folder));
  }

  // approve
  return modules;
}

/**
 * Builds the test plan by scanning YAML files.
 */
function buildTestPlan(config: OrchestratorConfig, modules: ModuleDefinition[]): TestPlanSummary {
  const plan: TestPlanSummary = {
    modules: [],
    totalTests: 0,
    byLevel: {},
    byType: {},
  };

  for (const mod of modules) {
    const testDir = path.join(config.e2eTestsDir, mod.folder);
    if (!fs.existsSync(testDir)) continue;

    const yamlFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.yaml'));
    const entry: ModulePlanEntry = {
      name: mod.name,
      folder: mod.folder,
      testCount: yamlFiles.length,
      tests: [],
    };

    for (const file of yamlFiles) {
      try {
        const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
        const parsed = parseYaml(content) as { name?: string; test_type?: string; level?: string };

        const testId = file.replace('.yaml', '');
        const level = parsed.level || 'L2';
        const type = parsed.test_type || inferTestType(testId, parsed.name || '');

        entry.tests.push({ id: testId, name: parsed.name || testId, type, level });

        plan.byLevel[level] = (plan.byLevel[level] || 0) + 1;
        plan.byType[type] = (plan.byType[type] || 0) + 1;
      } catch {
        entry.tests.push({ id: file, name: file, type: 'unknown', level: 'L2' });
      }
    }

    plan.modules.push(entry);
    plan.totalTests += entry.testCount;
  }

  return plan;
}

/**
 * Writes the test plan to a file for reference.
 */
export function writeTestPlan(config: OrchestratorConfig, modules: ModuleDefinition[], runDir: string): void {
  const plan = buildTestPlan(config, modules);

  let content = `# Test Plan\n\n`;
  content += `Generated: ${new Date().toISOString().slice(0, 19)}\n`;
  content += `Total: ${plan.totalTests} tests across ${plan.modules.length} modules\n\n`;

  for (const mod of plan.modules) {
    content += `## ${mod.name} (${mod.testCount} tests)\n\n`;
    for (const test of mod.tests) {
      content += `- [${test.level}] ${test.id}: ${test.name} (${test.type})\n`;
    }
    content += `\n`;
  }

  fs.writeFileSync(path.join(runDir, 'test-plan.md'), content, 'utf-8');
}


/**
 * Infers test type from filename or test name.
 */
function inferTestType(testId: string, name: string): string {
  const combined = (testId + ' ' + name).toLowerCase();
  if (combined.includes('negative') || combined.includes('invalid') || combined.includes('error') || combined.includes('wrong')) return 'negative';
  if (combined.includes('boundary') || combined.includes('edge') || combined.includes('limit') || combined.includes('max') || combined.includes('min')) return 'boundary';
  if (combined.includes('edge') || combined.includes('transition') || combined.includes('interrupt')) return 'edge_case';
  return 'happy_path';
}
