/**
 * Test script generator — Claude API agent that reads source code, requirements,
 * or Excel test plans and generates YAML test scripts.
 *
 * Fixes:
 * - #1: Excel (.xlsx) input support via read_excel tool
 * - #12: Full skip logic / untestable boundary rules
 * - #14: version.yaml increment enforced
 * - #16: Verbatim test case IDs from Excel
 * - #18: Full prompt/ auto-generation (all 5 files)
 */

import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { execaCommand } from 'execa';
import type { OrchestratorConfig, GenerateSource } from './types.js';
import { type ModelConfig, getApiKey, getBaseUrl } from './models.js';

export type { GenerateSource };

const MAX_TURNS = 80;

/**
 * Tools for the generator agent — OpenAI function calling format.
 */
const GENERATOR_TOOLS = [
  {
    name: 'list_directory',
    description: 'List files and subdirectories in a directory.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to directory' },
        recursive: { type: 'boolean', description: 'If true, list recursively (max 3 levels)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file (max 50KB returned).',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'read_excel',
    description: 'Read an Excel (.xlsx) file. Returns sheet names, headers, and row data as structured text.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to .xlsx file' },
        sheet: { type: 'string', description: 'Sheet name (optional, defaults to all)' },
        maxRows: { type: 'number', description: 'Max rows (default 500)' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'find_files',
    description: 'Find files matching a pattern (e.g., "*.kt", "*.xlsx", "*.md").',
    input_schema: {
      type: 'object' as const,
      properties: {
        directory: { type: 'string' },
        pattern: { type: 'string', description: 'File name pattern' },
      },
      required: ['directory', 'pattern'],
    },
  },
];

/**
 * Executes generator tools — including the new read_excel.
 */
async function executeGeneratorTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case 'list_directory': {
        const dirPath = input.path as string;
        const recursive = input.recursive as boolean ?? false;
        if (!fs.existsSync(dirPath)) return `Directory not found: ${dirPath}`;

        if (recursive) {
          const result = await execaCommand(`find "${dirPath}" -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" | head -300`, { reject: false });
          return result.stdout || 'Empty directory';
        }

        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        return entries.map((e) => `${e.isDirectory() ? '[dir]' : '[file]'} ${e.name}`).join('\n');
      }

      case 'read_file': {
        const filePath = input.path as string;
        if (!fs.existsSync(filePath)) return `File not found: ${filePath}`;
        const stat = fs.statSync(filePath);
        if (stat.size > 50_000) {
          return fs.readFileSync(filePath, 'utf-8').slice(0, 50_000) + '\n[truncated]';
        }
        return fs.readFileSync(filePath, 'utf-8');
      }

      case 'read_excel': {
        return await readExcelFile(
          input.path as string,
          input.sheet as string | undefined,
          (input.maxRows as number) || 500
        );
      }

      case 'write_file': {
        const filePath = input.path as string;
        const content = input.content as string;
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, content, 'utf-8');
        return `Written: ${filePath} (${content.length} bytes)`;
      }

      case 'find_files': {
        const directory = input.directory as string;
        const pattern = input.pattern as string;
        if (!fs.existsSync(directory)) return `Directory not found: ${directory}`;
        const result = await execaCommand(
          `find "${directory}" -name "${pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" -type f | head -100`,
          { reject: false }
        );
        return result.stdout || 'No files found.';
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : 'Unknown'}`;
  }
}

/**
 * Reads an Excel file and returns structured text representation.
 * This allows Claude to understand Excel content without binary parsing.
 */
async function readExcelFile(filePath: string, sheetName?: string, maxRows = 500): Promise<string> {
  if (!fs.existsSync(filePath)) return `File not found: ${filePath}`;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const output: string[] = [];
  output.push(`Excel file: ${path.basename(filePath)}`);
  output.push(`Sheets: ${workbook.worksheets.map((s) => s.name).join(', ')}`);
  output.push('');

  const sheets = sheetName
    ? workbook.worksheets.filter((s) => s.name === sheetName)
    : workbook.worksheets;

  for (const sheet of sheets) {
    output.push(`=== Sheet: "${sheet.name}" (${sheet.rowCount} rows) ===`);

    let rowCount = 0;
    sheet.eachRow((row, rowNum) => {
      if (rowCount >= maxRows) return;
      const cells = row.values as (string | number | null)[];
      // row.values is 1-indexed, skip index 0
      const values = cells.slice(1).map((v) => {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object' && 'text' in v) return (v as { text: string }).text;
        if (typeof v === 'object' && 'result' in v) return String((v as { result: unknown }).result);
        return String(v);
      });
      output.push(`Row ${rowNum}: ${values.join(' | ')}`);
      rowCount++;
    });

    output.push('');
  }

  return output.join('\n');
}

/**
 * Builds system prompt for the generator based on source type.
 */
function buildGeneratorSystemPrompt(config: OrchestratorConfig, source: GenerateSource): string {
  return `You are a senior QA automation engineer generating E2E test scripts for a mobile app.

