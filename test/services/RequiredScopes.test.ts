import { describe, it, expect } from 'vitest';
import {
  REQUIRED_SCOPES,
  scopeDisplayNames,
  commandsForScope,
  isKnownScope,
} from '../../src/services/RequiredScopes.js';

describe('RequiredScopes', () => {
  it('lists all scopes bktide cares about', () => {
    expect(Object.keys(REQUIRED_SCOPES).sort()).toEqual([
      'graphql',
      'read_artifacts',
      'read_build_logs',
      'read_builds',
      'read_organizations',
      'read_pipelines',
    ]);
  });

  it('maps each scope to a human-readable Buildkite UI label', () => {
    expect(REQUIRED_SCOPES.read_artifacts.displayName).toBe('Read Artifacts');
    expect(REQUIRED_SCOPES.graphql.displayName).toBe('GraphQL API Access');
  });

  it('reports which commands need each scope', () => {
    expect(commandsForScope('read_artifacts')).toContain('artifacts list');
    expect(commandsForScope('read_artifacts')).toContain('artifacts download');
    expect(commandsForScope('read_builds')).toContain('builds');
  });

  it('exposes display names as a flat array for legacy callers', () => {
    const names = scopeDisplayNames();
    expect(names).toContain('Read Builds');
    expect(names).toContain('Read Artifacts');
    expect(names).toContain('GraphQL API Access');
  });

  it('isKnownScope narrows unknown strings', () => {
    expect(isKnownScope('read_artifacts')).toBe(true);
    expect(isKnownScope('read_some_future_scope')).toBe(false);
  });
});
