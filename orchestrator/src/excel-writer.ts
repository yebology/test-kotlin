/**
 * Incremental Excel Report Writer — matches execute-test-scripts.kiro.hook EXACTLY.
 *
 * Sheet structure:
 *   1. "Executive Summary" — Module Overview, Bugs per module, Overall Metrics, Key Findings, Untestable Steps
 *   2. One sheet per module — test results with summary row at bottom
 *   3. "Coverage Summary" — grand totals
 *
 * All tables have borders. Color entire row (green/red/yellow).
 * Executive Summary recalculated after EVERY test case.
 */

import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

// ─── Colors & Styles ────────────────────────────────────────────────

const FILL_PASSED: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
const FILL_FAILED: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
const FILL_SKIPPED: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
const FILL_HEADER: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

const WRAP_TOP: Partial<ExcelJS.Alignment> = { wrapText: true, vertical: 'top' };

// ─── Types ──────────────────────────────────────────────────────────

export interface TestResultRow {
  userFlow: string;
  testNo: string;
  scenario: string;
  /** Must use \n between steps: "1. Tap email\n2. Type test@email.com\n3. Tap Login" */
  steps: string;
  expected: string;
  status: 'Passed' | 'Failed' | 'Skip';
  actual: string;
  screenshot: string;
}

export interface ModuleStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface BugEntry {
  testCaseId: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  reason: string;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Creates new Excel report with all sheets and headers.
 * Matches hook: Executive Summary + per-module sheet + Coverage Summary.
 */
export async function createReport(
  excelPath: string,
  moduleName: string,
  deviceInfo: string,
  config: { tcVersion: string; totalModules: number; promptDir: string }
): Promise<void> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Executive Summary
  const es = wb.addWorksheet('Executive Summary');
  buildExecutiveSummary(es, moduleName, deviceInfo, config);

  // Sheet 2: Module results
  const ms = wb.addWorksheet(moduleName.slice(0, 31));
  buildModuleSheet(ms);

  // Sheet 3: Coverage Summary
  const cs = wb.addWorksheet('Coverage Summary');
  buildCoverageSummary(cs);

  fs.mkdirSync(path.dirname(excelPath), { recursive: true });
  await wb.xlsx.writeFile(excelPath);
}

/**
 * Appends a test result row + updates Executive Summary + Coverage Summary.
 * Called IMMEDIATELY after each test case (mandatory per hook).
 */
export async function appendResult(
  excelPath: string,
  moduleName: string,
  row: TestResultRow
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

  const sheetName = moduleName.slice(0, 31);
  const moduleSheet = wb.getWorksheet(sheetName);
  if (!moduleSheet) return;

  // Append data row with \n in steps (hook requirement)
  const nextRow = moduleSheet.rowCount + 1;
  const dataRow = moduleSheet.getRow(nextRow);
  dataRow.values = [
    row.userFlow,
    row.testNo,
    row.scenario,
    row.steps, // Must already contain \n between steps
    row.expected,
    row.status,
    row.actual,
    row.screenshot,
  ];

  // Color ENTIRE ROW
  const fill = row.status === 'Passed' ? FILL_PASSED : row.status === 'Failed' ? FILL_FAILED : FILL_SKIPPED;
  for (let col = 1; col <= 8; col++) {
    const cell = dataRow.getCell(col);
    cell.fill = fill;
    cell.border = BORDER_THIN;
    cell.alignment = WRAP_TOP;
  }

  // Update Executive Summary (recalculate from actual sheet data — per hook)
  recalcExecutiveSummary(wb, moduleName);

  // Update Coverage Summary
  recalcCoverageSummary(wb);

  await wb.xlsx.writeFile(excelPath);
}

/**
 * Finalizes the report: adds summary row to module sheet + Bugs table + Key Findings.
 */
export async function finalizeReport(
  excelPath: string,
  moduleName: string,
  stats: ModuleStats,
  bugs: BugEntry[],
  keyFindings: string[],
  untestableSteps: Array<{ module: string; step: string; reason: string }>
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

  // Add summary row to module sheet
  const sheetName = moduleName.slice(0, 31);
  const moduleSheet = wb.getWorksheet(sheetName);
  if (moduleSheet) {
    const summaryRow = moduleSheet.getRow(moduleSheet.rowCount + 1);
    summaryRow.values = [
      'Summary',
      '',
      '',
      '',
      '',
      '',
      `${stats.passed} Passed, ${stats.failed} Failed, ${stats.skipped} Skipped (Total: ${stats.total})`,
      '',
    ];
    summaryRow.font = { bold: true };
    for (let col = 1; col <= 8; col++) {
      summaryRow.getCell(col).border = BORDER_THIN;
    }
  }

  // Write Bugs table, Key Findings, Untestable Steps to Executive Summary
  const es = wb.getWorksheet('Executive Summary');
  if (es) {
    writeBugsTable(es, moduleName, bugs);
    writeKeyFindings(es, keyFindings);
    writeUntestableSteps(es, untestableSteps);
  }

  // Final recalc
  recalcExecutiveSummary(wb, moduleName);
  recalcCoverageSummary(wb);

  await wb.xlsx.writeFile(excelPath);
}

