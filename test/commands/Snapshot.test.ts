import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getStepDirName, categorizeError, Snapshot } from '../../src/commands/Snapshot.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('Snapshot Command', () => {
  describe('getStepDirName', () => {
    it('should create numbered directory name with sanitized label', () => {
      expect(getStepDirName(0, 'Build')).toBe('01-build');
      expect(getStepDirName(1, 'Test')).toBe('02-test');
      expect(getStepDirName(9, 'Deploy')).toBe('10-deploy');
    });

    it('should remove emoji shortcodes', () => {
      expect(getStepDirName(0, ':hammer: Build')).toBe('01-build');
      expect(getStepDirName(0, ':rspec: Run RSpec')).toBe('01-run-rspec');
      expect(getStepDirName(0, ':docker: :kubernetes: Deploy')).toBe('01-deploy');
    });

    it('should replace non-alphanumeric characters with dashes', () => {
      expect(getStepDirName(0, 'Run Tests (unit)')).toBe('01-run-tests-unit');
      expect(getStepDirName(0, 'Build & Deploy')).toBe('01-build-deploy');
      expect(getStepDirName(0, 'test_runner')).toBe('01-test-runner');
    });

    it('should collapse multiple dashes', () => {
      expect(getStepDirName(0, 'Build --- Deploy')).toBe('01-build-deploy');
      expect(getStepDirName(0, ':hammer:  :wrench: Tools')).toBe('01-tools');
    });

    it('should trim leading and trailing dashes', () => {
      expect(getStepDirName(0, '-Build-')).toBe('01-build');
      expect(getStepDirName(0, '  Build  ')).toBe('01-build');
    });

    it('should convert to lowercase', () => {
      expect(getStepDirName(0, 'BUILD')).toBe('01-build');
      expect(getStepDirName(0, 'RunTests')).toBe('01-runtests');
    });

    it('should truncate long labels to 50 characters', () => {
      const longLabel = 'a'.repeat(100);
      const result = getStepDirName(0, longLabel);
      expect(result).toBe('01-' + 'a'.repeat(50));
      expect(result.length).toBe(53); // '01-' + 50 chars
    });

    it('should handle empty or whitespace-only labels', () => {
      expect(getStepDirName(0, '')).toBe('01-step');
      expect(getStepDirName(0, '   ')).toBe('01-step');
      expect(getStepDirName(0, ':emoji:')).toBe('01-step');
    });

    it('should handle labels with only special characters', () => {
      expect(getStepDirName(0, '!@#$%')).toBe('01-step');
      expect(getStepDirName(0, '---')).toBe('01-step');
    });

    it('should pad index correctly for different values', () => {
      expect(getStepDirName(0, 'step')).toBe('01-step');
      expect(getStepDirName(8, 'step')).toBe('09-step');
      expect(getStepDirName(99, 'step')).toBe('100-step');
    });
  });

  describe('categorizeError', () => {
    it('should categorize rate limit errors', () => {
      const result = categorizeError(new Error('Rate limit exceeded'));
      expect(result).toEqual({
        error: 'rate_limited',
        message: 'Rate limit exceeded',
        retryable: true,
      });
    });

    it('should categorize 429 status code errors', () => {
      const result = categorizeError(new Error('API request failed with status 429'));
      expect(result).toEqual({
        error: 'rate_limited',
        message: 'API request failed with status 429',
        retryable: true,
      });
    });

    it('should categorize not found errors', () => {
      const result = categorizeError(new Error('Resource not found'));
      expect(result).toEqual({
        error: 'not_found',
        message: 'Resource not found',
        retryable: false,
      });
    });

    it('should categorize 404 status code errors', () => {
      const result = categorizeError(new Error('API request failed with status 404'));
      expect(result).toEqual({
        error: 'not_found',
        message: 'API request failed with status 404',
        retryable: false,
      });
    });

    it('should categorize permission denied errors', () => {
      const result = categorizeError(new Error('Permission denied'));
      expect(result).toEqual({
        error: 'permission_denied',
        message: 'Permission denied',
        retryable: false,
      });
    });

    it('should categorize 403 status code errors', () => {
      const result = categorizeError(new Error('API request failed with status 403'));
      expect(result).toEqual({
        error: 'permission_denied',
        message: 'API request failed with status 403',
        retryable: false,
      });
    });

    it('should categorize 401 status code errors', () => {
      const result = categorizeError(new Error('API request failed with status 401'));
      expect(result).toEqual({
        error: 'permission_denied',
        message: 'API request failed with status 401',
        retryable: false,
      });
    });

    it('should categorize network errors', () => {
      const result = categorizeError(new Error('ECONNREFUSED'));
      expect(result).toEqual({
        error: 'network_error',
        message: 'ECONNREFUSED',
        retryable: true,
      });
    });

    it('should categorize ENOTFOUND errors as network errors', () => {
      const result = categorizeError(new Error('getaddrinfo ENOTFOUND api.buildkite.com'));
      expect(result).toEqual({
        error: 'network_error',
        message: 'getaddrinfo ENOTFOUND api.buildkite.com',
        retryable: true,
      });
    });

    it('should categorize unknown errors as retryable', () => {
      const result = categorizeError(new Error('Something went wrong'));
      expect(result).toEqual({
        error: 'unknown',
        message: 'Something went wrong',
        retryable: true,
      });
    });

    it('should handle case-insensitive matching', () => {
      expect(categorizeError(new Error('RATE LIMIT EXCEEDED')).error).toBe('rate_limited');
      expect(categorizeError(new Error('NOT FOUND')).error).toBe('not_found');
      expect(categorizeError(new Error('PERMISSION DENIED')).error).toBe('permission_denied');
    });
  });

  describe('Snapshot.execute', () => {
    let tempDir: string;
    let snapshot: Snapshot;

    beforeEach(async () => {
      // Create a temp directory for test output
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bktide-snapshot-test-'));

      // Create a mock snapshot instance with mocked REST client
      snapshot = new Snapshot({ token: 'test-token', noCache: true });
    });

    afterEach(async () => {
      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return 1 when buildRef is not provided', async () => {
      const result = await snapshot.execute({});
      expect(result).toBe(1);
    });

    it('should create correct directory structure', async () => {
      // Mock the REST client methods
      const mockBuild = {
        id: 'build-123',
        number: 42,
        state: 'passed',
        message: 'Test build',
        jobs: [
          {
            id: 'job-1',
            type: 'script',
            name: 'Build',
            label: ':hammer: Build',
            state: 'passed',
          },
          {
            id: 'job-2',
            type: 'script',
            name: 'Test',
            label: ':rspec: Test',
            state: 'passed',
          },
          {
            id: 'wait-1',
            type: 'waiter',
            name: 'Wait',
          },
        ],
      };

      const mockLog = { content: 'Build output here', size: 17 };

      vi.spyOn(snapshot['restClient'], 'getBuild').mockResolvedValue(mockBuild);
      vi.spyOn(snapshot['restClient'], 'getJobLog').mockResolvedValue(mockLog);
      vi.spyOn(snapshot['restClient'], 'getBuildAnnotations').mockResolvedValue([]);

      const result = await snapshot.execute({
        buildRef: 'myorg/mypipeline/42',
        outputDir: tempDir,
        all: true, // Fetch all steps, not just failed
      });

      expect(result).toBe(0);

      // Verify directory structure
      const buildDir = path.join(tempDir, 'myorg', 'mypipeline', '42');
      const stats = await fs.stat(buildDir);
      expect(stats.isDirectory()).toBe(true);

      // Verify manifest.json exists with v2 structure
      const manifestPath = path.join(buildDir, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      expect(manifest.version).toBe(2);
      expect(manifest.buildRef).toBe('myorg/mypipeline/42');
      expect(manifest.fetchComplete).toBe(true);
      expect(manifest.steps).toHaveLength(2); // Only script jobs
      expect(manifest.annotations).toEqual({ fetchStatus: 'none', count: 0 });

      // Verify build.json exists
      const buildPath = path.join(buildDir, 'build.json');
      const build = JSON.parse(await fs.readFile(buildPath, 'utf-8'));
      expect(build.id).toBe('build-123');

      // Verify step directories
      const step1Dir = path.join(buildDir, 'steps', '01-build');
      const step2Dir = path.join(buildDir, 'steps', '02-test');

      expect((await fs.stat(step1Dir)).isDirectory()).toBe(true);
      expect((await fs.stat(step2Dir)).isDirectory()).toBe(true);

      // Verify step.json files
      const step1Json = JSON.parse(await fs.readFile(path.join(step1Dir, 'step.json'), 'utf-8'));
      expect(step1Json.id).toBe('job-1');

      // Verify log.txt files
      const log1 = await fs.readFile(path.join(step1Dir, 'log.txt'), 'utf-8');
      expect(log1).toBe('Build output here');
    });

    it('should handle log fetch errors gracefully', async () => {
      const mockBuild = {
        id: 'build-123',
        number: 42,
        state: 'failed',
        jobs: [
          {
            id: 'job-1',
            type: 'script',
            name: 'Build',
            state: 'failed', // Failed job so it gets fetched with default --failed behavior
          },
        ],
      };

      vi.spyOn(snapshot['restClient'], 'getBuild').mockResolvedValue(mockBuild);
      vi.spyOn(snapshot['restClient'], 'getJobLog').mockRejectedValue(
        new Error('API request failed with status 404: Log not found')
      );
      vi.spyOn(snapshot['restClient'], 'getBuildAnnotations').mockResolvedValue([]);

      const result = await snapshot.execute({
        buildRef: 'myorg/mypipeline/42',
        outputDir: tempDir,
      });

      // Should return 1 because not all steps succeeded
      expect(result).toBe(1);

      // Verify manifest shows error with v2 structure
      const buildDir = path.join(tempDir, 'myorg', 'mypipeline', '42');
      const manifestPath = path.join(buildDir, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

      expect(manifest.fetchComplete).toBe(false);
      expect(manifest.steps[0].fetchStatus).toBe('failed');
      expect(manifest.fetchErrors).toBeDefined();
      expect(manifest.fetchErrors[0].error).toBe('not_found');
      expect(manifest.fetchErrors[0].retryable).toBe(false);
    });

    it('should output JSON when --json flag is set', async () => {
      const mockBuild = {
        id: 'build-123',
        number: 42,
        state: 'passed',
        jobs: [
          {
            id: 'job-1',
            type: 'script',
            name: 'Build',
            state: 'passed',
          },
        ],
      };

      const mockLog = { content: 'Build output', size: 12 };

      vi.spyOn(snapshot['restClient'], 'getBuild').mockResolvedValue(mockBuild);
      vi.spyOn(snapshot['restClient'], 'getJobLog').mockResolvedValue(mockLog);
      vi.spyOn(snapshot['restClient'], 'getBuildAnnotations').mockResolvedValue([]);

      // Capture console output
      const consoleSpy = vi.fn();

      // Mock logger.console which is used for output
      const loggerModule = await import('../../src/services/logger.js');
      vi.spyOn(loggerModule.logger, 'console').mockImplementation(consoleSpy);

      await snapshot.execute({
        buildRef: 'myorg/mypipeline/42',
        outputDir: tempDir,
        json: true,
        all: true, // Fetch all steps to ensure we get output
      });

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.version).toBe(2);
      expect(parsed.buildRef).toBe('myorg/mypipeline/42');
    });

    it('should parse URL format build refs correctly', async () => {
      const mockBuild = {
        id: 'build-123',
        number: 99,
        state: 'passed',
        jobs: [],
      };

      const getBuildSpy = vi.spyOn(snapshot['restClient'], 'getBuild').mockResolvedValue(mockBuild);
      vi.spyOn(snapshot['restClient'], 'getBuildAnnotations').mockResolvedValue([]);

      await snapshot.execute({
        buildRef: 'https://buildkite.com/acme/pipeline/builds/99',
        outputDir: tempDir,
      });

      expect(getBuildSpy).toHaveBeenCalledWith('acme', 'pipeline', 99);

      // Verify output directory uses parsed values
      const buildDir = path.join(tempDir, 'acme', 'pipeline', '99');
      const stats = await fs.stat(buildDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should capture annotations when present', async () => {
      const mockBuild = {
        id: 'build-123',
        number: 42,
        state: 'failed',
        message: 'Test build',
        jobs: [],
      };

      const mockAnnotations = [
        { id: 'ann-1', context: 'test-failure', style: 'error', body_html: '<p>Test failed</p>' },
        { id: 'ann-2', context: 'coverage', style: 'info', body_html: '<p>Coverage: 80%</p>' },
      ];

      vi.spyOn(snapshot['restClient'], 'getBuild').mockResolvedValue(mockBuild);
      vi.spyOn(snapshot['restClient'], 'getBuildAnnotations').mockResolvedValue(mockAnnotations);

      await snapshot.execute({
        buildRef: 'myorg/mypipeline/42',
        outputDir: tempDir,
      });

      // Verify annotations.json exists
      const buildDir = path.join(tempDir, 'myorg', 'mypipeline', '42');
      const annotationsPath = path.join(buildDir, 'annotations.json');
      const annotationsFile = JSON.parse(await fs.readFile(annotationsPath, 'utf-8'));

      expect(annotationsFile.count).toBe(2);
      expect(annotationsFile.annotations).toHaveLength(2);
      expect(annotationsFile.annotations[0].context).toBe('test-failure');

      // Verify manifest reflects annotation status
      const manifestPath = path.join(buildDir, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      expect(manifest.annotations).toEqual({ fetchStatus: 'success', count: 2 });
    });

    it('should handle annotation fetch failure gracefully', async () => {
      const mockBuild = {
        id: 'build-123',
        number: 42,
        state: 'passed',
        jobs: [],
      };

      vi.spyOn(snapshot['restClient'], 'getBuild').mockResolvedValue(mockBuild);
      vi.spyOn(snapshot['restClient'], 'getBuildAnnotations').mockRejectedValue(
        new Error('API request failed with status 403')
      );

      const result = await snapshot.execute({
        buildRef: 'myorg/mypipeline/42',
        outputDir: tempDir,
      });

      // Should return 1 because annotation fetch failed
      expect(result).toBe(1);

      // Verify manifest shows annotation failure
      const buildDir = path.join(tempDir, 'myorg', 'mypipeline', '42');
      const manifestPath = path.join(buildDir, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));

      expect(manifest.fetchComplete).toBe(false);
      expect(manifest.annotations.fetchStatus).toBe('failed');
      expect(manifest.annotations.count).toBe(0);
    });
  });
});
