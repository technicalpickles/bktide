import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

// Mock node-fetch
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);

function jsonResponse(body: any, status = 200): any {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => {
        if (name === 'RateLimit-Remaining') return '99';
        if (name === 'RateLimit-Limit') return '100';
        if (name === 'RateLimit-Reset') return '60';
        return null;
      },
    },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('BuildkiteRestClient writes', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  describe('post', () => {
    it('sends POST with JSON body and bearer token', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ number: 42 }));

      const result = await (client as any).post('/test', { foo: 'bar' });

      expect(result).toEqual({ number: 42 });
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, any];
      expect(String(url)).toContain('/test');
      expect(init.method).toBe('POST');
      expect(init.headers['Authorization']).toBe('Bearer test-token');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.body).toBe(JSON.stringify({ foo: 'bar' }));
    });

    it('throws with API error body on non-2xx', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: { get: () => null },
        json: async () => ({ message: 'commit is required', errors: [{ message: 'commit is blank' }] }),
        text: async () => '{"message":"commit is required","errors":[{"message":"commit is blank"}]}',
      } as any);

      await expect((client as any).post('/test', {})).rejects.toThrow(/commit is required/);
    });

    it('updates rate limit info from response headers', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
      await (client as any).post('/test', {});
      expect(client.getRateLimitInfo()).toEqual({ remaining: 99, limit: 100, reset: 60 });
    });
  });

  describe('put', () => {
    it('sends PUT with optional body', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ number: 43 }));

      const result = await (client as any).put('/test/rebuild');

      expect(result).toEqual({ number: 43 });
      const [, init] = mockFetch.mock.calls[0] as [string, any];
      expect(init.method).toBe('PUT');
      expect(init.body).toBeUndefined();
    });

    it('serializes body when provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));
      await (client as any).put('/test', { foo: 1 });
      const [, init] = mockFetch.mock.calls[0] as [string, any];
      expect(init.body).toBe(JSON.stringify({ foo: 1 }));
    });
  });
});

describe('createBuild', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  it('POSTs to the correct endpoint with the payload', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      number: 4567,
      state: 'scheduled',
      web_url: 'https://buildkite.com/gusto/zp/builds/4567',
      pipeline: { slug: 'zp' },
    }));

    const result = await client.createBuild('gusto', 'zp', {
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: { DEBUG: '1' },
    });

    expect(result.number).toBe(4567);
    expect(result.web_url).toBe('https://buildkite.com/gusto/zp/builds/4567');

    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(String(url)).toContain('/organizations/gusto/pipelines/zp/builds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      commit: 'abc123',
      branch: 'main',
      message: 'hotfix',
      env: { DEBUG: '1' },
    });
  });

  it('omits message and env when not provided', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ number: 1, state: 'scheduled', web_url: '', pipeline: { slug: 'p' } }));
    await client.createBuild('o', 'p', { commit: 'abc', branch: 'main' });
    const [, init] = mockFetch.mock.calls[0] as [string, any];
    expect(JSON.parse(init.body)).toEqual({ commit: 'abc', branch: 'main' });
  });
});

describe('rebuildBuild', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  it('PUTs the rebuild endpoint with no body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      number: 4568,
      state: 'scheduled',
      web_url: 'https://buildkite.com/gusto/zp/builds/4568',
      pipeline: { slug: 'zp' },
    }));

    const result = await client.rebuildBuild('gusto', 'zp', 4567);

    expect(result.number).toBe(4568);
    const [url, init] = mockFetch.mock.calls[0] as [string, any];
    expect(String(url)).toContain('/organizations/gusto/pipelines/zp/builds/4567/rebuild');
    expect(init.method).toBe('PUT');
    expect(init.body).toBeUndefined();
  });

  it('throws on 404 with the API message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => null },
      text: async () => '{"message":"Not Found"}',
      json: async () => ({ message: 'Not Found' }),
    } as any);

    await expect(client.rebuildBuild('o', 'p', 999)).rejects.toThrow(/Not Found/);
  });
});
