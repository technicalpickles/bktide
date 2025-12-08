import { describe, it, expect } from 'vitest';
import { parseBuildkiteReference } from '../../src/utils/parseBuildkiteReference.js';

describe('parseBuildkiteReference', () => {
  describe('pipeline references', () => {
    it('should parse slash format pipeline reference', () => {
      const result = parseBuildkiteReference('gusto/schemaflow');
      expect(result).toEqual({
        type: 'pipeline',
        org: 'gusto',
        pipeline: 'schemaflow',
      });
    });

    it('should handle trailing slashes', () => {
      const result = parseBuildkiteReference('gusto/schemaflow/');
      expect(result).toEqual({
        type: 'pipeline',
        org: 'gusto',
        pipeline: 'schemaflow',
      });
    });

    it('should parse pipeline URL format', () => {
      const result = parseBuildkiteReference('https://buildkite.com/gusto/schemaflow');
      expect(result).toEqual({
        type: 'pipeline',
        org: 'gusto',
        pipeline: 'schemaflow',
      });
    });
  });

  describe('build references', () => {
    it('should parse slash format build reference', () => {
      const result = parseBuildkiteReference('gusto/schemaflow/76');
      expect(result).toEqual({
        type: 'build',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
      });
    });

    it('should parse hash format build reference', () => {
      const result = parseBuildkiteReference('gusto/schemaflow#76');
      expect(result).toEqual({
        type: 'build',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
      });
    });

    it('should parse build URL', () => {
      const result = parseBuildkiteReference('https://buildkite.com/gusto/schemaflow/builds/76');
      expect(result).toEqual({
        type: 'build',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
      });
    });

    it('should handle http URLs and normalize to https', () => {
      const result = parseBuildkiteReference('http://buildkite.com/gusto/schemaflow/builds/76');
      expect(result).toEqual({
        type: 'build',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
      });
    });

    it('should ignore /steps/canvas path segments', () => {
      const result = parseBuildkiteReference('https://buildkite.com/gusto/schemaflow/builds/76/steps/canvas');
      expect(result).toEqual({
        type: 'build',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
      });
    });
  });

  describe('build with step references', () => {
    it('should parse URL with step ID query parameter', () => {
      const result = parseBuildkiteReference('https://buildkite.com/gusto/schemaflow/builds/76?sid=019adb19-bd83-4149-b2a7-ece1d7a41c9d');
      expect(result).toEqual({
        type: 'build-with-step',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
        stepId: '019adb19-bd83-4149-b2a7-ece1d7a41c9d',
      });
    });

    it('should extract step ID from URL with path segments', () => {
      const result = parseBuildkiteReference('https://buildkite.com/gusto/schemaflow/builds/76/steps/canvas?sid=019adb19-bd83-4149-b2a7-ece1d7a41c9d');
      expect(result).toEqual({
        type: 'build-with-step',
        org: 'gusto',
        pipeline: 'schemaflow',
        buildNumber: 76,
        stepId: '019adb19-bd83-4149-b2a7-ece1d7a41c9d',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error for empty input', () => {
      expect(() => parseBuildkiteReference('')).toThrow('Invalid Buildkite reference');
    });

    it('should throw error for invalid format', () => {
      expect(() => parseBuildkiteReference('invalid')).toThrow('Invalid Buildkite reference');
    });

    it('should throw error for invalid build number', () => {
      expect(() => parseBuildkiteReference('gusto/schemaflow/abc')).toThrow('Invalid build number');
    });

    it('should throw error for invalid hostname', () => {
      expect(() => parseBuildkiteReference('https://example.com/gusto/schemaflow')).toThrow('Invalid Buildkite URL: expected buildkite.com, got example.com');
    });
  });
});
