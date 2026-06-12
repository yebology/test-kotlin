/**
 * Recipes — reusable mobile test pattern templates.
 * Each recipe generates YAML test steps for common mobile patterns.
 *
 * Usage in module-order.yaml:
 *   modules:
 *     - name: Sign In
 *       folder: sign-in
 *       recipes:
 *         - login-flow
 *         - form-validation
 */

import type { OrchestratorConfig } from './types.js';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

/** Recipe definition */
interface Recipe {
  id: string;
  name: string;
  description: string;
  /** Parameters the recipe accepts from module-order.yaml */
  params: string[];
  /** Generates YAML test script content */
  generate: (params: Record<string, unknown>) => object[];
}

/**
 * All available recipes.
 */
export const RECIPES: Recipe[] = [
  {
    id: 'login-flow',
    name: 'Login Flow',
    description: 'Standard email + password login with validation',
    params: ['emailField', 'passwordField', 'loginButton', 'successElement', 'testEmail', 'testPassword'],
    generate: (p) => [
      {
        name: 'Login - Valid Credentials',
        level: 'L2',
        test_type: 'happy_path',
        precondition: 'App on login screen',
        steps: [
          { action: 'tap', target: { label: p.emailField || 'Email' }, description: 'Focus email field' },
          { action: 'type', text: p.testEmail || 'test@example.com', description: 'Enter email' },
          { action: 'tap', target: { label: p.passwordField || 'Password' }, description: 'Focus password field' },
          { action: 'type', text: p.testPassword || 'Test123!', description: 'Enter password' },
          { action: 'press_button', button: 'BACK', description: 'Dismiss keyboard' },
          { action: 'tap', target: { text: p.loginButton || 'Login' }, description: 'Tap login' },
          { action: 'wait', duration: 2000 },
          { action: 'assert', condition: { element: { text: p.successElement || 'Home' }, exists: true }, screenshot: true },
        ],
      },
      {
        name: 'Login - Empty Fields',
        level: 'L2',
        test_type: 'negative',
        precondition: 'App on login screen',
        steps: [
          { action: 'tap', target: { text: p.loginButton || 'Login' }, description: 'Tap login without input' },
          { action: 'assert', condition: { text_contains: 'required' }, screenshot: true, description: 'Error shown' },
        ],
      },
      {
        name: 'Login - Wrong Password',
        level: 'L2',
        test_type: 'negative',
        precondition: 'App on login screen',
        steps: [
          { action: 'tap', target: { label: p.emailField || 'Email' } },
          { action: 'type', text: p.testEmail || 'test@example.com' },
          { action: 'tap', target: { label: p.passwordField || 'Password' } },
          { action: 'type', text: 'WrongPass999!' },
          { action: 'press_button', button: 'BACK' },
          { action: 'tap', target: { text: p.loginButton || 'Login' } },
          { action: 'wait', duration: 2000 },
          { action: 'assert', condition: { text_contains: 'invalid' }, screenshot: true, description: 'Error for wrong password' },
        ],
      },
    ],
  },
  {
    id: 'form-validation',
    name: 'Form Validation',
    description: 'Test form field validation (required, format, length)',
    params: ['fields', 'submitButton'],
    generate: (p) => {
      const fields = (p.fields as Array<{ name: string; label: string; required?: boolean }>) || [];
      const tests: object[] = [];

      // Submit empty form
      tests.push({
        name: 'Form - Submit Empty',
        level: 'L2',
        test_type: 'negative',
        steps: [
          { action: 'tap', target: { text: p.submitButton || 'Submit' }, description: 'Submit empty form' },
          { action: 'assert', condition: { text_contains: 'required' }, screenshot: true },
        ],
      });

      // Per-field validation
      for (const field of fields) {
        if (field.required) {
          tests.push({
            name: `Form - ${field.name} Required`,
            level: 'L2',
            test_type: 'negative',
            steps: [
              { action: 'tap', target: { label: field.label } },
              { action: 'tap', target: { text: p.submitButton || 'Submit' } },
              { action: 'assert', condition: { text_contains: 'required' }, screenshot: true },
            ],
          });
        }
      }

      return tests;
    },
  },
  {
    id: 'list-scroll',
    name: 'List Scroll & Load',
    description: 'Test scrollable lists (lazy load, pull-to-refresh)',
    params: ['listElement', 'itemCount'],
    generate: (p) => [
      {
        name: 'List - Scroll Down',
        level: 'L1',
        test_type: 'happy_path',
        steps: [
          { action: 'assert', condition: { element: { label: p.listElement || 'List' }, exists: true }, description: 'List visible' },
          { action: 'swipe', direction: 'up', description: 'Scroll down' },
          { action: 'wait', duration: 1000 },
          { action: 'assert', condition: { element: { label: p.listElement || 'List' }, exists: true }, screenshot: true, description: 'List still visible after scroll' },
        ],
      },
      {
        name: 'List - Pull to Refresh',
        level: 'L2',
        test_type: 'happy_path',
        steps: [
          { action: 'swipe', direction: 'down', description: 'Pull to refresh' },
          { action: 'wait', duration: 2000 },
          { action: 'assert', condition: { element: { label: p.listElement || 'List' }, exists: true }, screenshot: true, description: 'List reloaded' },
        ],
      },
    ],
  },
  {
    id: 'navigation-tabs',
    name: 'Tab Navigation',
    description: 'Test bottom nav / tab bar switching',
    params: ['tabs'],
    generate: (p) => {
      const tabs = (p.tabs as Array<{ name: string; label: string; expectedElement: string }>) || [];
      return tabs.map((tab) => ({
        name: `Nav - Switch to ${tab.name}`,
        level: 'L1',
        test_type: 'happy_path',
        steps: [
          { action: 'tap', target: { text: tab.label }, description: `Tap ${tab.name} tab` },
          { action: 'wait', duration: 500 },
          { action: 'assert', condition: { element: { text: tab.expectedElement }, exists: true }, screenshot: true, description: `${tab.name} screen loaded` },
        ],
      }));
    },
  },
  {
    id: 'crud-flow',
    name: 'CRUD Flow',
    description: 'Create → Read → Update → Delete lifecycle test',
    params: ['createButton', 'formFields', 'listElement', 'editButton', 'deleteButton'],
    generate: (p) => [
      {
        name: 'CRUD - Create Item',
        level: 'L3',
        test_type: 'happy_path',
        steps: [
          { action: 'tap', target: { text: p.createButton || 'Add' }, description: 'Open create form' },
          { action: 'wait', duration: 500 },
          { action: 'assert', condition: { text_contains: 'form' }, screenshot: true, description: 'Create form visible' },
        ],
      },
      {
        name: 'CRUD - Edit Item',
        level: 'L3',
        test_type: 'happy_path',
        steps: [
          { action: 'tap', target: { text: p.editButton || 'Edit' }, description: 'Open edit' },
          { action: 'wait', duration: 500 },
          { action: 'assert', condition: { text_contains: 'edit' }, screenshot: true, description: 'Edit form visible' },
        ],
      },
      {
        name: 'CRUD - Delete Item',
        level: 'L3',
        test_type: 'happy_path',
        steps: [
          { action: 'tap', target: { text: p.deleteButton || 'Delete' }, description: 'Tap delete' },
          { action: 'wait', duration: 500 },
          { action: 'assert', condition: { text_contains: 'confirm' }, description: 'Confirm dialog' },
          { action: 'tap', target: { text: 'Yes' }, description: 'Confirm delete' },
          { action: 'wait', duration: 1000 },
          { action: 'assert', condition: { element: { text: p.listElement || 'List' }, exists: true }, screenshot: true, description: 'Back to list' },
        ],
      },
    ],
  },
  {
    id: 'orientation-change',
    name: 'Orientation Change',
    description: 'Test portrait ↔ landscape transitions',
    params: ['verifyElement'],
    generate: (p) => [
      {
        name: 'Orientation - Landscape',
        level: 'L1',
        test_type: 'happy_path',
        steps: [
          { action: 'set_orientation', orientation: 'landscape', description: 'Switch to landscape' },
          { action: 'wait', duration: 1000 },
          { action: 'assert', condition: { element: { text: p.verifyElement || '' }, exists: true }, screenshot: true, description: 'UI adapts to landscape' },
          { action: 'set_orientation', orientation: 'portrait', description: 'Restore portrait' },
        ],
      },
    ],
  },
];

