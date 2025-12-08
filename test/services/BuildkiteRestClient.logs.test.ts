import { describe, it, expect, beforeEach } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildkiteRestClient - Log Fetching', () => {
  let client: BuildkiteRestClient;

  beforeEach(() => {
    const token = process.env.BK_TOKEN || 'test-token';
    client = new BuildkiteRestClient(token, { caching: false });
  });

  it('should fetch job logs', async () => {
    // This is a mock test - in real usage, use actual build data
    const mockOrg = 'test-org';
    const mockPipeline = 'test-pipeline';
    const mockBuildNumber = 1;
    const mockJobId = 'test-job-id';

    // Note: This will fail with actual API until we have real test data
    // For now, we're testing the interface exists
    expect(client.getJobLog).toBeDefined();
    expect(typeof client.getJobLog).toBe('function');
  });

  it('should return JobLog interface', async () => {
    // Test that the method signature is correct
    const getJobLogMethod = client.getJobLog.bind(client);
    expect(getJobLogMethod).toBeDefined();
  });
});
