/**
 * Source Code Scanner — deterministic pre-scan of project files.
 * Reads relevant UI source files and returns their content as a single string
 * ready to be sent to AI in one shot.
 *
 * No AI involved in scanning — pure Node.js file reading.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execaCommand } from 'execa';

/** Max total characters to send to AI (stay within token limits) */
const MAX_TOTAL_CHARS = 80_000;

/** Max characters per file */
const MAX_FILE_CHARS = 10_000;

/**
 * Scans a project directory and returns relevant source files as text.
 *
 * @param projectRoot - Root of the project to scan
 * @param platform - 'android' or 'ios'
 * @returns Structured text with all relevant source files
 */
export async function scanProject(projectRoot: string, platform: 'android' | 'ios'): Promise<string> {
  const files = await findRelevantFiles(projectRoot, platform);

  if (files.length === 0) {
    return `No source files found in ${projectRoot}`;
  }

  const sections: string[] = [];
  let totalChars = 0;

  // Add project structure overview first
  const structure = await getProjectStructure(projectRoot);
  sections.push(`## Project Structure\n\`\`\`\n${structure}\n\`\`\`\n`);
  totalChars += structure.length;

  // Read each file
  for (const file of files) {
    if (totalChars >= MAX_TOTAL_CHARS) {
      sections.push(`\n[... ${files.length - sections.length + 1} more files truncated due to size limit]`);
      break;
    }

    const relativePath = path.relative(projectRoot, file);
    const content = fs.readFileSync(file, 'utf-8');
    const trimmed = content.length > MAX_FILE_CHARS
      ? content.slice(0, MAX_FILE_CHARS) + '\n[... truncated]'
      : content;

    sections.push(`## ${relativePath}\n\`\`\`kotlin\n${trimmed}\n\`\`\`\n`);
    totalChars += trimmed.length;
  }

  return sections.join('\n');
}

/**
 * Finds relevant source files based on platform.
 */
async function findRelevantFiles(projectRoot: string, platform: 'android' | 'ios'): Promise<string[]> {
  const patterns = platform === 'android'
    ? ['*.kt', '*.xml']
    : ['*.swift', '*.storyboard', '*.xib'];

  const files: string[] = [];

  for (const pattern of patterns) {
    try {
      const result = await execaCommand(
        `find "${projectRoot}" -name "${pattern}" -not -path "*/build/*" -not -path "*/.gradle/*" -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/test/*" -not -path "*/androidTest/*" -type f`,
        { reject: false }
      );
      if (result.stdout) {
        files.push(...result.stdout.split('\n').filter(Boolean));
      }
    } catch { /* continue */ }
  }

  // Also grab AndroidManifest.xml or Info.plist
  if (platform === 'android') {
    try {
      const result = await execaCommand(
        `find "${projectRoot}" -name "AndroidManifest.xml" -not -path "*/build/*" -type f | head -1`,
        { reject: false }
      );
      if (result.stdout?.trim()) files.unshift(result.stdout.trim());
    } catch { /* continue */ }
  }

  // Sort: prioritize UI files (Composable, Activity, Screen, View)
  return files.sort((a, b) => {
    const scoreA = getFileRelevanceScore(a);
    const scoreB = getFileRelevanceScore(b);
    return scoreB - scoreA;
  }).slice(0, 50); // Max 50 files
}

/**
 * Scores a file by relevance (higher = more likely UI-related).
 */
function getFileRelevanceScore(filePath: string): number {
  const name = path.basename(filePath).toLowerCase();
  let score = 0;
  if (name.includes('screen')) score += 10;
  if (name.includes('activity')) score += 8;
  if (name.includes('fragment')) score += 7;
  if (name.includes('composable')) score += 10;
  if (name.includes('view')) score += 6;
  if (name.includes('ui')) score += 5;
  if (name.includes('navigation') || name.includes('nav')) score += 9;
  if (name.includes('login') || name.includes('auth')) score += 8;
  if (name.includes('home') || name.includes('main')) score += 7;
  if (name.includes('manifest')) score += 6;
  if (name.endsWith('.xml') && filePath.includes('layout')) score += 5;
  if (name.endsWith('.xml') && filePath.includes('navigation')) score += 9;
  return score;
}

/**
 * Gets a high-level directory structure (max 3 levels deep).
 */
async function getProjectStructure(projectRoot: string): Promise<string> {
  try {
    const result = await execaCommand(
      `find "${projectRoot}" -maxdepth 3 -not -path "*/.git/*" -not -path "*/build/*" -not -path "*/.gradle/*" -not -path "*/node_modules/*" | head -80`,
      { reject: false }
    );
    return result.stdout || 'Empty';
  } catch {
    return 'Could not read directory structure';
  }
}
