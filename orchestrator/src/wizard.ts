/**
 * E2E Orchestrator — Main entry point.
 * Fully independent from Kiro IDE.
 *
 * Generate = AI (Claude API, one-time cost ~$2)
 * Execute = Deterministic (no AI, $0 per run)
 */

import * as p from '@clack/prompts';
import pc from 'picocolors';
import fs from 'node:fs';
import path from 'node:path';

import { parseArgs, buildConfig } from './config.js';
import { listRunningEmulators, startMultipleEmulators, waitForAllBoots, installApk } from './emulator.js';
import { loadModuleOrder, resolveExecutionGroups, filterModules, countTestCases, readTcVersion } from './modules.js';
import { runGenerator } from './generator.js';
import { executeModule } from './executor.js';
import { createReport, appendResult, finalizeReport } from './excel-writer.js';
import { McpClientPool } from './mcp-client.js';
import { mergeReports } from './report-merger.js';
import { createRunDirectory, findResumableRun, getIncompleteModules, writeMetadata, updateMetadata } from './resume.js';
import { printProgressHeader, renderProgress, printFinalSummary } from './progress.js';
import { listRuns, compareRuns, printComparison } from './compare-runs.js';
import { cloneOrPullRepo } from './repo.js';
import { showTestPlanApproval, writeTestPlan } from './test-plan.js';
import { generateReport } from './report-generator.js';
import type { ModuleDefinition, Emulator, AgentProcess, GenerateSource } from './types.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  const config = buildConfig(options);

  p.intro(pc.bgCyan(pc.black(' 🧪 E2E Test Orchestrator ')));

  // ─── MODE SELECTION ───────────────────────────────────────────────
  let mode: string;

  if (options.generate) {
    mode = `generate-${options.generate}`;
  } else if (options.compare) {
    mode = 'compare';
  } else if (options.resume || options.execute) {
    mode = 'execute';
  } else {
    const selected = await p.select({
      message: 'What would you like to do? (↑↓ navigate, Enter select)',
      options: [
        { value: 'generate-codebase', label: '🔍 Generate tests from codebase', hint: 'AI scans code → YAML' },
        { value: 'generate-requirements', label: '📄 Generate tests from requirements', hint: 'AI reads docs → YAML' },
        { value: 'generate-excel', label: '📊 Generate tests from Excel', hint: 'AI reads .xlsx → YAML' },
        { value: 'execute', label: '▶️  Execute tests (parallel)', hint: 'deterministic, $0 per run' },
        { value: 'full', label: '🚀 Full pipeline (generate + execute)', hint: 'generate then execute' },
        { value: 'compare', label: '📈 Compare runs', hint: 'detect regressions between 2 runs' },
      ],
    });

    if (p.isCancel(selected)) {
      p.cancel('Cancelled.');
      process.exit(0);
    }
    mode = selected as string;
  }

  // ─── COMPARE MODE ─────────────────────────────────────────────────
  if (mode === 'compare') {
    const runs = listRuns(config);
    if (runs.length < 2) {
      p.cancel('Need at least 2 runs to compare.');
      process.exit(1);
    }
    const runOptions = runs.map((r) => ({ value: r, label: r }));
    const runA = await p.select({ message: 'Older run:', options: runOptions });
    if (p.isCancel(runA)) { p.cancel('Cancelled.'); process.exit(0); }
    const runB = await p.select({ message: 'Newer run:', options: runOptions });
    if (p.isCancel(runB)) { p.cancel('Cancelled.'); process.exit(0); }
    printComparison(compareRuns(config, runA as string, runB as string));
    p.outro('');
    return;
  }

  // ─── GENERATE MODE (requires API key) ─────────────────────────────
  if (mode === 'generate-codebase' || mode === 'generate-requirements' || mode === 'generate-excel' || mode === 'full') {

    // Clone from remote repo (interactive)
    let repoConfig: { url: string; token?: string; branch?: string } | null = null;
    let projectName = '';
    let platform: 'android' | 'ios' = 'android';

    if (mode === 'generate-codebase' || mode === 'full') {
      // Project name
      const nameInput = await p.text({ message: 'Project name (used for folder naming):', placeholder: 'my-app' });
      if (p.isCancel(nameInput)) { p.cancel('Cancelled.'); process.exit(0); }
      projectName = (nameInput as string).trim().toLowerCase().replace(/\s+/g, '-');

      // Platform
      const platformChoice = await p.select({
        message: 'Platform (↑↓ navigate, Enter select):',
        options: [
          { value: 'android', label: '🤖 Android', hint: 'scans .kt, .xml files' },
          { value: 'ios', label: '🍎 iOS', hint: 'scans .swift, .storyboard files' },
        ],
      });
      if (p.isCancel(platformChoice)) { p.cancel('Cancelled.'); process.exit(0); }
      platform = platformChoice as 'android' | 'ios';

      // Source
      const source = await p.select({
        message: 'Where is the source code? (↑↓ navigate, Enter select)',
        options: [
          { value: 'local', label: '📁 Local folder', hint: 'source code already on this machine' },
          { value: 'github', label: '🐙 GitHub', hint: 'clone via HTTPS + token' },
          { value: 'bitbucket', label: '🪣 Bitbucket', hint: 'clone via HTTPS + access token' },
          { value: 'gitlab', label: '🦊 GitLab', hint: 'clone via HTTPS + access token' },
          { value: 'codecommit', label: '☁️  AWS CodeCommit', hint: 'clone via HTTPS + git credentials' },
        ],
      });

      if (p.isCancel(source)) { p.cancel('Cancelled.'); process.exit(0); }

      if (source !== 'local') {
        const repoUrl = await p.text({ message: 'Repo URL (HTTPS):' });
        if (p.isCancel(repoUrl)) { p.cancel('Cancelled.'); process.exit(0); }

        let tokenMessage = 'Auth token (leave empty for public):';
        let tokenPlaceholder = 'optional';

        if (source === 'github') {
          tokenMessage = 'GitHub Personal Access Token:';
          tokenPlaceholder = 'ghp_xxxx';
        } else if (source === 'bitbucket') {
          tokenMessage = 'Bitbucket Access Token:';
          tokenPlaceholder = 'ATTTxxxx';
        } else if (source === 'gitlab') {
          tokenMessage = 'GitLab Access Token:';
          tokenPlaceholder = 'glpat-xxxx';
        } else if (source === 'codecommit') {
          tokenMessage = 'CodeCommit HTTPS Git credentials (username:password):';
          tokenPlaceholder = 'username:password';
        }

        const repoToken = await p.text({ message: tokenMessage, placeholder: tokenPlaceholder });
        if (p.isCancel(repoToken)) { p.cancel('Cancelled.'); process.exit(0); }

        const repoBranch = await p.text({ message: 'Branch:', placeholder: 'main (default)' });
        if (p.isCancel(repoBranch)) { p.cancel('Cancelled.'); process.exit(0); }

        repoConfig = {
          url: repoUrl as string,
          token: (repoToken as string) || undefined,
          branch: (repoBranch as string) || undefined,
        };
      }
    }

    if (repoConfig) {
      const s = p.spinner();
      s.start('Cloning repository...');
      try {
        // Clone to repos/{projectName}/{platform}/
        const reposBase = path.join(config.projectRoot, 'orchestrator', 'repos', projectName, platform);
        const repoPath = await cloneOrPullRepo(reposBase, repoConfig);
        // Point project root to cloned repo for SOURCE CODE scanning
        config.projectRoot = repoPath;
        s.stop(`Repo ready: ${repoPath}`);
      } catch (err) {
        s.stop('Clone failed.');
        p.log.error(err instanceof Error ? err.message : 'Unknown error');
        process.exit(1);
      }
    }

    // Model selection for kiro-cli
    const { KIRO_MODELS } = await import('./generator.js');

    const modelChoice = await p.select({
      message: 'Select AI model (↑↓ navigate, Enter select):',
      options: KIRO_MODELS.map((m) => ({
        value: m.id,
        label: m.label,
        hint: m.hint,
      })),
      initialValue: 'auto',
    });
    if (p.isCancel(modelChoice)) { p.cancel('Cancelled.'); process.exit(0); }
    const selectedModel = modelChoice as string;

    // kiro-cli handles model selection internally (Claude, included in subscription)
    const source: GenerateSource = mode === 'generate-requirements'
      ? 'requirements'
      : mode === 'generate-excel'
        ? 'excel'
        : 'codebase';

    const s = p.spinner();
    s.start(`Generating test scripts from ${source} via kiro-cli...`);

    try {
      const summary = await runGenerator(config, source, selectedModel, platform, (msg) => s.message(msg));
      s.stop('Test scripts generated.');
      p.log.success(summary || 'Done. Check e2e-tests/ folder.');
    } catch (err) {
      s.stop('Generation failed.');
      p.log.error(err instanceof Error ? err.message : 'Unknown error');
      if (mode !== 'full') process.exit(1);
    }

    if (mode !== 'full') {
      p.outro(pc.green('Done! ') + pc.dim('Scripts: e2e-tests/'));
      return;
    }
  }

  // ─── EXECUTE MODE (deterministic, $0) ─────────────────────────────

  if (!fs.existsSync(config.e2eTestsDir)) {
    p.cancel('No e2e-tests/ directory. Generate test scripts first.');
    process.exit(1);
  }

  let modulesToRun: ModuleDefinition[];
  let runDir: string;
  const allModules = loadModuleOrder(config);

  if (allModules.length === 0) {
    p.cancel('No modules in e2e-tests/. Generate scripts first.');
    process.exit(1);
  }

  // Handle resume
  if (options.resume) {
    const resumable = findResumableRun(config);
    if (resumable) {
      p.log.info(`Resuming: ${path.basename(resumable.runDir)}`);
      modulesToRun = getIncompleteModules(resumable.metadata, allModules);
      runDir = resumable.runDir;
      if (modulesToRun.length === 0) { p.log.success('All done!'); process.exit(0); }
    } else {
      modulesToRun = allModules;
      runDir = createRunDirectory(config);
    }
  } else {
    runDir = createRunDirectory(config);
    modulesToRun = allModules;
  }

  modulesToRun = filterModules(modulesToRun, options.modules);

  // Test plan approval (human gate) — includes module selection
  const approved = await showTestPlanApproval(config, modulesToRun);
  if (!approved) {
    p.cancel('Execution cancelled.');
    process.exit(0);
  }
  modulesToRun = approved;

  // Write test plan to run directory
  writeTestPlan(config, modulesToRun, runDir);

  // Worker count
  const maxW = Math.min(options.workers, modulesToRun.length);
  const wc = await p.select({
    message: `Parallel workers? (↑↓ navigate, enter confirm)`,
    options: Array.from({ length: Math.min(4, modulesToRun.length) }, (_, i) => ({
      value: i + 1,
      label: `${i + 1} worker${i > 0 ? 's' : ''} (${i + 1} emulator${i > 0 ? 's' : ''})`,
      hint: i + 1 === maxW ? 'recommended' : undefined,
    })),
    initialValue: maxW,
  });
  if (p.isCancel(wc)) { p.cancel('Cancelled.'); process.exit(0); }
  const workers = wc as number;

  // Setup emulators
  const s = p.spinner();
  s.start('Detecting emulators...');
  let emulators: Emulator[];

  try {
    const running = await listRunningEmulators();
    if (running.length >= workers) {
      emulators = running.slice(0, workers);
      s.stop(`Using ${workers} running emulator(s).`);
    } else {
      s.message(`Starting ${workers} emulators...`);
      emulators = await startMultipleEmulators(workers);
      emulators = await waitForAllBoots(emulators);
      emulators = emulators.filter((e) => e.status === 'ready');
      s.stop(`${emulators.length} emulator(s) ready.`);
    }
  } catch (err) {
    s.stop('Emulator setup failed.');
    p.log.error(err instanceof Error ? err.message : 'Error');
    process.exit(1);
  }

  if (emulators.length === 0) {
    p.cancel('No emulators. Start one manually.');
    process.exit(1);
  }

  // Install APK
  if (options.apkPath && fs.existsSync(options.apkPath)) {
    s.start('Installing APK...');
    for (const emu of emulators) {
      try { await installApk(emu.id, options.apkPath); } catch { /* continue */ }
    }
    s.stop('APK installed.');
  }

  // Resolve groups & execute
  const groups = resolveExecutionGroups(modulesToRun);
  p.log.info(pc.bold('Execution Plan:'));
  groups.forEach((g, i) => p.log.info(`  Group ${i + 1}: ${g.map((m) => m.name).join(', ')}`));

  // ─── DETERMINISTIC EXECUTION (no AI, $0) ──────────────────────────
  const allResults: AgentProcess[] = [];
  const mcpPool = new McpClientPool();

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    p.log.step(`Group ${gi + 1}/${groups.length}: ${group.map((m) => m.name).join(', ')}`);

    const assignments = group.map((mod, idx) => ({
      module: mod,
      deviceId: emulators[idx % emulators.length].id,
    }));

    const initialAgents: AgentProcess[] = assignments.map(({ module, deviceId }) => ({
      moduleFolder: module.folder,
      moduleName: module.name,
      deviceId,
      port: parseInt(deviceId.replace('emulator-', ''), 10),
      status: 'pending' as const,
      testCasesTotal: countTestCases(config, module.folder),
      testCasesPassed: 0,
      testCasesFailed: 0,
      testCasesSkipped: 0,
    }));

    writeMetadata(runDir, config, group, initialAgents);
    printProgressHeader(initialAgents);

    // Parallel deterministic execution
    const results = await Promise.all(
      assignments.map(async ({ module, deviceId }) => {
        const mcp = await mcpPool.getClient(deviceId);
        const excelPath = path.join(runDir, `${module.folder}-report.xlsx`);

        await createReport(excelPath, module.name, deviceId, {
          tcVersion: readTcVersion(config),
          totalModules: modulesToRun.length,
          promptDir: config.promptDir,
        });

        const agent = await executeModule(config, module, deviceId, runDir, mcp, {
          onTestComplete: async (result, _idx, _total) => {
            const status = result.status === 'passed' ? 'Passed' as const
              : result.status === 'failed' ? 'Failed' as const : 'Skip' as const;

            // Steps must use \n between each step (hook requirement)
            const formattedSteps = result.steps.replace(/\n/g, '\n');

            await appendResult(excelPath, module.name, {
              userFlow: module.name,
              testNo: result.testId,
              scenario: result.name,
              steps: formattedSteps,
              expected: result.expected,
              status,
              actual: result.actual,
              screenshot: result.screenshot || '',
            });
          },
          onOutput: options.verbose ? (msg) => console.log(pc.dim(msg)) : undefined,
        });

        // Collect bugs from failed results
        const resultsFile = path.join(runDir, `${module.folder}-results.json`);
        const bugs: Array<{ testCaseId: string; severity: 'Critical' | 'High' | 'Medium' | 'Low'; reason: string }> = [];
        if (fs.existsSync(resultsFile)) {
          const moduleResults = JSON.parse(fs.readFileSync(resultsFile, 'utf-8')) as Array<{ testId: string; status: string; actual: string }>;
          for (const r of moduleResults) {
            if (r.status === 'failed') {
              const severity = r.actual.toLowerCase().includes('crash') ? 'Critical' as const
                : r.actual.toLowerCase().includes('not found') ? 'High' as const
                : 'Medium' as const;
              bugs.push({ testCaseId: r.testId, severity, reason: r.actual.slice(0, 100) });
            }
          }
        }

        // Load untestable steps from prompt/02-untestable-flows.md
        const untestableSteps = loadUntestableSteps(config.promptDir, module.name);

        // Key findings (generated from results)
        const keyFindings = generateKeyFindings(agent);

        await finalizeReport(excelPath, module.name,
          {
            total: agent.testCasesPassed + agent.testCasesFailed + agent.testCasesSkipped,
            passed: agent.testCasesPassed,
            failed: agent.testCasesFailed,
            skipped: agent.testCasesSkipped,
          },
          bugs,
          keyFindings,
          untestableSteps
        );

        return agent;
      })
    );

    allResults.push(...results);
    updateMetadata(runDir, results);
    renderProgress(results, false);
  }

  await mcpPool.disconnectAll();

  // Merge reports
  s.start('Merging reports...');
  try {
    const reportPath = await mergeReports(config, runDir, allResults);
    s.stop(`Report: ${reportPath}`);
  } catch (err) {
    s.stop('Merge failed.');
    p.log.error(err instanceof Error ? err.message : 'Error');
  }

  // Summary
  printFinalSummary(allResults);

  // Generate report.md + defect-analysis.json
  generateReport(runDir, allResults);
  p.log.info(pc.dim(`Report: ${path.join(runDir, 'report.md')}`));

  const failed = allResults.filter((a) => a.status === 'failed' || a.status === 'timeout');
  if (failed.length > 0) {
    p.log.warn(`${failed.length} module(s) failed. Use --resume to retry.`);
  }

  p.outro(pc.green('Done! ') + pc.dim(`Results: ${runDir}`));
}

