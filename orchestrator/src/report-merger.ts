/**
 * Report merger — combines per-module Excel reports into a single unified report.
 * Generates Executive Summary with aggregated metrics.
 */

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { AgentProcess, OrchestratorConfig } from './types.js';

/** Color constants for status styling */
const COLORS = {
  passed: { fill: 'C6EFCE', font: '006100' },
  failed: { fill: 'FFC7CE', font: '9C0006' },
  skipped: { fill: 'FFEB9C', font: '9C5700' },
  header: { fill: '4472C4', font: 'FFFFFF' },
} as const;

/**
 * Merges per-module Excel reports into a single combined report.
 *
 * @param config - Orchestrator config
 * @param runDir - Current run directory
 * @param agents - Completed agent results
 * @returns Path to the merged report
 */
export async function mergeReports(
  config: OrchestratorConfig,
  runDir: string,
  agents: AgentProcess[]
): Promise<string> {
  const outputPath = path.join(runDir, 'e2e-test-report.xlsx');
  const mergedWorkbook = new ExcelJS.Workbook();

  // Create Executive Summary first
  createExecutiveSummary(mergedWorkbook, agents);

  // Copy module sheets from individual reports
  for (const agent of agents) {
    const moduleReportPath = path.join(runDir, `${agent.moduleFolder}-report.xlsx`);

    if (fs.existsSync(moduleReportPath)) {
      await copyModuleSheet(mergedWorkbook, moduleReportPath, agent.moduleName);
    } else {
      // Create placeholder sheet for modules that didn't produce a report
      createPlaceholderSheet(mergedWorkbook, agent);
    }
  }

  // Create Coverage Summary as last sheet
  createCoverageSummary(mergedWorkbook, agents);

  await mergedWorkbook.xlsx.writeFile(outputPath);
  return outputPath;
}

/**
 * Creates the Executive Summary sheet with aggregated metrics.
 */
function createExecutiveSummary(workbook: ExcelJS.Workbook, agents: AgentProcess[]): void {
  const sheet = workbook.addWorksheet('Executive Summary');

  // Module Overview Table
  sheet.addRow(['Module Overview']);
  const overviewHeaders = ['Module Name', 'Total Test Cases', 'Passed', 'Failed', 'Skipped', 'Pass Rate %', 'Status'];
  const headerRow = sheet.addRow(overviewHeaders);
  styleHeaderRow(headerRow);

  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const agent of agents) {
    const total = agent.testCasesPassed + agent.testCasesFailed + agent.testCasesSkipped;
    const passRate = total > 0 ? ((agent.testCasesPassed / total) * 100).toFixed(1) : '0.0';

    sheet.addRow([
      agent.moduleName,
      total,
      agent.testCasesPassed,
      agent.testCasesFailed,
      agent.testCasesSkipped,
      `${passRate}%`,
      agent.status,
    ]);

    totalTests += total;
    totalPassed += agent.testCasesPassed;
    totalFailed += agent.testCasesFailed;
    totalSkipped += agent.testCasesSkipped;
  }

  // Total row
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';
  const totalRow = sheet.addRow(['TOTAL', totalTests, totalPassed, totalFailed, totalSkipped, `${overallPassRate}%`, '']);
  totalRow.font = { bold: true };

  sheet.addRow([]);

  // Overall Metrics Table
  sheet.addRow(['Overall Metrics']);
  const metricsHeaders = ['Metric', 'Value'];
  const metricsHeaderRow = sheet.addRow(metricsHeaders);
  styleHeaderRow(metricsHeaderRow);

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const duration = calculateTotalDuration(agents);

  sheet.addRow(['Test Date', now]);
  sheet.addRow(['Total Modules', agents.length]);
  sheet.addRow(['Total Test Cases', totalTests]);
  sheet.addRow(['Passed', totalPassed]);
  sheet.addRow(['Failed', totalFailed]);
  sheet.addRow(['Skipped', totalSkipped]);
  sheet.addRow(['Overall Pass Rate', `${overallPassRate}%`]);
  sheet.addRow(['Total Duration', `${Math.round(duration / 1000)}s`]);
  sheet.addRow(['Parallel Workers', agents.length]);

  sheet.addRow([]);

  // Module Status Table
  sheet.addRow(['Module Execution Status']);
  const statusHeaders = ['Module', 'Device', 'Duration (s)', 'Status', 'Error'];
  const statusHeaderRow = sheet.addRow(statusHeaders);
  styleHeaderRow(statusHeaderRow);

  for (const agent of agents) {
    const dur = agent.endTime && agent.startTime ? Math.round((agent.endTime - agent.startTime) / 1000) : 0;
    sheet.addRow([agent.moduleName, agent.deviceId, dur, agent.status, agent.error ?? '']);
  }

  // Set column widths
  sheet.columns = [
    { width: 20 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 40 },
  ];

  // Apply borders to all cells with data
  applyBordersToSheet(sheet);
}

