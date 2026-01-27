# Smart Reference Improvements Implementation Plan

**Date:** 2025-12-09  
**Based on:** `docs/retrospective/2025-12-09-smart-reference-code-review.md`  
**Approach:** Test-Driven Development (TDD)

## Overview

This plan addresses issues identified in the code review, organized into batches for incremental delivery. Each task follows RED-GREEN-REFACTOR where applicable.

---

## Batch 1: Critical - Alfred Formatters

### Task 1.1: Create AlfredFormatter for pipeline-detail

**Files to create:**
- `src/formatters/pipeline-detail/AlfredFormatter.ts`
- `test/formatters/pipeline-detail-alfred.test.ts`

**TDD Steps:**

1. **RED** - Write failing tests first:
```typescript
// test/formatters/pipeline-detail-alfred.test.ts
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
    
    // Pipeline header + 2 builds
    expect(parsed.items.length).toBeGreaterThanOrEqual(2);
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
      ],
    };
    
    const output = formatter.format(data);
    const parsed = JSON.parse(output);
    
    // Find build items and verify they have icon property
    const buildItems = parsed.items.filter((i: any) => i.title?.includes('#'));
    expect(buildItems.length).toBe(2);
    buildItems.forEach((item: any) => {
      expect(item).toHaveProperty('icon');
      expect(item.icon).toHaveProperty('path');
    });
  });
});
```

2. **GREEN** - Implement the formatter:
```typescript
// src/formatters/pipeline-detail/AlfredFormatter.ts
import { PipelineDetailFormatter, PipelineDetailData } from './Formatter.js';
import { FormatterOptions } from '../BaseFormatter.js';
import { getAlfredIcon } from '../../utils/alfred.js';

interface AlfredItem {
  uid?: string;
  title: string;
  subtitle?: string;
  arg?: string;
  icon?: { path: string };
  valid?: boolean;
}

interface AlfredOutput {
  items: AlfredItem[];
}

export class AlfredPipelineDetailFormatter extends PipelineDetailFormatter {
  name = 'alfred';

  constructor(options: FormatterOptions) {
    super(options);
  }

  format(data: PipelineDetailData): string {
    const items: AlfredItem[] = [];
    const { pipeline, recentBuilds } = data;

    // Pipeline header item
    items.push({
      uid: `pipeline-${pipeline.slug}`,
      title: pipeline.name,
      subtitle: pipeline.description || `Pipeline: ${pipeline.slug}`,
      arg: pipeline.url,
      icon: { path: getAlfredIcon('buildkite') },
      valid: true,
    });

    // Recent builds as items
    for (const build of recentBuilds) {
      const stateIcon = this.getStateIcon(build.state);
      items.push({
        uid: `build-${pipeline.slug}-${build.number}`,
        title: `#${build.number} - ${build.message}`,
        subtitle: `${build.state} | ${build.branch}`,
        arg: `${pipeline.url}/builds/${build.number}`,
        icon: { path: stateIcon },
        valid: true,
      });
    }

    const output: AlfredOutput = { items };
    return JSON.stringify(output, null, 2);
  }

  private getStateIcon(state: string): string {
    const stateUpper = state.toUpperCase();
    switch (stateUpper) {
      case 'PASSED': return getAlfredIcon('passed');
      case 'FAILED': return getAlfredIcon('failed');
      case 'RUNNING': return getAlfredIcon('running');
      case 'BLOCKED': return getAlfredIcon('blocked');
      case 'CANCELED':
      case 'CANCELLED': return getAlfredIcon('canceled');
      default: return getAlfredIcon('unknown');
    }
  }
}
```

3. **REFACTOR** - Update exports:
```typescript
// src/formatters/pipeline-detail/index.ts
export * from './Formatter.js';
export * from './PlainFormatter.js';
export * from './JsonFormatter.js';
export * from './AlfredFormatter.js';
```

**Verification:**
```bash
npm test -- test/formatters/pipeline-detail-alfred.test.ts
```

---

### Task 1.2: Create AlfredFormatter for step-logs

**Files to create:**
- `src/formatters/step-logs/AlfredFormatter.ts`
- `test/formatters/step-logs-alfred.test.ts`

**TDD Steps:**

1. **RED** - Write failing tests:
```typescript
// test/formatters/step-logs-alfred.test.ts
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
    
    const logItem = parsed.items.find((i: any) => 
      i.subtitle?.includes('lines') || i.title?.includes('Log')
    );
    expect(logItem).toBeDefined();
  });

  it('should use appropriate icon for step state', () => {
    const formatter = new AlfredStepLogsFormatter({});
    const output = formatter.format(baseData);
    const parsed = JSON.parse(output);
    
    expect(parsed.items.some((i: any) => i.icon?.path?.includes('failed'))).toBe(true);
  });
});
```

2. **GREEN** - Implement the formatter (similar structure to pipeline-detail)

3. **REFACTOR** - Update exports in `src/formatters/step-logs/index.ts`

**Verification:**
```bash
npm test -- test/formatters/step-logs-alfred.test.ts
```

---

### Task 1.3: Update SmartShow to use Alfred formatters

**File to modify:** `src/commands/SmartShow.ts`

**Changes:**
- Import `AlfredPipelineDetailFormatter` and `AlfredStepLogsFormatter`
- Update format selection logic to use Alfred formatters when `format === 'alfred'`

**Test:** Manual verification with `bktide org/pipeline --format alfred`

---

## Batch 2: Important - Shared Utilities & Type Safety

### Task 2.1: Extract shared formatting utilities

**Files to create:**
- `src/utils/formatUtils.ts`
- `test/utils/formatUtils.test.ts`

**TDD Steps:**

1. **RED** - Write tests for each utility function:
```typescript
// test/utils/formatUtils.test.ts
import { describe, it, expect } from 'vitest';
import {
  formatStatus,
  formatRelativeDate,
  formatDuration,
  formatSize,
  truncate,
} from '../../src/utils/formatUtils.js';

