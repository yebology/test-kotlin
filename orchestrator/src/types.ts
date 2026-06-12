/**
 * Core type definitions for the E2E orchestrator.
 */

/** Module execution status */
export type ModuleStatus = 'pending' | 'running' | 'passed' | 'failed' | 'timeout' | 'skipped';

/** Individual test case result */
export type TestCaseStatus = 'passed' | 'failed' | 'skipped';

/** Severity levels for bug classification */
export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Module dependency information from module-order.yaml */
export interface ModuleOrder {
  modules: ModuleDefinition[];
}

export interface ModuleDefinition {
  name: string;
  folder: string;
  depends_on?: string[];
}

/** Emulator information */
export interface Emulator {
  id: string;
  port: number;
  name: string;
  status: 'booting' | 'ready' | 'busy' | 'error';
  assignedModule?: string;
}

/** Agent process tracking */
export interface AgentProcess {
  moduleFolder: string;
  moduleName: string;
  deviceId: string;
  port: number;
  pid?: number;
  status: ModuleStatus;
  startTime?: number;
  endTime?: number;
  testCasesTotal: number;
  testCasesPassed: number;
  testCasesFailed: number;
  testCasesSkipped: number;
  error?: string;
}

/** Test case from YAML file */
export interface TestCase {
  id: string;
  module: string;
  userFlow: string;
  scenario: string;
  steps: TestStep[];
  expectedResult: string;
}

export interface TestStep {
  action: string;
  target?: string;
  value?: string;
  assertion?: string;
}

/** Test result after execution */
export interface TestResult {
  testCaseId: string;
  module: string;
  userFlow: string;
  scenario: string;
  steps: string;
  expectedResult: string;
  status: TestCaseStatus;
  actualResult: string;
  screenshot?: string;
  duration?: number;
}

/** Module execution result */
export interface ModuleResult {
  moduleName: string;
  moduleFolder: string;
  status: ModuleStatus;
  testResults: TestResult[];
  startTime: number;
  endTime: number;
  error?: string;
}

/** CLI options parsed from command line */
export interface CliOptions {
  modules?: string[];
  workers: number;
  resume: boolean;
  verbose: boolean;
  timeout: number;
  apkPath?: string;
  generate?: GenerateSource;
  compare?: boolean;
  model?: string;
}

/** Source types for generation */
export type GenerateSource = 'codebase' | 'requirements' | 'excel';

/** Orchestrator configuration */
export interface OrchestratorConfig {
  projectRoot: string;
  e2eTestsDir: string;
  e2eRunsDir: string;
  promptDir: string;
  maxWorkers: number;
  timeoutMs: number;
  retryCount: number;
  batchSize: number;
}

/** Run metadata stored in metadata.yaml */
export interface RunMetadata {
  runId: string;
  startTime: string;
  endTime?: string;
  tcVersion: string;
  device: string;
  modules: ModuleRunMeta[];
  status: 'in-progress' | 'completed' | 'partial';
}

export interface ModuleRunMeta {
  name: string;
  folder: string;
  status: ModuleStatus;
  deviceId: string;
  testCasesTotal: number;
  testCasesPassed: number;
  testCasesFailed: number;
  testCasesSkipped: number;
  attempts: number;
}
