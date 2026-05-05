import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialManager } from '../../src/services/CredentialManager.js';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('CredentialManager.validateToken — scope detection', () => {
  let manager: CredentialManager;

  beforeEach(() => {
    manager = new CredentialManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns scopes.granted and empty scopes.missing when all required scopes are present', async () => {
    vi.spyOn(BuildkiteClient.prototype, 'getOrganizations').mockResolvedValue([
      { slug: 'gusto', name: 'Gusto', id: 'org-1' } as any,
    ]);
    vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({} as any);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasBuildAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'getAccessToken').mockResolvedValue({
      uuid: 'token-uuid',
      scopes: [
        'read_builds',
        'read_build_logs',
        'read_organizations',
        'read_pipelines',
        'read_artifacts',
        'graphql',
      ],
    });

    const result = await manager.validateToken('test-token', { showProgress: false });

    expect(result.scopes).toBeDefined();
    expect(result.scopes!.missing).toEqual([]);
    expect(result.scopes!.granted).toContain('read_artifacts');
    expect(result.valid).toBe(true);
  });

  it('marks token invalid when read_artifacts is missing', async () => {
    vi.spyOn(BuildkiteClient.prototype, 'getOrganizations').mockResolvedValue([
      { slug: 'gusto', name: 'Gusto', id: 'org-1' } as any,
    ]);
    vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({} as any);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasBuildAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'getAccessToken').mockResolvedValue({
      uuid: 'token-uuid',
      scopes: [
        'read_builds',
        'read_build_logs',
        'read_organizations',
        'read_pipelines',
        'graphql',
        // read_artifacts intentionally absent
      ],
    });

    const result = await manager.validateToken('test-token', { showProgress: false });

    expect(result.scopes!.missing).toEqual(['read_artifacts']);
    expect(result.valid).toBe(false);
  });

  it('falls back gracefully when /access-token errors (e.g. token revoked mid-flight)', async () => {
    vi.spyOn(BuildkiteClient.prototype, 'getOrganizations').mockResolvedValue([
      { slug: 'gusto', name: 'Gusto', id: 'org-1' } as any,
    ]);
    vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({} as any);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasBuildAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    vi.spyOn(BuildkiteRestClient.prototype, 'getAccessToken').mockRejectedValue(
      new Error('API request failed: Unauthorized')
    );

    const result = await manager.validateToken('test-token', { showProgress: false });

    expect(result.scopes).toBeUndefined();
    expect(result.canListOrganizations).toBe(true);
  });
});