describe('formatUtils', () => {
  describe('formatStatus', () => {
    it('should format PASSED state with checkmark', () => {
      const result = formatStatus('PASSED');
      expect(result).toContain('passed');
      expect(result).toContain('✓');
    });

    it('should format FAILED state with X', () => {
      const result = formatStatus('FAILED');
      expect(result).toContain('failed');
      expect(result).toContain('✖');
    });

    it('should format RUNNING state', () => {
      const result = formatStatus('RUNNING');
      expect(result).toContain('running');
    });

    it('should handle lowercase input', () => {
      const result = formatStatus('passed');
      expect(result).toContain('passed');
    });

    it('should handle null/undefined gracefully', () => {
      expect(formatStatus(null as any)).toContain('unknown');
      expect(formatStatus(undefined as any)).toContain('unknown');
    });
  });

  describe('formatRelativeDate', () => {
    it('should format recent date as "just now"', () => {
      const result = formatRelativeDate(new Date().toISOString());
      expect(result).toBe('just now');
    });

    it('should format minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('5m ago');
    });

    it('should format hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('3h ago');
    });

    it('should format days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const result = formatRelativeDate(date.toISOString());
      expect(result).toBe('2d ago');
    });
  });

  describe('formatDuration', () => {
    it('should format seconds only', () => {
      const result = formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:00:45Z');
      expect(result).toBe('45s');
    });

    it('should format minutes and seconds', () => {
      const result = formatDuration('2024-01-01T10:00:00Z', '2024-01-01T10:05:30Z');
      expect(result).toBe('5m 30s');
    });

    it('should handle zero duration', () => {
      const time = '2024-01-01T10:00:00Z';
      const result = formatDuration(time, time);
      expect(result).toBe('0s');
    });
  });

  describe('formatSize', () => {
    it('should format bytes', () => {
      expect(formatSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatSize(5000)).toBe('4.9 KB');
    });

    it('should format megabytes', () => {
      expect(formatSize(5000000)).toBe('4.8 MB');
    });

    it('should handle zero', () => {
      expect(formatSize(0)).toBe('0 B');
    });
  });

  describe('truncate', () => {
    it('should return unchanged if shorter than limit', () => {
      expect(truncate('short', 50)).toBe('short');
    });

    it('should truncate and add ellipsis', () => {
      const long = 'This is a very long string';
      const result = truncate(long, 15);
      expect(result).toBe('This is a ve...');
      expect(result.length).toBe(15);
    });

    it('should replace newlines with spaces', () => {
      const result = truncate('line1\nline2\nline3', 100);
      expect(result).toBe('line1 line2 line3');
    });
  });
});
```

2. **GREEN** - Implement the utilities:
```typescript
// src/utils/formatUtils.ts
import { SEMANTIC_COLORS } from '../ui/theme.js';

