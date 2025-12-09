import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildkiteRestClient - Log Fetching', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    client = new BuildkiteRestClient('test-token', { caching: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getJobLog', () => {
    it('should return JobLog structure from getJobLog', async () => {
      const mockLog = {
        url: 'https://example.com/log',
        content: 'Log content here',
        size: 1024,
        header_times: [0, 100, 200],
      };
      
      // Mock the internal get method
      vi.spyOn(client as any, 'get').mockResolvedValue(mockLog);
      
      const result = await client.getJobLog('org', 'pipeline', 1, 'job-id');
      
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('header_times');
      expect(result.content).toBe('Log content here');
      expect(result.size).toBe(1024);
    });

    it('should call correct endpoint', async () => {
      const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue({
        url: '',
        content: '',
        size: 0,
        header_times: [],
      });
      
      await client.getJobLog('my-org', 'my-pipeline', 42, 'job-uuid-123');
      
      expect(getSpy).toHaveBeenCalledWith(
        '/organizations/my-org/pipelines/my-pipeline/builds/42/jobs/job-uuid-123/log'
      );
    });
  });

  describe('getBuild', () => {
    it('should return build data', async () => {
      const mockBuild = {
        id: 'build-123',
        number: 42,
        state: 'passed',
        web_url: 'https://buildkite.com/org/pipeline/builds/42',
        jobs: [{ id: 'job-1', name: 'Test' }],
      };
      
      vi.spyOn(client as any, 'get').mockResolvedValue(mockBuild);
      
      const result = await client.getBuild('org', 'pipeline', 42);
      
      expect(result.number).toBe(42);
      expect(result.state).toBe('passed');
      expect(result.jobs).toHaveLength(1);
    });
  });

  describe('getPipelineBuilds', () => {
    it('should return array of builds', async () => {
      const mockBuilds = [
        { number: 1, state: 'passed' },
        { number: 2, state: 'failed' },
      ];
      
      vi.spyOn(client as any, 'get').mockResolvedValue(mockBuilds);
      
      const result = await client.getPipelineBuilds('org', 'pipeline');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('should pass query parameters', async () => {
      const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue([]);
      
      await client.getPipelineBuilds('org', 'pipeline', { per_page: '20', state: 'passed' });
      
      expect(getSpy).toHaveBeenCalledWith(
        '/organizations/org/pipelines/pipeline/builds',
        { per_page: '20', state: 'passed' }
      );
    });
  });
});