// ─── Sheet Builders ─────────────────────────────────────────────────

function buildExecutiveSummary(
  sheet: ExcelJS.Worksheet,
  moduleName: string,
  deviceInfo: string,
  config: { tcVersion: string; totalModules: number; promptDir: string }
): void {
  // Table 1: Module Overview
  const h1 = sheet.addRow(['Module Name', 'Total Test Cases', 'Passed', 'Failed', 'Skipped', 'Pass Rate %']);
  styleHeader(h1);
  const dataRow = sheet.addRow([moduleName, 0, 0, 0, 0, '0%']);
  applyBorderRow(dataRow, 6);
  const totalRow = sheet.addRow(['TOTAL', 0, 0, 0, 0, '0%']);
  totalRow.font = { bold: true };
  applyBorderRow(totalRow, 6);

  sheet.addRow([]);

  // Table 3: Overall Metrics
  const h3 = sheet.addRow(['Metric', 'Value']);
  styleHeader(h3);
  const metrics: [string, string][] = [
    ['Test Date', new Date().toISOString().slice(0, 19).replace('T', ' ')],
    ['TC Version', config.tcVersion],
    ['Device', deviceInfo],
    ['Total Modules', String(config.totalModules)],
    ['Total Test Cases', '0'],
    ['Overall Pass Rate', '0%'],
    ['Coverage %', '0%'],
  ];
  for (const [k, v] of metrics) {
    const r = sheet.addRow([k, v]);
    applyBorderRow(r, 2);
  }

  sheet.addRow([]);

  // Column widths
  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 10;
  sheet.getColumn(6).width = 12;
}

function buildModuleSheet(sheet: ExcelJS.Worksheet): void {
  const headers = ['User Flow', 'Test No.', 'Test Scenario', 'Test Steps', 'Expected Results', 'Status', 'Actual Results', 'Screenshot'];
  const headerRow = sheet.addRow(headers);
  styleHeader(headerRow);

  // Column widths per hook specification
  const widths = [15, 10, 30, 40, 35, 10, 35, 15];
  widths.forEach((w, i) => { sheet.getColumn(i + 1).width = w; });
}

function buildCoverageSummary(sheet: ExcelJS.Worksheet): void {
  const h = sheet.addRow(['Metric', 'Value']);
  styleHeader(h);

  const rows: [string, string | number][] = [
    ['Total Test Cases', 0],
    ['Executed', 0],
    ['Passed', 0],
    ['Failed', 0],
    ['Skipped', 0],
    ['Pass Rate', '0%'],
    ['Coverage', '0%'],
  ];
  for (const [k, v] of rows) {
    const r = sheet.addRow([k, v]);
    applyBorderRow(r, 2);
  }

  sheet.getColumn(1).width = 20;
  sheet.getColumn(2).width = 12;
}

// ─── Recalculation (from actual sheet data, per hook requirement) ───

function recalcExecutiveSummary(wb: ExcelJS.Workbook, moduleName: string): void {
  const es = wb.getWorksheet('Executive Summary');
  const moduleSheet = wb.getWorksheet(moduleName.slice(0, 31));
  if (!es || !moduleSheet) return;

  // Count statuses from module sheet by reading Status column (col 6)
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  moduleSheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return; // Skip header
    const statusVal = String(row.getCell(6).value || '').trim();
    if (statusVal === 'Passed') passed++;
    else if (statusVal === 'Failed') failed++;
    else if (statusVal === 'Skip' || statusVal === 'Skipped') skipped++;
  });

  const total = passed + failed + skipped;
  const passRate = total > 0 ? `${((passed / total) * 100).toFixed(1)}%` : '0%';

  // Update Module Overview row (row 2) — derived from actual data
  const modRow = es.getRow(2);
  modRow.getCell(2).value = total;
  modRow.getCell(3).value = passed;
  modRow.getCell(4).value = failed;
  modRow.getCell(5).value = skipped;
  modRow.getCell(6).value = passRate;

  // Update TOTAL row (row 3)
  const totRow = es.getRow(3);
  totRow.getCell(2).value = total;
  totRow.getCell(3).value = passed;
  totRow.getCell(4).value = failed;
  totRow.getCell(5).value = skipped;
  totRow.getCell(6).value = passRate;

  // Update Overall Metrics (rows 6-12)
  const metricsStartRow = 6;
  const totalCasesRow = es.getRow(metricsStartRow + 4);
  if (totalCasesRow) totalCasesRow.getCell(2).value = total;
  const passRateRow = es.getRow(metricsStartRow + 5);
  if (passRateRow) passRateRow.getCell(2).value = passRate;
  const coverageRow = es.getRow(metricsStartRow + 6);
  if (coverageRow) coverageRow.getCell(2).value = total > 0 ? `${((passed + failed) / total * 100).toFixed(0)}%` : '0%';
}

