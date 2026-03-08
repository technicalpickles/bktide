export interface ParsedRemote {
  host: string;
  org: string;
  repo: string;
}

/**
 * Parse a git remote URL into host, org, and repo components.
 * Supports SSH (git@), HTTPS, and ssh:// formats.
 * Strips .git suffix if present.
 */
export function parseGitRemoteUrl(url: string): ParsedRemote {
  // SSH: git@host:org/repo.git
  const sshMatch = url.match(/^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (sshMatch) {
    return { host: sshMatch[1], org: sshMatch[2], repo: sshMatch[3] };
  }

  // ssh:// or https:// or http://
  const protoMatch = url.match(/^(?:ssh|https?):\/\/(?:[^@]+@)?([^/:]+)(?::\d+)?\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (protoMatch) {
    return { host: protoMatch[1], org: protoMatch[2], repo: protoMatch[3] };
  }

  throw new Error(`Cannot parse git remote URL: ${url}`);
}

/**
 * Generate all URL format candidates for a parsed remote.
 * Used to query Buildkite's exact-match repository filter with aliases.
 */
export function generateRepoCandidates(parsed: ParsedRemote): string[] {
  const { host, org, repo } = parsed;
  return [
    `git@${host}:${org}/${repo}.git`,
    `git@${host}:${org}/${repo}`,
    `https://${host}/${org}/${repo}.git`,
    `https://${host}/${org}/${repo}`,
  ];
}
