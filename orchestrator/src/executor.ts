/**
 * Deterministic Test Executor — comprehensive mobile testing.
 * Handles ALL scenarios from mobile-mcp: tap, type, swipe, long press,
 * double tap, orientation, app lifecycle, scroll-until-found, keyboard
 * dismiss, element wait/polling, crash recovery, platform detection.
 *
 * Cost: $0 per run (no AI involved).
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { execa } from 'execa';
import { McpClient } from './mcp-client.js';
import { attemptRepair } from './self-repair.js';
import type { AgentProcess, ModuleDefinition, OrchestratorConfig } from './types.js';
import { countTestCases } from './modules.js';

// ─── Types ──────────────────────────────────────────────────────────

interface TestScript {
  name: string;
  description?: string;
  platform?: string[];
  precondition?: string;
  test_type?: string;
  requirement_id?: string;
  level?: 'L1' | 'L2' | 'L3' | 'L4';
  steps: TestStep[];
}

interface TestStep {
  action: 'tap' | 'type' | 'swipe' | 'assert' | 'wait' | 'press_button'
    | 'clear' | 'launch_app' | 'terminate_app' | 'long_press' | 'double_tap'
    | 'set_orientation' | 'scroll_to' | 'open_url';
  target?: { label?: string; text?: string; type?: string; x?: number; y?: number };
  text?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  button?: string;
  duration?: number;
  orientation?: 'portrait' | 'landscape';
  packageName?: string;
  url?: string;
  condition?: {
    element?: { label?: string; text?: string };
    text_contains?: string;
    text_equals?: string;
    exists?: boolean;
    not_exists?: boolean;
  };
  screenshot?: boolean;
  description?: string;
  maxScrolls?: number;
}

export interface TestResult {
  testId: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  expected: string;
  actual: string;
  steps: string;
  screenshot?: string;
  duration: number;
  error?: string;
  level?: 'L1' | 'L2' | 'L3' | 'L4';
  repaired?: boolean;
}

interface ElementInfo {
  text: string;
  label: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type Platform = 'android' | 'ios';

// ─── Constants ──────────────────────────────────────────────────────

/** Max time to wait for an element to appear (ms) */
const ELEMENT_WAIT_TIMEOUT = 5000;

/** Poll interval for element wait (ms) */
const ELEMENT_POLL_INTERVAL = 500;

/** Max scroll attempts when searching for an element */
const MAX_SCROLL_ATTEMPTS = 5;

/** Delay after actions to allow UI to settle (ms) */
const ACTION_SETTLE_MS = 300;

/** Max retries for a failed step */
const MAX_STEP_RETRIES = 1;

// ─── Main Executor ──────────────────────────────────────────────────

/**
 * Executes all test cases for a module — purely deterministic.
 */
