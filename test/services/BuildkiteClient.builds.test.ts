import { describe, it, expect, vi, afterEach } from 'vitest';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';

describe('BuildkiteClient.getBuilds (GraphQL)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards date/state/branch filters as query variables', async () => {
    const client = new BuildkiteClient('test-token', { caching: false });
    const requestSpy = vi
      .spyOn(client as any, 'request')
      .mockResolvedValue({ pipeline: { builds: { edges: [] } } });

    await client.getBuilds('audit-runner', 'gusto', {
      first: 50,
      createdAtFrom: '2025-10-20T00:00:00.000Z',
      createdAtTo: '2025-10-23T00:00:00.000Z',
      state: ['PASSED'],
      branch: ['main'],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        pipelineSlug: 'gusto/audit-runner',
        first: 50,
        createdAtFrom: '2025-10-20T00:00:00.000Z',
        createdAtTo: '2025-10-23T00:00:00.000Z',
        state: ['PASSED'],
        branch: ['main'],
      })
    );
  });
});