## Project Paths
- Project root: ${config.projectRoot}
- Test output: ${config.e2eTestsDir}
- Prompt context: ${config.promptDir}

## Your Task
${source === 'codebase' ? CODEBASE_INSTRUCTIONS : source === 'requirements' ? REQUIREMENTS_INSTRUCTIONS : EXCEL_INSTRUCTIONS}

## YAML Test Script Schema
\`\`\`yaml
name: string
description: string
platform: [android, ios]
precondition: string
source_file: string
test_type: happy_path | negative | boundary | state_transition | edge_case
requirement_id: string  # If from requirements/Excel

steps:
  - action: tap | type | swipe | assert | wait | press_button | clear
    target:
      label: string      # accessibility label (preferred)
      text: string       # visible text (fallback)
    text: string         # For type action — SPECIFIC test data
    direction: up|down|left|right
    button: BACK|HOME
    duration: number     # ms for wait
    condition:           # For assert
      element:
        label: string
        text: string
      text_contains: string
      text_equals: string
      exists: boolean
      not_exists: boolean
    screenshot: boolean
    description: string
\`\`\`

## Output Requirements
1. Write YAML files to: ${config.e2eTestsDir}/{module-name}/
2. Create \`module-order.yaml\` at ${config.e2eTestsDir}/ root with dependency order.
3. Create/increment \`version.yaml\`:
   \`\`\`yaml
   version: "N"  # increment if exists
   generated_date: "YYYY-MM-DD"
   generated_from: "${source}"
   total_test_cases: N
   \`\`\`
4. Create \`coverage.yaml\` listing element/requirement coverage.
5. Generate ALL 5 prompt/ context files:
   - \`${config.promptDir}/00-prerequisites.md\`
   - \`${config.promptDir}/01-testable-flows.md\`
   - \`${config.promptDir}/02-untestable-flows.md\`
   - \`${config.promptDir}/03-navigation-guide.md\`
   - \`${config.promptDir}/04-known-issues.md\`

## Critical Rules
- THIS IS A DEV/TEST ENVIRONMENT. Creating accounts, modifying data = ALL ALLOWED.
- Untestable = per STEP, never per FLOW. Test ALL steps up to the untestable boundary.
- Only valid untestable: OTP from external email, real payment, physical hardware, third-party WebView.
- If generating from Excel: PRESERVE EXACT test case IDs and expected results VERBATIM. Never rephrase.
- Minimum 3-5 test cases per feature (happy, negative, boundary).
- Each test must have SPECIFIC test data and SPECIFIC expected results.

## Completion
Output summary: modules created, total test cases, coverage percentage.
`;
}

