/**
 * Repository cloning — clone source code from remote repos.
 * Supports: CodeCommit, GitHub, GitLab, Bitbucket.
 * Handles HTTPS token auth and SSH.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

interface RepoConfig {
  /** Full repo URL (HTTPS or SSH) */
  url: string;
  /** Auth token (for HTTPS) — username:password or personal access token */
  token?: string;
  /** Branch to clone (default: main or default branch) */
  branch?: string;
}

/**
 * Clones a repo into the target directory (or pulls latest if already cloned).
 * Returns the absolute path to the cloned directory.
 *
 * @param targetDir - Where to clone to (e.g., repos/projectname/android/)
 * @param config - Repo configuration
 * @returns Absolute path to cloned repo
 */
export async function cloneOrPullRepo(targetDir: string, config: RepoConfig): Promise<string> {
  fs.mkdirSync(targetDir, { recursive: true });

  const repoName = extractRepoName(config.url);
  const repoPath = path.join(targetDir, repoName);

  // Build authenticated URL
  const authUrl = buildAuthUrl(config.url, config.token);

  if (fs.existsSync(path.join(repoPath, '.git'))) {
    // Already cloned — pull latest
    await execa('git', ['pull', '--ff-only'], { cwd: repoPath, timeout: 60_000, reject: false });
    if (config.branch) {
      await execa('git', ['checkout', config.branch], { cwd: repoPath, timeout: 10_000, reject: false });
    }
  } else {
    // Fresh clone
    const args = ['clone', '--depth', '1'];
    if (config.branch) args.push('--branch', config.branch);
    args.push(authUrl, repoPath);

    const result = await execa('git', args, { timeout: 120_000, reject: false });
    if (result.exitCode !== 0) {
      throw new Error(`Git clone failed: ${result.stderr || result.stdout}`);
    }
  }

  return repoPath;
}

/**
 * Builds an authenticated HTTPS URL.
 * Supports multiple formats:
 *   - CodeCommit: https://token@git-codecommit.region.amazonaws.com/v1/repos/Name
 *   - GitHub: https://token@github.com/org/repo.git
 *   - GitLab: https://oauth2:token@gitlab.com/org/repo.git
 */
function buildAuthUrl(url: string, token?: string): string {
  if (!token) return url;

  // Already has credentials in URL
  if (url.includes('@') && !url.startsWith('git@')) return url;

  // SSH URLs don't need token injection
  if (url.startsWith('git@')) return url;

  // HTTPS — inject token
  const urlObj = new URL(url);

  if (url.includes('codecommit')) {
    // AWS CodeCommit: uses username:password style
    if (token.includes(':')) {
      const [user, pass] = token.split(':');
      urlObj.username = encodeURIComponent(user);
      urlObj.password = encodeURIComponent(pass);
    } else {
      urlObj.username = token;
    }
  } else if (url.includes('gitlab')) {
    // GitLab: oauth2:token
    urlObj.username = 'oauth2';
    urlObj.password = token;
  } else if (url.includes('bitbucket')) {
    // Bitbucket: URL sudah ada username (e.g., https://user@bitbucket.org/...)
    // Token di-inject setelah username → https://user:token@bitbucket.org/...
    if (url.match(/:\/\/[^@]+@/)) {
      // URL already has username — inject token as password
      urlObj.password = encodeURIComponent(token);
    } else if (token.includes(':')) {
      // Token format: username:token
      const colonIdx = token.indexOf(':');
      urlObj.username = encodeURIComponent(token.slice(0, colonIdx));
      urlObj.password = encodeURIComponent(token.slice(colonIdx + 1));
    } else {
      // Just token, no username in URL
      urlObj.password = encodeURIComponent(token);
    }
  } else {
    // GitHub / generic: token as username
    urlObj.username = token;
  }

  return urlObj.toString();
}

/**
 * Extracts a clean repo name from a URL.
 * e.g., "https://github.com/org/my-app.git" → "my-app"
 */
function extractRepoName(url: string): string {
  const parts = url.replace(/\.git$/, '').split('/');
  return parts[parts.length - 1] || 'repo';
}

/**
 * Reads repo config from environment variables.
 * @returns RepoConfig or null if not configured
 */
export function getRepoConfigFromEnv(): RepoConfig | null {
  const url = process.env.REPO_URL;
  if (!url) return null;

  return {
    url,
    token: process.env.REPO_TOKEN,
    branch: process.env.REPO_BRANCH,
  };
}
