import { execSync } from 'child_process';

export interface GitContext {
  branch: string;
  remoteUrl: string;
}

/**
 * Get the current git branch and remote URL.
 * Throws with actionable messages for common failure cases.
 */
export function getGitContext(options?: { remote?: string }): GitContext {
  const remote = options?.remote || 'origin';

  let branch: string;
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Not a git repository. Provide a build ref instead.');
  }

  if (branch === 'HEAD') {
    throw new Error('Detached HEAD. Provide a branch name with --branch or a build ref.');
  }

  let remoteUrl: string;
  try {
    remoteUrl = execSync(`git remote get-url ${remote}`, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`No git remote '${remote}' found. Provide a build ref instead.`);
  }

  return { branch, remoteUrl };
}

/**
 * Get the HEAD commit SHA.
 * Throws with actionable messages for common failure cases.
 */
export function getHeadCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Not a git repository or no commits yet. Pass --commit or provide a ref.');
  }
}

/**
 * Get the HEAD commit message subject line.
 * Throws with actionable messages for common failure cases.
 */
export function getHeadCommitMessage(): string {
  try {
    return execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error('Could not read git commit message. Pass --message or provide a ref.');
  }
}
