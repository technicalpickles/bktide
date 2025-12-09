import { describe, it, expect } from 'vitest';
import { AlfredPipelineDetailFormatter } from '../../src/formatters/pipeline-detail/AlfredFormatter.js';
import { PipelineDetailData } from '../../src/formatters/pipeline-detail/Formatter.js';

describe('AlfredPipelineDetailFormatter', () => {
  it('should return valid Alfred JSON structure', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'My Pipeline',
        slug: 'my-pipeline',
        url: 'https://buildkite.com/org/my-pipeline',
      },
      recentBuilds: [],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    expect(parsed).toHaveProperty('items');
    expect(Array.isArray(parsed.items)).toBe(true);
  });

  it('should create item for pipeline with URL action', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'My Pipeline',
        slug: 'my-pipeline',
        url: 'https://buildkite.com/org/my-pipeline',
        description: 'Test pipeline',
      },
      recentBuilds: [],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    expect(parsed.items[0].title).toBe('My Pipeline');
    expect(parsed.items[0].subtitle).toContain('Test pipeline');
    expect(parsed.items[0].arg).toBe('https://buildkite.com/org/my-pipeline');
  });

  it('should use pipeline slug in subtitle when no description', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'My Pipeline',
        slug: 'my-pipeline',
        url: 'https://buildkite.com/org/my-pipeline',
      },
      recentBuilds: [],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    expect(parsed.items[0].subtitle).toContain('my-pipeline');
  });

  it('should include recent builds as items', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'Pipeline',
        slug: 'pipeline',
        url: 'https://buildkite.com/org/pipeline',
      },
      recentBuilds: [
        { number: 123, state: 'PASSED', branch: 'main', message: 'Fix bug' },
        { number: 122, state: 'FAILED', branch: 'feature', message: 'Add feature' },
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    // Pipeline header + 2 builds = 3 items
    expect(parsed.items.length).toBe(3);
  });

  it('should use appropriate icons for build states', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'Pipeline',
        slug: 'pipeline',
        url: 'https://buildkite.com/org/pipeline',
      },
      recentBuilds: [
        { number: 1, state: 'PASSED', branch: 'main', message: 'Test' },
        { number: 2, state: 'FAILED', branch: 'main', message: 'Test' },
        { number: 3, state: 'RUNNING', branch: 'main', message: 'Test' },
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    // Find build items (skip first which is pipeline header)
    const buildItems = parsed.items.slice(1);
    expect(buildItems.length).toBe(3);
    
    // Each build should have an icon
    buildItems.forEach((item: any) => {
      expect(item).toHaveProperty('icon');
      expect(item.icon).toHaveProperty('path');
    });
    
    // Verify specific icon paths
    expect(buildItems[0].icon.path).toBe('icons/passed.png');
    expect(buildItems[1].icon.path).toBe('icons/failed.png');
    expect(buildItems[2].icon.path).toBe('icons/running.png');
  });

  it('should format build titles with number and message', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'Pipeline',
        slug: 'pipeline',
        url: 'https://buildkite.com/org/pipeline',
      },
      recentBuilds: [
        { number: 123, state: 'PASSED', branch: 'main', message: 'Fix important bug' },
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    const buildItem = parsed.items[1];
    expect(buildItem.title).toContain('#123');
    expect(buildItem.title).toContain('Fix important bug');
  });

  it('should format build subtitles with state and branch', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'Pipeline',
        slug: 'pipeline',
        url: 'https://buildkite.com/org/pipeline',
      },
      recentBuilds: [
        { number: 123, state: 'PASSED', branch: 'main', message: 'Test' },
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    const buildItem = parsed.items[1];
    expect(buildItem.subtitle).toContain('PASSED');
    expect(buildItem.subtitle).toContain('main');
  });

  it('should construct build URLs from pipeline URL', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'Pipeline',
        slug: 'pipeline',
        url: 'https://buildkite.com/org/pipeline',
      },
      recentBuilds: [
        { number: 123, state: 'PASSED', branch: 'main', message: 'Test' },
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    const buildItem = parsed.items[1];
    expect(buildItem.arg).toBe('https://buildkite.com/org/pipeline/builds/123');
  });

  it('should handle unknown build states', () => {
    const formatter = new AlfredPipelineDetailFormatter({});
    const data: PipelineDetailData = {
      pipeline: {
        name: 'Pipeline',
        slug: 'pipeline',
        url: 'https://buildkite.com/org/pipeline',
      },
      recentBuilds: [
        { number: 1, state: 'SOME_UNKNOWN_STATE', branch: 'main', message: 'Test' },
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    const buildItem = parsed.items[1];
    expect(buildItem.icon.path).toBe('icons/unknown.png');
  });
});
