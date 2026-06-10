import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ListBuilds } from '../../src/commands/ListBuilds.js';
import { logger } from '../../src/services/logger.js';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

function fakeBuildsResponse(count: number, hasNextPage = false) {
  const nodes = Array.from({ length: count }, (_, i) => ({
    node: {
      id: `b${i}`,
      number: i + 1,
      url: `https://buildkite.com/gusto/audit-runner/builds/${i + 1}`,
      state: 'PASSED',
      message: 'msg',
      commit: 'abc',
      branch: 'main',
      source: { name: 'Schedule' },
      createdAt: '2025-10-22T10:00:00.000Z',
      startedAt: null,
      finishedAt: null,
      createdBy: null,
    },
  }));
  return {
    organization: {
      pipelines: {
        edges: [
          {
            node: {
              slug: 'audit-runner',
              name: 'audit-runner',
              builds: { edges: nodes, pageInfo: { hasNextPage, endCursor: null } },
            },
          },
        ],
      },
    },
  };
}

describe('ListBuilds Command', () => {
  let command: ListBuilds;
  let stderrOutput: string[];

  beforeEach(() => {
    command = new ListBuilds();
    stderrOutput = [];
    // Mock logger to capture output
    vi.spyOn(logger, 'console').mockImplementation(() => {});
    vi.spyOn(logger, 'error').mockImplementation(() => {});
    // Capture stderr writes
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput.push(chunk.toString());
      return true;
    });
  });

  describe('validation', () => {
    it('rejects invalid state values with helpful message', async () => {
      // Set token so it doesn't throw "no token" error
      command['token'] = 'test-token';

      const result = await command.execute({
        state: 'badstate',
        org: 'gesso',
        token: 'test-token',
      });

      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('Invalid state');
      expect(output).toContain('running');
    });

    it('rejects an unparseable --created-from with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: 'not-a-date',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('Invalid date');
      expect(output).toContain('--created-from');
    });

    it('rejects a date range without a pipeline with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        createdFrom: '2025-10-20',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('--pipeline');
    });

    it('rejects a date range combined with --mine with exit 1', async () => {
      command['token'] = 'test-token';
      const result = await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        mine: true,
        createdFrom: '2025-10-20',
        token: 'test-token',
      } as any);
      expect(result).toBe(1);
      const output = stderrOutput.join('');
      expect(output).toContain('--mine');
    });
  });

  describe('scoping', () => {
    beforeEach(() => {
      vi.spyOn(BuildkiteClient.prototype, 'getViewer').mockResolvedValue({
        viewer: { user: { uuid: 'u1', name: 'Me', email: 'me@example.com' } },
      } as any);
      vi.spyOn(BuildkiteRestClient.prototype, 'hasOrganizationAccess').mockResolvedValue(true);
    });

    it('routes a pipeline reference to GraphQL, not the REST creator path', async () => {
      const gqlSpy = vi
        .spyOn(BuildkiteClient.prototype, 'getBuilds')
        .mockResolvedValue(fakeBuildsResponse(2) as any);
      const restSpy = vi
        .spyOn(BuildkiteRestClient.prototype, 'getBuilds')
        .mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', token: 'test-token' } as any);

      expect(gqlSpy).toHaveBeenCalledWith('audit-runner', 'gusto', expect.any(Object));
      expect(restSpy).not.toHaveBeenCalled();
    });

    it('passes normalized created_from/created_to into the GraphQL call', async () => {
      const gqlSpy = vi
        .spyOn(BuildkiteClient.prototype, 'getBuilds')
        .mockResolvedValue(fakeBuildsResponse(0) as any);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: '2025-10-20',
        createdTo: '2025-10-23',
        token: 'test-token',
      } as any);

      expect(gqlSpy).toHaveBeenCalledWith(
        'audit-runner',
        'gusto',
        expect.objectContaining({
          createdAtFrom: '2025-10-20T00:00:00.000Z',
          createdAtTo: '2025-10-23T00:00:00.000Z',
        })
      );
    });

    it('falls back to the REST creator path when --mine is set', async () => {
      const gqlSpy = vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(0) as any);
      const restSpy = vi.spyOn(BuildkiteRestClient.prototype, 'getBuilds').mockResolvedValue([]);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', mine: true, token: 'test-token' } as any);

      expect(restSpy).toHaveBeenCalledWith('gusto', expect.objectContaining({ creator: 'u1', pipeline: 'audit-runner' }));
      expect(gqlSpy).not.toHaveBeenCalled();
    });

    it('warns about truncation when hasNextPage is true with a date range', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(10, true) as any);
      command['token'] = 'test-token';

      await command.execute({
        org: 'gusto',
        pipeline: 'audit-runner',
        createdFrom: '2025-10-20',
        count: '10',
        token: 'test-token',
      } as any);

      expect(stderrOutput.join('')).toContain('more builds');
    });

    it('maps GraphQL nodes so the pipeline slug and number render', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(2) as any);
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', token: 'test-token' } as any);

      const out = stdoutSpy.mock.calls.flat().join('');
      expect(out).toContain('audit-runner');
      expect(out).toContain('#1');
    });

    it('empty pipeline result names the pipeline, not the user', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(0) as any);
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', token: 'test-token' } as any);

      const out = consoleSpy.mock.calls.flat().join('') + stdoutSpy.mock.calls.flat().join('');
      expect(out).not.toContain('No builds found for Me');
      expect(out).toContain('audit-runner');
    });

    it('JSON output includes source and created_by', async () => {
      vi.spyOn(BuildkiteClient.prototype, 'getBuilds').mockResolvedValue(fakeBuildsResponse(1) as any);
      const consoleSpy = vi.spyOn(logger, 'console').mockImplementation(() => {});
      command['token'] = 'test-token';

      await command.execute({ org: 'gusto', pipeline: 'audit-runner', format: 'json', token: 'test-token' } as any);

      const out = consoleSpy.mock.calls.flat().join('');
      expect(out).toContain('"source"');
      expect(out).toContain('"created_by"');
    });
  });
});
