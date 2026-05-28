import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';

describe('BuildkiteClient.getPipelinesForRepo', () => {
  let client: BuildkiteClient;

  beforeEach(() => {
    client = new BuildkiteClient('test-token', { caching: false });
  });

  it('returns pipelines matching any candidate URL, deduped', async () => {
    const querySpy = vi.spyOn(client as any, 'query').mockResolvedValue({
      organization: {
        repo0: { edges: [{ node: { id: 'p1', name: 'Main', slug: 'main', repository: { url: 'git@github.com:gusto/zp.git' } } }] },
        repo1: { edges: [{ node: { id: 'p1', name: 'Main', slug: 'main', repository: { url: 'git@github.com:gusto/zp.git' } } }] },
        repo2: { edges: [{ node: { id: 'p2', name: 'Nightly', slug: 'nightly', repository: { url: 'https://github.com/gusto/zp.git' } } }] },
      },
    });

    const result = await client.getPipelinesForRepo('gusto', [
      'git@github.com:gusto/zp.git',
      'git@github.com:gusto/zp',
      'https://github.com/gusto/zp.git',
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((p: { slug: string }) => p.slug).sort()).toEqual(['main', 'nightly']);
    expect(querySpy).toHaveBeenCalledOnce();
  });

  it('returns empty array when no pipelines match', async () => {
    vi.spyOn(client as any, 'query').mockResolvedValue({
      organization: { repo0: { edges: [] } },
    });
    const result = await client.getPipelinesForRepo('gusto', ['nope']);
    expect(result).toEqual([]);
  });
});
