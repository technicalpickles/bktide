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
    it('suggests --org and --pipeline for builds with org/pipeline pattern', () => {
      const result = enhanceCommanderError(
        "error: too many arguments for 'builds'. Expected 0 arguments but got 1.",
        'builds',
        ['gesso/zenpayroll']
      );

      expect(result).toContain('Did you mean');
      expect(result).toContain('--org gesso --pipeline zenpayroll');
    });

    it('suggests --org for pipelines with single arg', () => {
      const result = enhanceCommanderError(
        "error: too many arguments for 'pipelines'. Expected 0 arguments but got 1.",
        'pipelines',
        ['gesso']
      );

      expect(result).toContain('Did you mean');
      expect(result).toContain('--org gesso');
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