function recalcCoverageSummary(wb: ExcelJS.Workbook): void {
  const cs = wb.getWorksheet('Coverage Summary');
  if (!cs) return;

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // Count across all module sheets (skip Executive Summary and Coverage Summary)
  for (const sheet of wb.worksheets) {
    if (sheet.name === 'Executive Summary' || sheet.name === 'Coverage Summary') continue;
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const s = String(row.getCell(6).value || '').trim();
      if (s === 'Passed') totalPassed++;
      else if (s === 'Failed') totalFailed++;
      else if (s === 'Skip' || s === 'Skipped') totalSkipped++;
    });
  }

  const total = totalPassed + totalFailed + totalSkipped;
  const executed = totalPassed + totalFailed + totalSkipped;
  const passRate = executed > 0 ? `${((totalPassed / executed) * 100).toFixed(1)}%` : '0%';
  const coverage = total > 0 ? `${((executed / total) * 100).toFixed(0)}%` : '0%';

  // Update Coverage Summary values (rows 2-8, col 2)
  cs.getRow(2).getCell(2).value = total;
  cs.getRow(3).getCell(2).value = executed;
  cs.getRow(4).getCell(2).value = totalPassed;
  cs.getRow(5).getCell(2).value = totalFailed;
  cs.getRow(6).getCell(2).value = totalSkipped;
  cs.getRow(7).getCell(2).value = passRate;
  cs.getRow(8).getCell(2).value = coverage;
}

// ─── Executive Summary Tables (written once at end) ─────────────────

function writeBugsTable(sheet: ExcelJS.Worksheet, moduleName: string, bugs: BugEntry[]): void {
  if (bugs.length === 0) return;

  // Find next empty row
  const startRow = sheet.rowCount + 2;
  const titleRow = sheet.getRow(startRow);
  titleRow.getCell(1).value = `Bugs — ${moduleName}`;
  titleRow.font = { bold: true };

  const headerRow = sheet.getRow(startRow + 1);
  headerRow.values = ['Test Case ID', 'Severity', 'Reason'];
  styleHeader(headerRow);

  for (let i = 0; i < bugs.length; i++) {
    const r = sheet.getRow(startRow + 2 + i);
    r.values = [bugs[i].testCaseId, bugs[i].severity, bugs[i].reason];
    applyBorderRow(r, 3);
  }
}

function writeKeyFindings(sheet: ExcelJS.Worksheet, findings: string[]): void {
  if (findings.length === 0) return;

  const startRow = sheet.rowCount + 2;
  const titleRow = sheet.getRow(startRow);
  titleRow.getCell(1).value = 'Key Findings';
  titleRow.font = { bold: true };

  const headerRow = sheet.getRow(startRow + 1);
  headerRow.values = ['Finding'];
  styleHeader(headerRow);

  for (let i = 0; i < findings.length; i++) {
    const r = sheet.getRow(startRow + 2 + i);
    r.values = [findings[i]];
    applyBorderRow(r, 1);
  }
}

function writeUntestableSteps(sheet: ExcelJS.Worksheet, steps: Array<{ module: string; step: string; reason: string }>): void {
  if (steps.length === 0) return;

  const startRow = sheet.rowCount + 2;
  const titleRow = sheet.getRow(startRow);
  titleRow.getCell(1).value = 'Untestable Steps';
  titleRow.font = { bold: true };

  const headerRow = sheet.getRow(startRow + 1);
  headerRow.values = ['Module', 'Step', 'Reason'];
  styleHeader(headerRow);

  for (let i = 0; i < steps.length; i++) {
    const r = sheet.getRow(startRow + 2 + i);
    r.values = [steps[i].module, steps[i].step, steps[i].reason];
    applyBorderRow(r, 3);
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function styleHeader(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = FILL_HEADER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = BORDER_THIN;
  });
}

function applyBorderRow(row: ExcelJS.Row, colCount: number): void {
  for (let col = 1; col <= colCount; col++) {
    row.getCell(col).border = BORDER_THIN;
    row.getCell(col).alignment = WRAP_TOP;
  }
}
