import { describe, it, expect } from 'vitest';
import { parseBuildRef } from '../../src/utils/parseBuildRef.js';

describe('parseBuildRef', () => {
  describe('URL format', () => {
    it('should parse https build URL', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse http build URL', () => {
      const result = parseBuildRef('http://buildkite.com/gusto/zenpayroll/builds/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse URL with @ prefix', () => {
      const result = parseBuildRef('@https://buildkite.com/gusto/zenpayroll/builds/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });
  });

  describe('slash format', () => {
    it('should parse org/pipeline/number format', () => {
      const result = parseBuildRef('gusto/zenpayroll/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse with @ prefix', () => {
      const result = parseBuildRef('@gusto/zenpayroll/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });
  });

  describe('hash format (GitHub-style)', () => {
    it('should parse org/pipeline#number format', () => {
      const result = parseBuildRef('gusto/zenpayroll#1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse with @ prefix', () => {
      const result = parseBuildRef('@gusto/zenpayroll#1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should handle pipeline names with hyphens', () => {
      const result = parseBuildRef('my-org/my-pipeline#123');
      expect(result).toEqual({
        org: 'my-org',
        pipeline: 'my-pipeline',
        number: 123,
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

    it('should throw error for pipeline-only reference (no build number)', () => {
      expect(() => parseBuildRef('gusto/zenpayroll')).toThrow('Invalid build reference format');
    });

    it('should throw error for invalid build number in hash format', () => {
      expect(() => parseBuildRef('gusto/zenpayroll#abc')).toThrow('Invalid build reference format');
    });
  });
});