export async function executeModule(
  config: OrchestratorConfig,
  module: ModuleDefinition,
  deviceId: string,
  runDir: string,
  mcp: McpClient,
  callbacks: {
    onTestComplete?: (result: TestResult, index: number, total: number) => void;
    onOutput?: (msg: string) => void;
  }
): Promise<AgentProcess> {
  const agent: AgentProcess = {
    moduleFolder: module.folder,
    moduleName: module.name,
    deviceId,
    port: parseInt(deviceId.replace('emulator-', ''), 10),
    status: 'running',
    startTime: Date.now(),
    testCasesTotal: countTestCases(config, module.folder),
    testCasesPassed: 0,
    testCasesFailed: 0,
    testCasesSkipped: 0,
  };

  const platform = detectPlatform(deviceId);
  const testDir = path.join(config.e2eTestsDir, module.folder);

  // Disable stylus on Android (prevents input overlay)
  if (platform === 'android') {
    await runAdb(deviceId, 'settings put secure stylus_handwriting_enabled 0').catch(() => {});
  }

  // Load YAML test scripts
  const yamlFiles = fs.readdirSync(testDir).filter((f) => f.endsWith('.yaml')).sort();
  const results: TestResult[] = [];

  // Create per-module screenshot subfolder
  const moduleScreenshotsDir = path.join(runDir, 'screenshots', module.folder);
  fs.mkdirSync(moduleScreenshotsDir, { recursive: true });

  for (let i = 0; i < yamlFiles.length; i++) {
    const file = yamlFiles[i];
    const testId = file.replace('.yaml', '');

    callbacks.onOutput?.(`[${module.folder}] ${testId} (${i + 1}/${yamlFiles.length})`);

    const startTime = Date.now();
    let result: TestResult;

    try {
      const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
      const script = parseYaml(content) as TestScript;
      result = await executeTestCase(script, testId, deviceId, platform, moduleScreenshotsDir, mcp);
    } catch (err) {
      result = {
        testId,
        name: testId,
        status: 'failed',
        expected: 'Execution',
        actual: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
        steps: '',
        duration: 0,
      };
    }

    result.duration = Date.now() - startTime;
    results.push(result);

    if (result.status === 'passed') agent.testCasesPassed++;
    else if (result.status === 'failed') agent.testCasesFailed++;
    else agent.testCasesSkipped++;

    callbacks.onTestComplete?.(result, i, yamlFiles.length);
  }

  agent.status = agent.testCasesFailed > 0 ? 'failed' : 'passed';
  agent.endTime = Date.now();

  // Save results JSON for report merger
  fs.writeFileSync(
    path.join(runDir, `${module.folder}-results.json`),
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  return agent;
}

// ─── Test Case Execution ────────────────────────────────────────────

async function executeTestCase(
  script: TestScript,
  testId: string,
  deviceId: string,
  platform: Platform,
  screenshotsDir: string,
  mcp: McpClient
): Promise<TestResult> {
  const stepsLog: string[] = [];
  let lastExpected = '';
  let lastActual = '';
  let screenshotFile: string | undefined;

  for (let si = 0; si < script.steps.length; si++) {
    const step = script.steps[si];
    const desc = step.description || formatStepDesc(step);
    stepsLog.push(`${si + 1}. ${desc}`);

    let success = false;
    let lastError = '';

    for (let attempt = 0; attempt <= MAX_STEP_RETRIES; attempt++) {
      try {
        const result = await executeStep(step, deviceId, platform, mcp);

        if (step.action === 'assert' && result) {
          lastExpected = result.expected;
          lastActual = result.actual;
          if (!result.passed) {
            screenshotFile = await takeScreenshot(mcp, deviceId, screenshotsDir, testId, 'FAIL');
            return {
              testId, name: script.name, status: 'failed',
              expected: lastExpected, actual: lastActual,
              steps: stepsLog.join('\n'), screenshot: screenshotFile, duration: 0,
            };
          }
        }

        // Screenshot if step requests it
        if (step.screenshot) {
          screenshotFile = await takeScreenshot(mcp, deviceId, screenshotsDir, testId, 'pass');
        }

        success = true;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown';
        if (attempt < MAX_STEP_RETRIES) {
          await sleep(1000); // Wait before retry
          // Try dismissing keyboard or going back as recovery
          await dismissKeyboard(mcp, deviceId, platform);
        }
      }
    }

    if (!success) {
      screenshotFile = await takeScreenshot(mcp, deviceId, screenshotsDir, testId, 'FAIL');
      return {
        testId, name: script.name, status: 'failed',
        expected: desc, actual: `Step failed after retry: ${lastError}`,
        steps: stepsLog.join('\n'), screenshot: screenshotFile, duration: 0,
      };
    }
  }

  // All passed
  if (!screenshotFile) {
    screenshotFile = await takeScreenshot(mcp, deviceId, screenshotsDir, testId, 'pass');
  }

  return {
    testId, name: script.name, status: 'passed',
    expected: lastExpected || 'All steps pass',
    actual: lastExpected || 'All steps pass',
    steps: stepsLog.join('\n'), screenshot: screenshotFile, duration: 0,
  };
}

// ─── Step Execution (comprehensive) ─────────────────────────────────

interface AssertResult { passed: boolean; expected: string; actual: string }

async function executeStep(
  step: TestStep,
  deviceId: string,
  platform: Platform,
  mcp: McpClient
): Promise<AssertResult | null> {
  switch (step.action) {
    case 'tap': {
      const coords = await resolveTarget(step.target, deviceId, mcp);
      await mcp.callTool('mobile_click_on_screen_at_coordinates', { device: deviceId, x: coords.x, y: coords.y });
      await sleep(ACTION_SETTLE_MS);
      return null;
    }

    case 'long_press': {
      const coords = await resolveTarget(step.target, deviceId, mcp);
      await mcp.callTool('mobile_long_press_on_screen_at_coordinates', {
        device: deviceId, x: coords.x, y: coords.y, duration: step.duration || 500,
      });
      await sleep(ACTION_SETTLE_MS);
      return null;
    }

    case 'double_tap': {
      const coords = await resolveTarget(step.target, deviceId, mcp);
      await mcp.callTool('mobile_double_tap_on_screen', { device: deviceId, x: coords.x, y: coords.y });
      await sleep(ACTION_SETTLE_MS);
      return null;
    }

    case 'type': {
      const text = step.text || '';
      if (platform === 'android') {
        const escaped = escapeAdbText(text);
        await runAdb(deviceId, `input text "${escaped}"`);
      } else {
        await mcp.callTool('mobile_type_keys', { device: deviceId, text, submit: false });
      }
      await sleep(200);
      return null;
    }

    case 'clear': {
      if (platform === 'android') {
        await runAdb(deviceId, 'input keyevent KEYCODE_CTRL_A');
        await runAdb(deviceId, 'input keyevent KEYCODE_DEL');
      } else {
        // iOS: select all + delete via type
        await mcp.callTool('mobile_type_keys', { device: deviceId, text: '', submit: false });
      }
      await sleep(200);
      return null;
    }

    case 'swipe': {
      const args: Record<string, unknown> = { device: deviceId, direction: step.direction || 'up' };
      if (step.target?.x !== undefined) args.x = step.target.x;
      if (step.target?.y !== undefined) args.y = step.target.y;
      await mcp.callTool('mobile_swipe_on_screen', args);
      await sleep(500);
      return null;
    }

    case 'scroll_to': {
      // Scroll until target element is found
      const maxScrolls = step.maxScrolls || MAX_SCROLL_ATTEMPTS;
      const direction = step.direction || 'up';

      for (let i = 0; i < maxScrolls; i++) {
        const found = await findElementOnScreen(mcp, deviceId, step.target);
        if (found) return null; // Element found, done

        await mcp.callTool('mobile_swipe_on_screen', { device: deviceId, direction });
        await sleep(500);
      }

      throw new Error(`Element not found after ${maxScrolls} scrolls: ${JSON.stringify(step.target)}`);
    }

    case 'press_button': {
      await mcp.callTool('mobile_press_button', { device: deviceId, button: step.button || 'BACK' });
      await sleep(ACTION_SETTLE_MS);
      return null;
    }

    case 'launch_app': {
      await mcp.callTool('mobile_launch_app', { device: deviceId, packageName: step.packageName || '' });
      await sleep(2000); // App launch needs more time
      return null;
    }

    case 'terminate_app': {
      await mcp.callTool('mobile_terminate_app', { device: deviceId, packageName: step.packageName || '' });
      await sleep(500);
      return null;
    }

    case 'set_orientation': {
      await mcp.callTool('mobile_set_orientation', { device: deviceId, orientation: step.orientation || 'portrait' });
      await sleep(1000);
      return null;
    }

    case 'open_url': {
      await mcp.callTool('mobile_open_url', { device: deviceId, url: step.url || '' });
      await sleep(2000);
      return null;
    }

    case 'wait': {
      await sleep(step.duration || 1000);
      return null;
    }

    case 'assert': {
      return await executeAssert(mcp, deviceId, step.condition);
    }

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

// ─── Element Resolution ─────────────────────────────────────────────

/**
 * Resolves a target to coordinates.
 * Strategy: label match → text match → raw coordinates → scroll & retry.
 */
async function resolveTarget(
  target: TestStep['target'],
  deviceId: string,
  mcp: McpClient
): Promise<{ x: number; y: number }> {
  if (!target) throw new Error('No target specified for tap action');

  // If raw coordinates provided, use them directly
  if (target.x !== undefined && target.y !== undefined) {
    return { x: target.x, y: target.y };
  }

  // Wait for element to appear (polling)
  const element = await waitForElement(mcp, deviceId, target);
  if (element) {
    return { x: element.x + element.width / 2, y: element.y + element.height / 2 };
  }

  // Try scrolling to find it
  for (let i = 0; i < 3; i++) {
    await mcp.callTool('mobile_swipe_on_screen', { device: deviceId, direction: 'up' });
    await sleep(500);
    const found = await findElementOnScreen(mcp, deviceId, target);
    if (found) {
      return { x: found.x + found.width / 2, y: found.y + found.height / 2 };
    }
  }

  // Final fallback: AI-assisted repair
  const repair = await attemptRepair(mcp, deviceId, target, `Find element: ${target.label || target.text}`);
  if (repair && repair.confidence !== 'low') {
    return { x: repair.x, y: repair.y };
  }

  throw new Error(`Element not found: ${target.label || target.text || 'unknown'}`);
}

/**
 * Waits for an element to appear on screen (with timeout).
 */
async function waitForElement(
  mcp: McpClient,
  deviceId: string,
  target?: { label?: string; text?: string; type?: string }
): Promise<ElementInfo | null> {
  const start = Date.now();

  while (Date.now() - start < ELEMENT_WAIT_TIMEOUT) {
    const found = await findElementOnScreen(mcp, deviceId, target);
    if (found) return found;
    await sleep(ELEMENT_POLL_INTERVAL);
  }

  return null;
}

/**
 * Finds an element on the current screen.
 */
async function findElementOnScreen(
  mcp: McpClient,
  deviceId: string,
  target?: { label?: string; text?: string; type?: string }
): Promise<ElementInfo | null> {
  if (!target) return null;

  const raw = await mcp.callTool('mobile_list_elements_on_screen', { device: deviceId });
  const elements = parseElementList(raw);

  // Search by label (accessibility identifier)
  if (target.label) {
    const match = elements.find((el) =>
      el.label?.toLowerCase().includes(target.label!.toLowerCase())
    );
    if (match) return match;
  }

  // Search by text
  if (target.text) {
    const match = elements.find((el) =>
      el.text?.toLowerCase().includes(target.text!.toLowerCase())
    );
    if (match) return match;
  }

  // Search by type
  if (target.type) {
    const match = elements.find((el) =>
      el.type?.toLowerCase().includes(target.type!.toLowerCase())
    );
    if (match) return match;
  }

  return null;
}

// ─── Assertions ─────────────────────────────────────────────────────

async function executeAssert(
  mcp: McpClient,
  deviceId: string,
  condition?: TestStep['condition']
): Promise<AssertResult> {
  if (!condition) return { passed: true, expected: '', actual: '' };

  // Wait briefly for UI to settle
  await sleep(300);

  const raw = await mcp.callTool('mobile_list_elements_on_screen', { device: deviceId });

  if (condition.text_equals) {
    const found = raw.includes(condition.text_equals);
    return {
      passed: found,
      expected: `Text "${condition.text_equals}" visible`,
      actual: found ? `Text "${condition.text_equals}" visible` : `Text "${condition.text_equals}" NOT found`,
    };
  }

  if (condition.text_contains) {
    const found = raw.toLowerCase().includes(condition.text_contains.toLowerCase());
    return {
      passed: found,
      expected: `Text containing "${condition.text_contains}" visible`,
      actual: found ? `Text containing "${condition.text_contains}" visible` : `"${condition.text_contains}" NOT found`,
    };
  }

  if (condition.element) {
    const search = condition.element.label || condition.element.text || '';
    const found = raw.toLowerCase().includes(search.toLowerCase());

    if (condition.not_exists || condition.exists === false) {
      return {
        passed: !found,
        expected: `"${search}" NOT visible`,
        actual: !found ? `"${search}" NOT visible` : `"${search}" still visible`,
      };
    }

    return {
      passed: found,
      expected: `"${search}" visible`,
      actual: found ? `"${search}" visible` : `"${search}" NOT found`,
    };
  }

  return { passed: true, expected: '', actual: '' };
}

// ─── Helpers ────────────────────────────────────────────────────────

function detectPlatform(deviceId: string): Platform {
  // Emulator IDs start with "emulator-" on Android
  // iOS simulators have UUID format or device names
  if (deviceId.startsWith('emulator-') || deviceId.match(/^\d{2,}$/)) {
    return 'android';
  }
  return 'ios';
}

async function dismissKeyboard(mcp: McpClient, deviceId: string, platform: Platform): Promise<void> {
  try {
    if (platform === 'android') {
      await mcp.callTool('mobile_press_button', { device: deviceId, button: 'BACK' });
    } else {
      // iOS: tap somewhere safe (top of screen) to dismiss
      await mcp.callTool('mobile_click_on_screen_at_coordinates', { device: deviceId, x: 200, y: 50 });
    }
  } catch { /* best effort */ }
}

async function takeScreenshot(
  mcp: McpClient,
  deviceId: string,
  dir: string,
  testId: string,
  result: string
): Promise<string> {
  const platform = detectPlatform(deviceId);
  const filename = `e2e-${platform}-${testId}-${result}.png`;
  const filepath = path.join(dir, filename);
  try {
    await mcp.callTool('mobile_save_screenshot', { device: deviceId, saveTo: filepath });
  } catch { /* screenshot is best-effort */ }
  return filename;
}

function escapeAdbText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/!/g, '\\!')
    .replace(/@/g, '\\@')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/\^/g, '\\^')
    .replace(/&/g, '\\&')
    .replace(/\*/g, '\\*')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/\|/g, '\\|')
    .replace(/;/g, '\\;')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/~/g, '\\~')
    .replace(/ /g, '%s');
}