const CODEBASE_INSTRUCTIONS = `Scan the app's source code to generate test scripts.

1. Read prompt/ folder first (if exists) — preserve existing user content, merge new info.
2. Deep scan: find all UI source files (*.kt @Composable, *.swift View, *.xml layouts).
3. Identify screens, interactive elements, navigation, state management.
4. Generate prompt/ files (00-prerequisites through 04-known-issues).
5. Generate YAML test scripts per module — comprehensive: happy path, negative, boundary, edge cases.
6. Save in e2e-tests/{module-name}/ with module-order.yaml for dependencies.`;

const REQUIREMENTS_INSTRUCTIONS = `Parse requirement documents and generate test scripts with traceability.

1. Read prompt/ folder first (if exists).
2. Find and read all docs in docs/, requirements/, root (*.md, *.txt).
3. Extract testable requirements and acceptance criteria.
4. Generate YAML scripts with requirement_id field.
5. Generate traceability.yaml mapping requirements → test scripts.
6. Priority: critical flows > business rules > error states. 2-3 high-value tests per requirement.`;

const EXCEL_INSTRUCTIONS = `Read Excel test plan (.xlsx) and convert to executable YAML scripts.

1. Read prompt/ folder first (if exists).
2. Find .xlsx files in docs/, requirements/, or root — use read_excel tool to parse them.
3. Identify columns: Test Steps, Expected Results, Test Scenario, Test No., Module/Flow.
4. For each row with test steps + expected results:
   - Determine module (from Module/Flow/Sprint column or sheet name)
   - Convert to YAML format
   - PRESERVE EXACT test case IDs verbatim — never rename or rephrase
   - PRESERVE EXACT expected results verbatim — copy word-for-word
5. Generate module-order.yaml, prompt/ files, version.yaml.
6. Output summary.`;

/**
 * Runs the generator agent using the selected model (OpenAI).
 */
export async function runGenerator(
  config: OrchestratorConfig,
  source: GenerateSource,
  model: ModelConfig,
  onProgress?: (message: string) => void
): Promise<string> {
  const apiKey = getApiKey(model);
  if (!apiKey) throw new Error(`API key not set: ${model.envKey}`);

  const systemPrompt = buildGeneratorSystemPrompt(config, source);

  const userMessage = source === 'excel'
    ? `Generate test scripts from Excel (.xlsx) files in docs/ or project root. Project root: ${config.projectRoot}`
    : `Generate E2E test scripts from the ${source}. Project root: ${config.projectRoot}. Start by listing the project structure.`;

  // OpenAI chat completions with tool use
  const messages: Array<{ role: string; content: string | Array<unknown>; tool_call_id?: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  let summary = '';

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    onProgress?.(`Turn ${turn + 1}/${MAX_TURNS}...`);

    const response = await callOpenAI(apiKey, model.apiModel, messages, getBaseUrl(model));

    // Check if done (no tool calls)
    if (!response.tool_calls || response.tool_calls.length === 0) {
      summary = response.content || '';
      onProgress?.('Generation complete.');
      break;
    }

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      content: response.content || '',
      ...({ tool_calls: response.tool_calls } as Record<string, unknown>),
    } as never);

    // Execute each tool call
    for (const toolCall of response.tool_calls) {
      onProgress?.(`  🔧 ${toolCall.function.name}: ${toolCall.function.arguments.slice(0, 80)}...`);

      const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      const result = await executeGeneratorTool(toolCall.function.name, input);

      messages.push({
        role: 'tool',
        content: result.slice(0, 15_000),
        tool_call_id: toolCall.id,
      } as never);
    }
  }

  return summary;
}

/**
 * Calls OpenAI chat completions API with tools.
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: unknown[],
  baseUrl?: string
): Promise<{ content: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }> {
  const tools = GENERATOR_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }));

  const url = `${baseUrl || 'https://api.openai.com/v1'}/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
      };
    }>;
  };

  const msg = data.choices[0]?.message;
  return {
    content: msg?.content || '',
    tool_calls: msg?.tool_calls,
  };
}
