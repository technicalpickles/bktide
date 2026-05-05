import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildkiteRestClient.getAccessToken', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the token uuid and scopes from /v2/access-token', async () => {
    const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue({
      uuid: '11111111-2222-3333-4444-555555555555',
      scopes: ['read_builds', 'graphql'],
    });

    const result = await client.getAccessToken();

    expect(getSpy).toHaveBeenCalledWith('/access-token');
    expect(result.uuid).toBe('11111111-2222-3333-4444-555555555555');
    expect(result.scopes).toEqual(['read_builds', 'graphql']);
  });

  it('propagates auth errors from the underlying request', async () => {
    vi.spyOn(client as any, 'get').mockRejectedValue(
      new Error('API request failed: Unauthorized')
    );

    await expect(client.getAccessToken()).rejects.toThrow('Unauthorized');
  });
});
