import { describe, it, expect } from 'vitest';
import { GuidanceError } from '../../src/errors/index.js';
import { PlainTextFormatter } from '../../src/formatters/errors/PlainTextFormatter.js';

describe('PlainTextFormatter with GuidanceError', () => {
  const formatter = new PlainTextFormatter();

  it('should render guidance text directly without error chrome', () => {
    const guidance = '## Setup Required\n\nRun: bktide token --store';
    const error = new GuidanceError(guidance);
    const output = formatter.formatError(error);

    expect(output).toBe(guidance);
  });

  it('should not include tips or hints', () => {
    const error = new GuidanceError('Token missing');
    const output = formatter.formatError(error);

    expect(output).not.toContain('To fix this');
    expect(output).not.toContain('--debug');
    expect(output).not.toContain('ERROR');
  });

  it('should not include error name or icon', () => {
    const error = new GuidanceError('Some guidance');
    const output = formatter.formatError(error);

    // Should be exactly the guidance, nothing more
    expect(output).toBe('Some guidance');
  });

  it('should handle GuidanceError mixed with regular errors', () => {
    const guidanceError = new GuidanceError('Custom guidance');
    const regularError = new Error('Something broke');
    const output = formatter.formatError([guidanceError, regularError]);

    // Guidance should appear without chrome
    expect(output).toContain('Custom guidance');
    // Regular error should still get normal formatting
    expect(output).toContain('ERROR');
    expect(output).toContain('Something broke');
  });
});
