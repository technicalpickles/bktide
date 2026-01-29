import { describe, it, expect } from 'vitest';
import { enhanceCommanderError } from '../../src/utils/commander-error-handler.js';

describe('enhanceCommanderError', () => {
  describe('error format consistency', () => {
    it('uses standard error format with icon', () => {
      const result = enhanceCommanderError(
        "error: missing required argument 'build'",
        'build',
        []
      );

      expect(result).toMatch(/^✖/); // Starts with error icon
    });
  });

  describe('too many arguments', () => {
    it('shows usage for builds with invalid reference', () => {
      const result = enhanceCommanderError(
        "error: too many arguments for 'builds'. Expected 0 arguments but got 1.",
        'builds',
        ['invalid']
      );

      expect(result).toContain('Unexpected argument');
      expect(result).toContain('bktide builds [org/pipeline]');
    });

    it('suggests org-only for pipelines with org/pipeline', () => {
      const result = enhanceCommanderError(
        "error: too many arguments for 'pipelines'. Expected 0 arguments but got 1.",
        'pipelines',
        ['gesso/zenpayroll']
      );

      expect(result).toContain('expects just an org');
      expect(result).toContain('bktide pipelines gesso');
    });
  });

  describe('missing required argument', () => {
    it('shows example for build command', () => {
      const result = enhanceCommanderError(
        "error: missing required argument 'build'",
        'build',
        []
      );

      expect(result).toContain('Example');
      expect(result).toContain('bktide build myorg/mypipeline/123');
    });
  });
});
