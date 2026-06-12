/**
 * Module discovery and dependency resolution.
 * Reads e2e-tests/ directory structure and module-order.yaml.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ModuleDefinition, ModuleOrder, OrchestratorConfig } from './types.js';

/**
 * Reads module-order.yaml to get execution order and dependencies.
 * If file doesn't exist, auto-discovers modules from directory structure.
 *
 * @param config - Orchestrator config
 * @returns Array of module definitions in execution order
 */
export function loadModuleOrder(config: OrchestratorConfig): ModuleDefinition[] {
  const orderFile = path.join(config.e2eTestsDir, 'module-order.yaml');

  if (fs.existsSync(orderFile)) {
    const content = fs.readFileSync(orderFile, 'utf-8');
    const parsed = parseYaml(content) as ModuleOrder;
    return parsed.modules;
  }

  // Auto-discover modules from directory structure
  return discoverModules(config.e2eTestsDir);
}

/**
 * Auto-discovers test modules from e2e-tests/ subdirectories.
 * Each subdirectory containing .yaml files is treated as a module.
 *
 * @param e2eTestsDir - Path to e2e-tests directory
 * @returns Array of discovered module definitions (no dependency info)
 */
function discoverModules(e2eTestsDir: string): ModuleDefinition[] {
  if (!fs.existsSync(e2eTestsDir)) {
    return [];
  }

  const entries = fs.readdirSync(e2eTestsDir, { withFileTypes: true });
  const modules: ModuleDefinition[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const modulePath = path.join(e2eTestsDir, entry.name);
    const yamlFiles = fs.readdirSync(modulePath).filter((f) => f.endsWith('.yaml'));

    if (yamlFiles.length > 0) {
      modules.push({
        name: folderToName(entry.name),
        folder: entry.name,
      });
    }
  }

  return modules;
}

/**
 * Counts test cases (YAML files) in a module folder.
 *
 * @param config - Orchestrator config
 * @param moduleFolder - Module folder name
 * @returns Number of test case YAML files
 */
export function countTestCases(config: OrchestratorConfig, moduleFolder: string): number {
  const modulePath = path.join(config.e2eTestsDir, moduleFolder);
  if (!fs.existsSync(modulePath)) return 0;

  return fs.readdirSync(modulePath).filter((f) => f.endsWith('.yaml')).length;
}

/**
 * Resolves execution groups based on dependencies.
 * Modules with no dependencies run in the first group.
 * Modules depending on others run after their dependencies complete.
 *
 * @param modules - All module definitions
 * @returns Array of groups — each group can run in parallel
 */
export function resolveExecutionGroups(modules: ModuleDefinition[]): ModuleDefinition[][] {
  const groups: ModuleDefinition[][] = [];
  const resolved = new Set<string>();
  const remaining = [...modules];

  while (remaining.length > 0) {
    const group: ModuleDefinition[] = [];

    for (let i = remaining.length - 1; i >= 0; i--) {
      const mod = remaining[i];
      const deps = mod.depends_on ?? [];
      const allDepsResolved = deps.every((dep) => resolved.has(dep));

      if (allDepsResolved) {
        group.push(mod);
        remaining.splice(i, 1);
      }
    }

    if (group.length === 0) {
      // Circular dependency detected — force-add remaining
      console.warn('⚠️  Circular dependency detected. Force-running remaining modules.');
      groups.push(remaining.splice(0));
      break;
    }

    groups.push(group);
    for (const mod of group) {
      resolved.add(mod.folder);
      resolved.add(mod.name);
    }
  }

  return groups;
}

/**
 * Filters modules by user selection.
 *
 * @param modules - All available modules
 * @param selected - User-selected module names (from --modules flag)
 * @returns Filtered module list
 */
export function filterModules(modules: ModuleDefinition[], selected?: string[]): ModuleDefinition[] {
  if (!selected || selected.length === 0) return modules;

  const selectedLower = new Set(selected.map((s) => s.toLowerCase()));

  return modules.filter(
    (m) => selectedLower.has(m.name.toLowerCase()) || selectedLower.has(m.folder.toLowerCase())
  );
}

/**
 * Reads version.yaml for test case version info.
 *
 * @param config - Orchestrator config
 * @returns Version string or "unknown"
 */
export function readTcVersion(config: OrchestratorConfig): string {
  const versionFile = path.join(config.e2eTestsDir, 'version.yaml');
  if (!fs.existsSync(versionFile)) return 'unknown';

  const content = fs.readFileSync(versionFile, 'utf-8');
  const parsed = parseYaml(content) as { version?: string };
  return parsed.version ?? 'unknown';
}

/**
 * Converts a kebab-case folder name to a display name.
 * e.g., "home-navigation" → "Home Navigation"
 */
function folderToName(folder: string): string {
  return folder
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