export function formatStatus(state: string | null | undefined): string {
  if (!state) return SEMANTIC_COLORS.dim('unknown');
  
  const stateUpper = state.toUpperCase();
  
  switch (stateUpper) {
    case 'PASSED':
      return SEMANTIC_COLORS.success('✓ passed');
    case 'FAILED':
      return SEMANTIC_COLORS.error('✖ failed');
    case 'RUNNING':
      return SEMANTIC_COLORS.info('↻ running');
    case 'BLOCKED':
      return SEMANTIC_COLORS.warning('⚠ blocked');
    case 'CANCELED':
    case 'CANCELLED':
      return SEMANTIC_COLORS.dim('− canceled');
    case 'SKIPPED':
      return SEMANTIC_COLORS.dim('− skipped');
    default:
      return SEMANTIC_COLORS.dim(`− ${state.toLowerCase()}`);
  }
}

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function formatDuration(startStr: string, endStr: string): string {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = end.getTime() - start.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncate(str: string, length: number): string {
  const singleLine = str.replace(/\n+/g, ' ').trim();
  if (singleLine.length <= length) return singleLine;
  return singleLine.slice(0, length - 3) + '...';
}
```

3. **REFACTOR** - Update formatters to use shared utilities

**Files to modify:**
- `src/formatters/pipeline-detail/PlainFormatter.ts` - Remove duplicate methods, import from formatUtils
- `src/formatters/step-logs/PlainFormatter.ts` - Remove duplicate methods, import from formatUtils

**Verification:**
```bash
npm test -- test/utils/formatUtils.test.ts
npm test -- test/formatters/pipeline-detail.test.ts
npm test -- test/formatters/step-logs.test.ts
```

---

### Task 2.2: Add proper types to REST client methods

**File to modify:** `src/services/BuildkiteRestClient.ts`

**Changes:**

1. Import `JobLog` type:
```typescript
import { JobLog } from '../types/buildkite.js';
```

2. Update method signatures:
```typescript
public async getJobLog(
  org: string,
  pipeline: string,
  buildNumber: number,
  jobId: string
): Promise<JobLog> {
  // ... existing implementation
}

// Define or import Build type for getPipelineBuilds
public async getPipelineBuilds(
  org: string,
  pipeline: string,
  params?: { ... }
): Promise<Build[]> {
  // ... existing implementation
}
```

**No tests needed** - This is a type-only change verified by TypeScript compilation.

**Verification:**
```bash
npm run build
```

---

## Batch 3: Important - Consistency & UX

### Task 3.1: Replace console.log with logger.console

**File to modify:** `src/commands/SmartShow.ts`

**Changes:**
Lines 115, 191, 234: Replace `console.log(output)` with `logger.console(output)`

**Verification:**
```bash
npm run build
# Manual test: bktide org/pipeline -q (should respect quiet mode)
```

---

### Task 3.2: Add progress spinners

**File to modify:** `src/commands/SmartShow.ts`

**TDD Steps:**

1. **RED** - Write test for spinner behavior (integration-style):
```typescript
// Add to existing SmartShow tests or create new file
// Note: Spinner behavior is typically tested via visual inspection
// but we can verify the imports and method structure
```

2. **GREEN** - Add spinners to each method:

```typescript
// In showPipeline():
private async showPipeline(...): Promise<number> {
  const format = options.format || 'plain';
  const spinner = Progress.spinner('Fetching pipeline details...', { format });
  
  try {
    this.token = await BaseCommand.getToken(options);
    const pipeline = await this.client.getPipeline(ref.org, ref.pipeline);
    spinner.stop();
    
    // ... rest of implementation
  } catch (error) {
    spinner.stop();
    // ... error handling
  }
}

// In showBuildWithStep():
private async showBuildWithStep(...): Promise<number> {
  const format = options.format || 'plain';
  const spinner = Progress.spinner('Fetching step logs...', { format });
  
  try {
    // ... implementation
    spinner.stop();
  } catch (error) {
    spinner.stop();
    // ... error handling
  }
}
```

**Verification:**
```bash
npm run build
# Manual test with slow network or large logs
```

---

### Task 3.3: Improve error handling with formatters

**File to modify:** `src/commands/SmartShow.ts`

**TDD Steps:**

1. **RED** - Define error formatting interface/tests:
```typescript
// Test that error output follows expected format
describe('SmartShow error handling', () => {
  it('should format errors consistently with other commands', () => {
    // Test error output format
  });
});
```

2. **GREEN** - Implement structured error handling:
```typescript
// In catch blocks, use formatter:
} catch (error) {
  spinner.stop();
  
  if (error instanceof Error) {
    const formatter = this.getErrorFormatter(options.format);
    const errorOutput = formatter.formatError({
      message: error.message,
      type: this.classifyError(error),
      suggestions: this.getErrorSuggestions(error),
    });
    logger.console(errorOutput);
  }
  return 1;
}
```

**Verification:**
```bash
npm test
# Manual test with invalid references
```

---

### Task 3.4: Fix pipeline tip to include org

**File to modify:** `src/formatters/pipeline-detail/PlainFormatter.ts`

**Change:**
```typescript
// Line 55 - need to pass org to formatter or extract from pipeline URL
const tips = formatTips([
  `View a build: bktide ${ref.org}/${pipeline.slug}/<number>`,
  'Use --format json for machine-readable output',
], TipStyle.GROUPED);
```

**Issue:** The formatter doesn't have access to `org`. Options:
1. Include org in `PipelineDetailData` interface
2. Extract org from pipeline URL

**Recommended:** Add org to data interface:
```typescript
// src/formatters/pipeline-detail/Formatter.ts
export interface PipelineDetailData {
  org: string;  // Add this
  pipeline: { ... };
  recentBuilds: [...];
}
```

Then update SmartShow to pass org when creating data.

**Verification:**
```bash
npm test -- test/formatters/pipeline-detail.test.ts
# Manual test: verify tip shows full reference
```

---

## Batch 4: Minor Improvements

### Task 4.1: Add days to step-logs formatDate

**File to modify:** `src/formatters/step-logs/PlainFormatter.ts`

After Task 2.1, this is handled by using the shared `formatRelativeDate` utility.

---

### Task 4.2: Improve REST client tests

**File to modify:** `test/services/BuildkiteRestClient.logs.test.ts`

**TDD Steps:**

1. Add actual tests with mocked responses:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildkiteRestClient } from '../../src/services/BuildkiteRestClient.js';

describe('BuildkiteRestClient - Log Fetching', () => {
  it('should return JobLog structure from getJobLog', async () => {
    const client = new BuildkiteRestClient('test-token', { caching: false });
    
    // Mock the internal get method
    vi.spyOn(client as any, 'get').mockResolvedValue({
      url: 'https://example.com/log',
      content: 'Log content here',
      size: 1024,
      header_times: [0, 100, 200],
    });
    
    const result = await client.getJobLog('org', 'pipeline', 1, 'job-id');
    
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('size');
    expect(result).toHaveProperty('header_times');
  });

  it('should cache log responses', async () => {
    const client = new BuildkiteRestClient('test-token', { caching: true });
    const getSpy = vi.spyOn(client as any, 'get').mockResolvedValue({
      url: 'https://example.com/log',
      content: 'Log content',
      size: 100,
      header_times: [],
    });
    
    await client.getJobLog('org', 'pipeline', 1, 'job-id');
    await client.getJobLog('org', 'pipeline', 1, 'job-id');
    
    // Second call should use cache
    expect(getSpy).toHaveBeenCalledTimes(1);
  });
});
```