/**
 * Copies a module sheet from an individual report into the merged workbook.
 */
async function copyModuleSheet(
  workbook: ExcelJS.Workbook,
  sourceFile: string,
  sheetName: string
): Promise<void> {
  const sourceWorkbook = new ExcelJS.Workbook();
  await sourceWorkbook.xlsx.readFile(sourceFile);

  // Find the module's data sheet (usually the second sheet, or named after module)
  const sourceSheet = sourceWorkbook.worksheets.find(
    (ws) => ws.name !== 'Executive Summary' && ws.name !== 'Coverage Summary'
  ) ?? sourceWorkbook.worksheets[0];

  if (!sourceSheet) return;

  const destSheet = workbook.addWorksheet(sheetName.slice(0, 31)); // Excel 31-char limit

  // Copy rows
  sourceSheet.eachRow((row, rowNum) => {
    const destRow = destSheet.getRow(rowNum);
    row.eachCell((cell, colNum) => {
      const destCell = destRow.getCell(colNum);
      destCell.value = cell.value;
      destCell.style = { ...cell.style };
    });
  });

  // Copy column widths
  sourceSheet.columns.forEach((col, idx) => {
    if (col.width && destSheet.columns[idx]) {
      destSheet.getColumn(idx + 1).width = col.width;
    }
  });
}

/**
 * Creates a placeholder sheet for modules that failed before producing a report.
 */
function createPlaceholderSheet(workbook: ExcelJS.Workbook, agent: AgentProcess): void {
  const sheet = workbook.addWorksheet(agent.moduleName.slice(0, 31));

  const headers = ['User Flow', 'Test No.', 'Test Scenario', 'Test Steps', 'Expected Results', 'Status', 'Actual Results', 'Screenshot'];
  const headerRow = sheet.addRow(headers);
  styleHeaderRow(headerRow);

  sheet.addRow([
    agent.moduleName,
    'N/A',
    'Module did not complete',
    '',
    '',
    agent.status,
    agent.error ?? 'Agent did not produce results',
    '',
  ]);

  sheet.columns = [
    { width: 15 },
    { width: 10 },
    { width: 30 },
    { width: 40 },
    { width: 35 },
    { width: 10 },
    { width: 35 },
    { width: 15 },
  ];
}

/**
 * Creates the Coverage Summary sheet (last sheet).
 */
function createCoverageSummary(workbook: ExcelJS.Workbook, agents: AgentProcess[]): void {
  const sheet = workbook.addWorksheet('Coverage Summary');

  const totalTests = agents.reduce((sum, a) => sum + a.testCasesTotal, 0);
  const executed = agents.reduce((sum, a) => sum + a.testCasesPassed + a.testCasesFailed + a.testCasesSkipped, 0);
  const passed = agents.reduce((sum, a) => sum + a.testCasesPassed, 0);
  const failed = agents.reduce((sum, a) => sum + a.testCasesFailed, 0);
  const skipped = agents.reduce((sum, a) => sum + a.testCasesSkipped, 0);
  const passRate = executed > 0 ? ((passed / executed) * 100).toFixed(1) : '0.0';
  const coverage = totalTests > 0 ? ((executed / totalTests) * 100).toFixed(1) : '0.0';

  const headerRow = sheet.addRow(['Metric', 'Value']);
  styleHeaderRow(headerRow);

  sheet.addRow(['Total Test Cases (defined)', totalTests]);
  sheet.addRow(['Executed', executed]);
  sheet.addRow(['Passed', passed]);
  sheet.addRow(['Failed', failed]);
  sheet.addRow(['Skipped', skipped]);
  sheet.addRow(['Pass Rate', `${passRate}%`]);
  sheet.addRow(['Coverage', `${coverage}%`]);

  sheet.columns = [{ width: 25 }, { width: 15 }];
  applyBordersToSheet(sheet);
}

/**
 * Styles a row as a header (blue background, white bold text).
 */
function styleHeaderRow(row: ExcelJS.Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.header.font } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header.fill },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
}

/**
 * Applies thin borders to all cells containing data.
 */
function applyBordersToSheet(sheet: ExcelJS.Worksheet): void {
  const thinBorder: Partial<ExcelJS.Border> = { style: 'thin' };

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined) {
        cell.border = {
          top: thinBorder,
          left: thinBorder,
          bottom: thinBorder,
          right: thinBorder,
        };
      }
    });
  });
}

/**
 * Calculates total wall-clock duration from first start to last end.
 */
function calculateTotalDuration(agents: AgentProcess[]): number {
  const starts = agents.filter((a) => a.startTime).map((a) => a.startTime!);
  const ends = agents.filter((a) => a.endTime).map((a) => a.endTime!);

  if (starts.length === 0 || ends.length === 0) return 0;

  return Math.max(...ends) - Math.min(...starts);
}