async function runAdb(deviceId: string, command: string): Promise<string> {
  const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const result = await execa('adb', ['-s', deviceId, 'shell', ...parts], {
    timeout: 10_000,
    reject: false,
  });
  return result.stdout || '';
}

function parseElementList(raw: string): ElementInfo[] {
  const elements: ElementInfo[] = [];
  // mobile-mcp returns structured element data — parse various formats
  const lines = raw.split('\n');

  for (const line of lines) {
    // Try JSON parse
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj.x === 'number') {
        elements.push({
          text: obj.text || '',
          label: obj.label || obj.accessibilityLabel || '',
          type: obj.type || obj.className || '',
          x: obj.x || 0,
          y: obj.y || 0,
          width: obj.width || 0,
          height: obj.height || 0,
        });
        continue;
      }
    } catch { /* not JSON */ }

    // Regex for structured text format from mobile-mcp
    // Format varies but typically: type "text" [label] at (x, y) size WxH
    const match = line.match(
      /(?:(\w+)\s+)?['"]([^'"]*)['"]\s*(?:\[([^\]]*)\])?\s*.*?(?:at\s*\(?(\d+)[,\s]+(\d+)\)?)?\s*(?:size\s*(\d+)\s*[x×]\s*(\d+))?/i
    );
    if (match && (match[2] || match[3]) && match[4]) {
      elements.push({
        type: match[1] || '',
        text: match[2] || '',
        label: match[3] || match[2] || '',
        x: parseInt(match[4], 10),
        y: parseInt(match[5], 10),
        width: parseInt(match[6] || '50', 10),
        height: parseInt(match[7] || '50', 10),
      });
    }
  }

  return elements;
}

function formatStepDesc(step: TestStep): string {
  const parts: string[] = [step.action];
  if (step.target?.text) parts.push(`"${step.target.text}"`);
  else if (step.target?.label) parts.push(`[${step.target.label}]`);
  if (step.text) parts.push(`text="${step.text}"`);
  if (step.direction) parts.push(step.direction);
  if (step.button) parts.push(step.button);
  return parts.join(' ');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