**Verification:**
```bash
npm test -- test/services/BuildkiteRestClient.logs.test.ts
```

---

## Implementation Order

| Batch | Task | Description | Effort | Dependencies |
|-------|------|-------------|--------|--------------|
| 1 | 1.1 | Alfred formatter for pipeline-detail | Medium | None |
| 1 | 1.2 | Alfred formatter for step-logs | Medium | None |
| 1 | 1.3 | Update SmartShow for Alfred | Low | 1.1, 1.2 |
| 2 | 2.1 | Shared formatting utilities | Medium | None |
| 2 | 2.2 | REST client type safety | Low | None |
| 3 | 3.1 | logger.console replacement | Low | None |
| 3 | 3.2 | Progress spinners | Low | None |
| 3 | 3.3 | Structured error handling | Medium | None |
| 3 | 3.4 | Fix pipeline tip | Low | None |
| 4 | 4.1 | Days in step-logs formatDate | Low | 2.1 |
| 4 | 4.2 | REST client tests | Medium | 2.2 |

---

## Verification Checklist

After all batches complete:

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm test` passes all tests
- [ ] `npm run lint` passes (if configured)
- [ ] Manual test: `bktide org/pipeline` shows pipeline with correct tip
- [ ] Manual test: `bktide org/pipeline --format alfred` returns valid Alfred JSON
- [ ] Manual test: `bktide org/pipeline/123?sid=xxx --format alfred` returns valid Alfred JSON
- [ ] Manual test: `bktide invalid-reference` shows formatted error
- [ ] Manual test: Progress spinner appears during slow operations
- [ ] Manual test: `-q` flag suppresses output appropriately

---

## Notes

- Tasks in the same batch can be parallelized if working with multiple developers
- Batch 1 is critical and should be completed first
- Batch 2 enables cleaner code for subsequent batches
- After Batch 2.1, some tests in Batch 4.1 may become redundant (handled by shared utils)
