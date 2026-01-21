import { describe, it, expect } from 'vitest';
import { parseBuildRef } from '../../src/utils/parseBuildRef.js';

describe('parseBuildRef', () => {
  describe('slug format', () => {
    it('should parse org/pipeline/number format', () => {
      const result = parseBuildRef('myorg/mypipeline/123');
      expect(result).toEqual({
        org: 'myorg',
        pipeline: 'mypipeline',
        number: 123,
      });
    });

    it('should parse slug with leading @', () => {
      const result = parseBuildRef('@myorg/mypipeline/456');
      expect(result).toEqual({
        org: 'myorg',
        pipeline: 'mypipeline',
        number: 456,
      });
    });
  });

  describe('URL format', () => {
    it('should parse basic build URL', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1404486');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1404486,
      });
    });

    it('should parse URL with /steps/canvas suffix', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1404486/steps/canvas');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1404486,
      });
    });

    it('should parse URL with /summary suffix', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1404486/summary');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1404486,
      });
    });

    it('should parse URL with /annotations suffix', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1404486/annotations');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1404486,
      });
    });

    it('should parse URL with deeply nested path', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1404486/steps/some-step/logs');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1404486,
      });
    });

    it('should parse URL with leading @', () => {
      const result = parseBuildRef('@https://buildkite.com/myorg/mypipeline/builds/789');
      expect(result).toEqual({
        org: 'myorg',
        pipeline: 'mypipeline',
        number: 789,
      });
    });

    it('should parse http URL (not just https)', () => {
      const result = parseBuildRef('http://buildkite.com/myorg/mypipeline/builds/999');
      expect(result).toEqual({
        org: 'myorg',
        pipeline: 'mypipeline',
        number: 999,
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for empty input', () => {
      expect(() => parseBuildRef('')).toThrow('Build reference is required');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseBuildRef('invalid')).toThrow('Invalid build reference format');
    });

    it('should throw error for incomplete slug', () => {
      expect(() => parseBuildRef('org/pipeline')).toThrow('Invalid build reference format');
    });

    it('should throw error for non-numeric build number in slug', () => {
      expect(() => parseBuildRef('org/pipeline/abc')).toThrow('Invalid build reference format');
    });
  });
});
