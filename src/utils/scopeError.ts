import { REQUIRED_SCOPES, isKnownScope } from '../services/RequiredScopes.js';

export type ScopeErrorMatch =
  | { matched: false }
  | { matched: true; scope: string };

/**
 * Detects the canonical Buildkite scope error and extracts the scope name.
 * The Buildkite REST API responds with messages like:
 *   "Your access token doesn't have the read_artifacts scope"
 * which may be wrapped by our own client with prefixes like
 *   "API request failed: ..."
 */
export function parseScopeError(message: string): ScopeErrorMatch {
  if (!message) return { matched: false };

  const re = /access token doesn'?t have the (\w+) scope/i;
  const match = message.match(re);
  if (match && match[1]) {
    return { matched: true, scope: match[1] };
  }
  return { matched: false };
}

export interface FormattedScopeError {
  message: string;
  suggestions: string[];
}

/**
 * Build a user-facing message and suggestion list for a known-missing scope.
 * Pulls display name + affected commands from RequiredScopes when available.
 */
export function formatScopeError(scope: string): FormattedScopeError {
  if (isKnownScope(scope)) {
    const meta = REQUIRED_SCOPES[scope];
    const cmds = meta.commands.join(', ');
    return {
      message: `Your Buildkite API token is missing the ${scope} scope (${meta.displayName}), needed for: ${cmds}`,
      suggestions: [
        'Open https://buildkite.com/user/api-access-tokens',
        `Edit your token and enable "${meta.displayName}"`,
        'Then run: bktide token --reset && bktide token --store',
      ],
    };
  }

  return {
    message: `Your Buildkite API token is missing the ${scope} scope`,
    suggestions: [
      'Open https://buildkite.com/user/api-access-tokens',
      `Edit your token to grant the ${scope} scope`,
      'Then run: bktide token --reset && bktide token --store',
    ],
  };
}