/**
 * Generates YAML test files from recipes defined in module-order.yaml.
 *
 * @param config - Orchestrator config
 */
export function generateFromRecipes(config: OrchestratorConfig): number {
  const orderFile = path.join(config.e2eTestsDir, 'module-order.yaml');
  if (!fs.existsSync(orderFile)) return 0;

  const content = fs.readFileSync(orderFile, 'utf-8');
  const order = parseModuleOrderWithRecipes(content);
  let generated = 0;

  for (const mod of order) {
    if (!mod.recipes || mod.recipes.length === 0) continue;

    const moduleDir = path.join(config.e2eTestsDir, mod.folder);
    fs.mkdirSync(moduleDir, { recursive: true });

    for (const recipeRef of mod.recipes) {
      const recipeId = typeof recipeRef === 'string' ? recipeRef : recipeRef.id;
      const recipeParams = typeof recipeRef === 'string' ? {} : recipeRef.params || {};

      const recipe = RECIPES.find((r) => r.id === recipeId);
      if (!recipe) continue;

      const tests = recipe.generate(recipeParams);

      for (let i = 0; i < tests.length; i++) {
        const test = tests[i] as { name: string };
        const filename = `${recipeId}-${String(i + 1).padStart(2, '0')}.yaml`;
        const filepath = path.join(moduleDir, filename);

        if (!fs.existsSync(filepath)) {
          fs.writeFileSync(filepath, stringifyYaml(test), 'utf-8');
          generated++;
        }
      }
    }
  }

  return generated;
}

/**
 * Lists all available recipes.
 */
export function listRecipes(): Array<{ id: string; name: string; description: string; params: string[] }> {
  return RECIPES.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    params: r.params,
  }));
}

function parseModuleOrderWithRecipes(content: string): Array<{ folder: string; recipes?: Array<string | { id: string; params: Record<string, unknown> }> }> {
  try {
    const parsed = parseYaml(content) as { modules?: Array<{ folder: string; recipes?: unknown[] }> };
    return (parsed.modules || []) as Array<{ folder: string; recipes?: Array<string | { id: string; params: Record<string, unknown> }> }>;
  } catch {
    return [];
  }
}
