import { describe, it, expect } from 'vitest';
import { AlfredStepLogsFormatter } from '../../src/formatters/step-logs/AlfredFormatter.js';
import { StepLogsData } from '../../src/formatters/step-logs/Formatter.js';

describe('AlfredStepLogsFormatter', () => {
  const baseData: StepLogsData = {
    build: {
      org: 'my-org',
      pipeline: 'my-pipeline',
      number: 123,
      state: 'FAILED',
      url: 'https://buildkite.com/my-org/my-pipeline/builds/123',
    },
    step: {
      id: 'step-123',
      label: 'Run Tests',
      state: 'FAILED',
      exitStatus: 1,
    },
    logs: {
      content: 'Error: Test failed\nAssertionError: expected true',
      size: 1024,
      totalLines: 100,
      displayedLines: 50,
      startLine: 50,
    },
  };

  it('should return valid Alfred JSON structure', () => {
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(baseData);
    const parsed = JSON.parse(output);

    expect(parsed).toHaveProperty('items');
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it('should include build info item', () => {
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(baseData);
    const parsed = JSON.parse(output);

    const buildItem = parsed.items.find((i: any) => i.title?.includes('#123'));
    expect(buildItem).toBeDefined();
    expect(buildItem.arg).toBe(baseData.build.url);
  });

  it('should include step info item', () => {
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(baseData);
    const parsed = JSON.parse(output);

    const stepItem = parsed.items.find((i: any) => i.title?.includes('Run Tests'));
    expect(stepItem).toBeDefined();
  });

  it('should include log summary item', () => {
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(baseData);
    const parsed = JSON.parse(output);

    const logItem = parsed.items.find(
      (i: any) => i.subtitle?.includes('lines') || i.title?.includes('Log')
    );
    expect(logItem).toBeDefined();
  });

  it('should use appropriate icon for step state', () => {
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(baseData);
    const parsed = JSON.parse(output);

    expect(parsed.items.some((i: any) => i.icon?.path?.includes('failed'))).toBe(true);
  });

  it('should use passed icon for passed step state', () => {
    const passedData: StepLogsData = {
      ...baseData,
      build: { ...baseData.build, state: 'PASSED' },
      step: { ...baseData.step, state: 'PASSED', exitStatus: 0 },
    };
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(passedData);
    const parsed = JSON.parse(output);

    expect(parsed.items.some((i: any) => i.icon?.path?.includes('passed'))).toBe(true);
  });

  it('should handle step without label', () => {
    const noLabelData: StepLogsData = {
      ...baseData,
      step: { ...baseData.step, label: undefined },
    };
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(noLabelData);
    const parsed = JSON.parse(output);

    // Should still have step item, but with step ID or fallback
    expect(parsed.items.length).toBeGreaterThan(0);
    expect(Array.isArray(parsed.items)).toBe(true);
  });
});
