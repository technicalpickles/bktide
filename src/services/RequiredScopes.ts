/**
 * Single source of truth for Buildkite API scopes that bktide uses.
 * Keys match the scope identifiers returned by GET /v2/access-token.
 * Display names match what Buildkite shows in the token UI.
 */
export const REQUIRED_SCOPES = {
  read_builds: {
    displayName: 'Read Builds',
    commands: ['builds', 'build', 'pipeline', 'snapshot', 'logs'],
  },
  read_build_logs: {
    displayName: 'Read Build Logs',
    commands: ['logs', 'snapshot'],
  },
  read_organizations: {
    displayName: 'Read Organizations',
    commands: ['orgs', 'pipelines'],
  },
  read_pipelines: {
    displayName: 'Read Pipelines',
    commands: ['pipelines', 'pipeline'],
  },
  read_artifacts: {
    displayName: 'Read Artifacts',
    commands: ['artifacts list', 'artifacts download', 'snapshot --artifacts'],
  },
  graphql: {
    displayName: 'GraphQL API Access',
    commands: ['most commands (viewer, listings)'],
  },
} as const;

export type ScopeKey = keyof typeof REQUIRED_SCOPES;

export function scopeDisplayNames(): string[] {
  return Object.values(REQUIRED_SCOPES).map(s => s.displayName);
}

export function commandsForScope(scope: ScopeKey): readonly string[] {
  return REQUIRED_SCOPES[scope].commands;
}

export function isKnownScope(scope: string): scope is ScopeKey {
  return scope in REQUIRED_SCOPES;
}
