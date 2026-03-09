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
