import { describe, it, expect } from 'vitest';
import { parseBuildRef } from '../../src/utils/parseBuildRef.js';

describe('parseBuildRef', () => {
  describe('URL format', () => {
    it('should parse https URL', () => {
      const result = parseBuildRef('https://buildkite.com/gusto/zenpayroll/builds/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse http URL', () => {
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

  describe('slug format (org/pipeline/number)', () => {
    it('should parse basic slug format', () => {
      const result = parseBuildRef('gusto/zenpayroll/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse slug format with @ prefix', () => {
      const result = parseBuildRef('@gusto/zenpayroll/1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse slug format with hyphenated pipeline name', () => {
      const result = parseBuildRef('gusto/gusto-karafka/346');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'gusto-karafka',
        number: 346,
      });
    });
  });

  describe('hash format (org/pipeline#number)', () => {
    it('should parse basic hash format', () => {
      const result = parseBuildRef('gusto/zenpayroll#1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse hash format with @ prefix', () => {
      const result = parseBuildRef('@gusto/zenpayroll#1400078');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'zenpayroll',
        number: 1400078,
      });
    });

    it('should parse hash format with hyphenated pipeline name', () => {
      const result = parseBuildRef('gusto/gusto-karafka#346');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'gusto-karafka',
        number: 346,
      });
    });

    it('should parse hash format with underscored pipeline name', () => {
      const result = parseBuildRef('gusto/some_pipeline#123');
      expect(result).toEqual({
        org: 'gusto',
        pipeline: 'some_pipeline',
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

    it('should throw error for incomplete slug', () => {
      expect(() => parseBuildRef('gusto/zenpayroll')).toThrow('Invalid build reference format');
    });

    it('should throw error for invalid build number in slug', () => {
      expect(() => parseBuildRef('gusto/zenpayroll/abc')).toThrow('Invalid build reference format');
    });

    it('should throw error for invalid build number in hash format', () => {
      expect(() => parseBuildRef('gusto/zenpayroll#abc')).toThrow('Invalid build reference format');
    });

    it('should include supported formats in error message', () => {
      expect(() => parseBuildRef('invalid')).toThrow('org/pipeline#number');
    });
  });
});