main().catch((err) => {
  console.error(pc.red('Fatal:'), err);
  process.exit(1);
});

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Loads untestable steps from prompt/02-untestable-flows.md.
 */
function loadUntestableSteps(promptDir: string, moduleName: string): Array<{ module: string; step: string; reason: string }> {
  const filePath = path.join(promptDir, '02-untestable-flows.md');
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf-8');
  const steps: Array<{ module: string; step: string; reason: string }> = [];

  // Parse markdown bullet points: "- Step X: reason"
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*]\s+(.+?):\s+(.+)/);
    if (match) {
      steps.push({ module: moduleName, step: match[1].trim(), reason: match[2].trim() });
    }
  }

  return steps;
}

/**
 * Generates key findings from agent results.
 */
function generateKeyFindings(agent: AgentProcess): string[] {
  const findings: string[] = [];
  const total = agent.testCasesPassed + agent.testCasesFailed + agent.testCasesSkipped;
  const passRate = total > 0 ? ((agent.testCasesPassed / total) * 100).toFixed(0) : '0';

  if (agent.testCasesFailed === 0) {
    findings.push(`${agent.moduleName}: All ${total} tests passed (100% pass rate)`);
  } else {
    findings.push(`${agent.moduleName}: ${agent.testCasesFailed} failure(s) detected (${passRate}% pass rate)`);
  }

  if (agent.testCasesSkipped > 0) {
    findings.push(`${agent.moduleName}: ${agent.testCasesSkipped} test(s) skipped — check untestable boundaries`);
  }

  if (parseInt(passRate) < 70) {
    findings.push(`${agent.moduleName}: LOW pass rate — module may have critical issues`);
  }

  return findings;
}
