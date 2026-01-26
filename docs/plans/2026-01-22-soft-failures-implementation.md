# Soft Failures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add support for distinguishing soft failures (non-blocking job failures) from hard failures in build output.

**Architecture:** Add `softFailed` field to GraphQL fragments, update job classification logic to distinguish soft/hard failures, modify formatters to display soft failures with yellow triangle symbol, migrate snapshot command to use GraphQL for consistency.

**Tech Stack:** TypeScript, GraphQL (graphql-request), Vitest, date-fns

---

## Task 1: Add softFailed to GraphQL Fragments

**Files:**
- Modify: `src/graphql/fragments/jobs.ts:8-30`
- Modify: `src/graphql/fragments/jobs.ts:38-75`

**Step 1: Add softFailed to JOB_SUMMARY_FIELDS fragment**

Update the fragment to include `softFailed` field:

```typescript
export const JOB_SUMMARY_FIELDS = gql`
  fragment JobSummaryFields on JobInterface {
    ... on JobTypeCommand {
      id
      uuid
      label
      state
      exitStatus
      startedAt
      finishedAt
      passed
      softFailed
      parallelGroupIndex
      parallelGroupTotal
    }
    ... on JobTypeWait {
      id
      label
    }
    ... on JobTypeTrigger {
      id
      label
      state
    }
  }
`;
```

**Step 2: Add softFailed to JOB_DETAIL_FIELDS fragment**

Update the fragment to include `softFailed` field:

```typescript
export const JOB_DETAIL_FIELDS = gql`
  fragment JobDetailFields on JobInterface {
    ... on JobTypeCommand {
      id
      uuid
      label
      command
      state
      exitStatus
      startedAt
      finishedAt
      passed
      softFailed
      retried
      parallelGroupIndex
      parallelGroupTotal
      retrySource {
        ... on JobTypeCommand {
          id
          uuid
        }
      }
      agent {
        ... on Agent {
          id
          name
          hostname
        }
      }
    }
    ... on JobTypeWait {
      id
      label
    }
    ... on JobTypeTrigger {
      id
      label
      state
    }
  }
`;
```

**Step 3: Regenerate GraphQL types**

Run: `npm run codegen`
Expected: Types regenerated successfully

**Step 4: Commit GraphQL changes**

```bash
git add src/graphql/fragments/jobs.ts
git commit -m "feat: add softFailed field to GraphQL job fragments"
```

---

## Task 2: Add Soft Failure Icon to Theme

**Files:**
- Modify: `src/ui/theme.ts`
- Test: Manual verification after later tasks

**Step 1: Add SOFT_FAILED case to getStateIcon**

Find the `getStateIcon` function and add the SOFT_FAILED case:

```typescript
export function getStateIcon(state: string): string {
  const upperState = state.toUpperCase();
  const ascii = useAscii();

  switch (upperState) {
    case 'PASSED':
      return ascii ? 'OK' : '✓';
    case 'FAILED':
      return ascii ? 'X' : '✗';
    case 'SOFT_FAILED':
      return ascii ? '^' : '▲';
    case 'RUNNING':
      return ascii ? '~' : '⟳';
    case 'SCHEDULED':
      return ascii ? '...' : '⏱';
    case 'BLOCKED':
      return ascii ? '#' : '◼';
    case 'CANCELED':
    case 'CANCELLED':
      return ascii ? 'O' : '⊘';
    case 'SKIPPED':
      return ascii ? '-' : '⊙';
    case 'BROKEN':
      return ascii ? 'X' : '⊗';
    default:
      return ascii ? '?' : '•';
  }
}
```

**Step 2: Add SOFT_FAILED to BUILD_STATUS_THEME**

Find the `BUILD_STATUS_THEME` object and add soft failure theme:

```typescript
export const BUILD_STATUS_THEME = {
  PASSED: { color: SEMANTIC_COLORS.success, bgColor: SEMANTIC_COLORS.successBg },
  FAILED: { color: SEMANTIC_COLORS.error, bgColor: SEMANTIC_COLORS.errorBg },
  SOFT_FAILED: { color: SEMANTIC_COLORS.warning, bgColor: SEMANTIC_COLORS.warningBg },
  RUNNING: { color: SEMANTIC_COLORS.info, bgColor: SEMANTIC_COLORS.infoBg },
  BLOCKED: { color: SEMANTIC_COLORS.warning, bgColor: SEMANTIC_COLORS.warningBg },
  CANCELED: { color: SEMANTIC_COLORS.muted, bgColor: SEMANTIC_COLORS.mutedBg },
  CANCELLED: { color: SEMANTIC_COLORS.muted, bgColor: SEMANTIC_COLORS.mutedBg },
  SCHEDULED: { color: SEMANTIC_COLORS.info, bgColor: SEMANTIC_COLORS.infoBg },
  SKIPPED: { color: SEMANTIC_COLORS.muted, bgColor: SEMANTIC_COLORS.mutedBg },
  BROKEN: { color: SEMANTIC_COLORS.muted, bgColor: SEMANTIC_COLORS.mutedBg }
};
```

**Step 3: Commit theme changes**

```bash
git add src/ui/theme.ts
git commit -m "feat: add soft failure icon and theme to UI"
```

---

## Task 3: Update Job Classification Logic

**Files:**
- Modify: `src/formatters/build-detail/PlainTextFormatter.ts:974-1035`
- Test: `test/formatters/build-detail-display.test.ts`

**Step 1: Write tests for job classification**

Add tests to verify soft failure classification:

```typescript
describe('soft failure classification', () => {
  it('should classify job with exitStatus=1 and softFailed=true as soft failure', () => {
    const jobs = [{
      node: {
        state: 'FINISHED',
        exitStatus: '1',
        passed: false,
        softFailed: true
      }
    }];

    const formatter = new PlainTextFormatter();
    const stats = (formatter as any).getJobStats(jobs);

    expect(stats.softFailed).toBe(1);
    expect(stats.failed).toBe(0);
  });

  it('should classify job with exitStatus=1 and softFailed=false as hard failure', () => {
    const jobs = [{
      node: {
        state: 'FINISHED',
        exitStatus: '1',
        passed: false,
        softFailed: false
      }
    }];

    const formatter = new PlainTextFormatter();
    const stats = (formatter as any).getJobStats(jobs);

    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(0);
  });

  it('should treat null/undefined softFailed as hard failure', () => {
    const jobs = [{
      node: {
        state: 'FINISHED',
        exitStatus: '1',
        passed: false,
        softFailed: null
      }
    }];

    const formatter = new PlainTextFormatter();
    const stats = (formatter as any).getJobStats(jobs);

    expect(stats.failed).toBe(1);
    expect(stats.softFailed).toBe(0);
  });

  it('should count soft failures separately in mixed failure stats', () => {
    const jobs = [
      { node: { exitStatus: '0', passed: true, softFailed: false } },
      { node: { exitStatus: '1', passed: false, softFailed: true } },
      { node: { exitStatus: '1', passed: false, softFailed: false } }
    ];

    const formatter = new PlainTextFormatter();
    const stats = (formatter as any).getJobStats(jobs);

    expect(stats.passed).toBe(1);
    expect(stats.softFailed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.total).toBe(3);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- test/formatters/build-detail-display.test.ts`
Expected: FAIL - softFailed property doesn't exist in stats

**Step 3: Update getJobStats to track soft failures**

Modify the `getJobStats` method in `PlainTextFormatter.ts`:

```typescript
private getJobStats(jobs: any[]): any {
  const stats = {
    total: jobs?.length || 0,
    passed: 0,
    failed: 0,
    softFailed: 0,
    running: 0,
    blocked: 0,
    skipped: 0,
    canceled: 0,
    queued: 0,
    completed: 0
  };

  if (!jobs) return stats;

  for (const job of jobs) {
    const state = job.node.state?.toUpperCase() || '';

    // If we have an exit status, use that as the source of truth
    if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
      const exitCode = parseInt(job.node.exitStatus, 10);
      if (exitCode === 0) {
        stats.passed++;
        stats.completed++;
      } else {
        // Non-zero exit: check if soft failure
        if (job.node.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        stats.completed++;
      }
    } else if (state === 'RUNNING') {
      stats.running++;
    } else if (state === 'BLOCKED') {
      stats.blocked++;
    } else if (state === 'CANCELED' || state === 'CANCELLED') {
      stats.canceled++;
      stats.completed++;
    } else if (state === 'SKIPPED' || state === 'BROKEN') {
      stats.skipped++;
      stats.completed++;
    } else if (state === 'SCHEDULED' || state === 'ASSIGNED') {
      stats.queued++;
    } else if (state === 'FINISHED' || state === 'COMPLETED') {
      // For finished jobs without exit status, check passed field
      if (job.node.passed === true) {
        stats.passed++;
        stats.completed++;
      } else if (job.node.passed === false) {
        // Check softFailed for finished jobs too
        if (job.node.softFailed === true) {
          stats.softFailed++;
        } else {
          stats.failed++;
        }
        stats.completed++;
      }
    } else if (state === 'PASSED' || job.node.passed === true) {
      stats.passed++;
      stats.completed++;
    } else if (state === 'FAILED' || job.node.passed === false) {
      // Check softFailed for explicitly failed jobs
      if (job.node.softFailed === true) {
        stats.softFailed++;
      } else {
        stats.failed++;
      }
      stats.completed++;
    }
  }

  return stats;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- test/formatters/build-detail-display.test.ts`
Expected: PASS - all soft failure classification tests pass

**Step 5: Commit classification logic**

```bash
git add src/formatters/build-detail/PlainTextFormatter.ts test/formatters/build-detail-display.test.ts
git commit -m "feat: add soft failure classification to job statistics"
```

---

## Task 4: Update Job Summary Display

**Files:**
- Modify: `src/formatters/build-detail/PlainTextFormatter.ts:528-596`
- Test: Manual verification with real builds

**Step 1: Update formatJobSummary to show soft failures**

Modify the `formatJobSummary` method to include soft failures in the count:

```typescript
private formatJobSummary(jobsData: any, buildState: string): string {
  const jobs = jobsData?.edges;
  if (!jobs || jobs.length === 0) {
    return '';
  }

  const lines: string[] = [];
  const jobStats = this.getJobStats(jobs);

  // Build summary parts based on job states
  const countParts = [];
  if (jobStats.failed > 0) countParts.push(SEMANTIC_COLORS.error(`${jobStats.failed} failed`));
  if (jobStats.softFailed > 0) countParts.push(SEMANTIC_COLORS.warning(`▲ ${jobStats.softFailed} soft failure${jobStats.softFailed > 1 ? 's' : ''}`));
  if (jobStats.passed > 0) countParts.push(SEMANTIC_COLORS.success(`${jobStats.passed} passed`));
  if (jobStats.running > 0) countParts.push(SEMANTIC_COLORS.info(`${jobStats.running} running`));
  if (jobStats.blocked > 0) countParts.push(SEMANTIC_COLORS.warning(`${jobStats.blocked} blocked`));
  if (jobStats.canceled > 0) countParts.push(SEMANTIC_COLORS.muted(`${jobStats.canceled} canceled`));

  // Use appropriate icon based on build state
  const icon = buildState === 'FAILED' ? getStateIcon('FAILED') :
               buildState === 'RUNNING' ? getStateIcon('RUNNING') :
               buildState === 'PASSED' ? getStateIcon('PASSED') :
               buildState === 'BLOCKED' ? getStateIcon('BLOCKED') : '•';

  // Check if we have partial data
  const hasMorePages = jobsData?.pageInfo?.hasNextPage;
  const totalCount = jobsData?.count;

  if (hasMorePages) {
    const showing = jobs.length;
    const total = totalCount || `${showing}+`;
    lines.push(`${icon} Showing ${SEMANTIC_COLORS.count(String(showing))} of ${SEMANTIC_COLORS.count(String(total))} steps: ${countParts.join(', ')}`);
    lines.push(SEMANTIC_COLORS.warning('⚠️  Showing first 100 steps only (more available)'));
    lines.push(SEMANTIC_COLORS.dim('  → Use --jobs to fetch all step data and see accurate statistics'));
  } else {
    lines.push(`${icon} ${SEMANTIC_COLORS.count(String(jobStats.total))} step${jobStats.total > 1 ? 's' : ''}: ${countParts.join(', ')}`);
  }

  // Show failed jobs for FAILED builds
  if (buildState === 'FAILED' && jobStats.failed > 0) {
    const failedJobs = this.getFailedJobs(jobs);
    const jobGroups = this.groupJobsByLabel(failedJobs);

    const displayGroups = jobGroups.slice(0, 3);
    for (const group of displayGroups) {
      const label = this.parseEmoji(group.label);
      const icon = getStateIcon('FAILED');

      const duration = group.count === 1 && group.jobs[0]?.node
        ? ` ${SEMANTIC_COLORS.dim(`- ran ${this.formatJobDuration(group.jobs[0].node)}`)}`
        : '';

      if (group.parallelTotal > 0) {
        lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0}/${group.parallelTotal} failed)`)}`);
      } else if (group.count > 1) {
        lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0} failed)`)}`);
      } else {
        lines.push(`   ${icon} ${label}${duration}`);
      }
    }

    if (jobGroups.length > 3) {
      lines.push(`   ${SEMANTIC_COLORS.muted(`...and ${jobGroups.length - 3} more`)}`);
    }
  }

  // Show soft failed jobs for PASSED builds OR when there are soft failures
  if (jobStats.softFailed > 0) {
    const softFailedJobs = this.getSoftFailedJobs(jobs);
    const jobGroups = this.groupJobsByLabel(softFailedJobs);

    lines.push('');
    const displayGroups = jobGroups.slice(0, 5);
    for (const group of displayGroups) {
      const label = this.parseEmoji(group.label);
      const icon = getStateIcon('SOFT_FAILED');

      const duration = group.count === 1 && group.jobs[0]?.node
        ? ` - ran ${this.formatJobDuration(group.jobs[0].node)}`
        : '';

      if (group.parallelTotal > 0) {
        lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0}/${group.parallelTotal} soft failed)`)}`);
      } else if (group.count > 1) {
        lines.push(`   ${icon} ${label} ${SEMANTIC_COLORS.dim(`(${group.stateCounts.failed || 0} soft failed)`)}`);
      } else {
        lines.push(`   ${icon} ${label}${duration}`);
      }
    }

    if (jobGroups.length > 5) {
      lines.push(`   ${SEMANTIC_COLORS.muted(`...and ${jobGroups.length - 5} more`)}`);
    }
  }

  return lines.join('\n');
}
```

**Step 2: Add getSoftFailedJobs helper method**

Add new method after `getFailedJobs`:

```typescript
private getSoftFailedJobs(jobs: any[]): any[] {
  if (!jobs) return [];

  return jobs.filter(job => {
    const state = job.node.state?.toUpperCase();

    // BROKEN jobs are skipped/not run, not failed
    if (state === 'BROKEN' || state === 'SKIPPED') {
      return false;
    }

    // If we have an exit status, use that as the source of truth
    if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
      const exitCode = parseInt(job.node.exitStatus, 10);
      return exitCode !== 0 && job.node.softFailed === true;
    }

    // For FINISHED jobs, check the passed field and softFailed
    if (state === 'FINISHED') {
      return job.node.passed === false && job.node.softFailed === true;
    }

    return false;
  });
}
```

**Step 3: Update getFailedJobs to exclude soft failures**

Modify the existing `getFailedJobs` method to exclude soft failures:

```typescript
private getFailedJobs(jobs: any[]): any[] {
  if (!jobs) return [];

  return jobs.filter(job => {
    const state = job.node.state?.toUpperCase();

    // BROKEN jobs are skipped/not run, not failed
    if (state === 'BROKEN' || state === 'SKIPPED') {
      return false;
    }

    // If we have an exit status, use that as the source of truth
    if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
      const exitCode = parseInt(job.node.exitStatus, 10);
      // Only return hard failures (not soft failures)
      return exitCode !== 0 && job.node.softFailed !== true;
    }

    // For FINISHED jobs, check the passed field
    if (state === 'FINISHED') {
      return job.node.passed === false && job.node.softFailed !== true;
    }

    // Otherwise check if explicitly failed (and not soft)
    return state === 'FAILED' && job.node.softFailed !== true;
  });
}
```

**Step 4: Commit summary display changes**

```bash
git add src/formatters/build-detail/PlainTextFormatter.ts
git commit -m "feat: display soft failures in job summary"
```

---

## Task 5: Update Detailed Job View

**Files:**
- Modify: `src/formatters/build-detail/PlainTextFormatter.ts:694-802`
- Modify: `src/formatters/build-detail/PlainTextFormatter.ts:1077-1122`

**Step 1: Update groupJobsByState to include Soft Failed group**

Modify the `groupJobsByState` method:

```typescript
private groupJobsByState(jobs: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {
    'Failed': [],
    'Soft Failed': [],
    'Passed': [],
    'Running': [],
    'Blocked': []
  };

  if (!jobs) return grouped;

  for (const job of jobs) {
    const state = job.node.state?.toUpperCase() || '';

    // If we have an exit status, use that as the source of truth
    if (job.node.exitStatus !== null && job.node.exitStatus !== undefined) {
      const exitCode = parseInt(job.node.exitStatus, 10);
      if (exitCode === 0) {
        grouped['Passed'].push(job);
      } else {
        // Non-zero exit: check if soft failure
        if (job.node.softFailed === true) {
          grouped['Soft Failed'].push(job);
        } else {
          grouped['Failed'].push(job);
        }
      }
    } else if (state === 'RUNNING') {
      grouped['Running'].push(job);
    } else if (state === 'BLOCKED') {
      grouped['Blocked'].push(job);
    } else if (state === 'SKIPPED' || state === 'CANCELED' || state === 'BROKEN') {
      // Don't display skipped/broken/canceled jobs
    } else if (state === 'FINISHED' || state === 'COMPLETED') {
      // For finished jobs without exit status, check passed field
      if (job.node.passed === true) {
        grouped['Passed'].push(job);
      } else if (job.node.passed === false) {
        // Check softFailed
        if (job.node.softFailed === true) {
          grouped['Soft Failed'].push(job);
        } else {
          grouped['Failed'].push(job);
        }
      }
    } else if (state === 'PASSED' || job.node.passed === true) {
      grouped['Passed'].push(job);
    } else if (state === 'FAILED') {
      // Check softFailed for explicitly failed jobs
      if (job.node.softFailed === true) {
        grouped['Soft Failed'].push(job);
      } else {
        grouped['Failed'].push(job);
      }
    }
  }

  return grouped;
}
```

**Step 2: Update formatJobDetails to show soft failures with correct styling**

Modify the section loop in `formatJobDetails` to handle 'Soft Failed' state:

```typescript
private formatJobDetails(jobs: any[], options?: BuildDetailFormatterOptions): string {
  if (!jobs || jobs.length === 0) {
    return 'No steps found';
  }

  const lines: string[] = [];
  const jobStats = this.getJobStats(jobs);

  // Summary line
  const parts = [];
  if (jobStats.passed > 0) parts.push(`${getStateIcon('PASSED')} ${jobStats.passed} passed`);
  if (jobStats.failed > 0) parts.push(`${getStateIcon('FAILED')} ${jobStats.failed} failed`);
  if (jobStats.softFailed > 0) parts.push(`${getStateIcon('SOFT_FAILED')} ${jobStats.softFailed} soft failed`);
  if (jobStats.running > 0) parts.push(`${getStateIcon('RUNNING')} ${jobStats.running} running`);
  if (jobStats.blocked > 0) parts.push(`${getStateIcon('BLOCKED')} ${jobStats.blocked} blocked`);

  lines.push(`Steps: ${parts.join('  ')}`);
  lines.push('');

  // Filter jobs based on options
  let filteredJobs = jobs;
  if (options?.failed) {
    // Include both hard and soft failures
    filteredJobs = [...this.getFailedJobs(jobs), ...this.getSoftFailedJobs(jobs)];
  }

  // Group jobs by state first
  const grouped = this.groupJobsByState(filteredJobs);

  // Display order: Failed, Soft Failed, Passed, Running, Blocked
  const stateOrder = ['Failed', 'Soft Failed', 'Passed', 'Running', 'Blocked'];

  for (const state of stateOrder) {
    const stateJobs = grouped[state];
    if (!stateJobs || stateJobs.length === 0) continue;

    const icon = this.getJobStateIcon(state);
    const stateColored = this.colorizeJobState(state);

    // Collapse parallel jobs with same label
    const collapsedGroups = this.collapseParallelJobs(stateJobs);

    lines.push(`${icon} ${stateColored} (${SEMANTIC_COLORS.count(String(stateJobs.length))}):`);

    for (const group of collapsedGroups) {
      if (group.isParallelGroup && group.jobs.length > 1) {
        // Collapsed parallel group display
        const label = this.parseEmoji(group.label);
        const total = group.parallelTotal || group.jobs.length;
        const passedCount = group.jobs.filter(j => this.isJobPassed(j.node)).length;
        const failedCount = group.jobs.filter(j => this.isJobFailed(j.node) || this.isJobSoftFailed(j.node)).length;

        // Show summary line for parallel group
        if (failedCount > 0) {
          const coloredLabel = this.colorizeJobLabel(state, label);
          lines.push(`  ${coloredLabel} ${SEMANTIC_COLORS.dim(`(${passedCount}/${total} passed, ${failedCount} failed)`)}`);

          // Show failed steps individually
          const failedJobs = group.jobs.filter(j => this.isJobFailed(j.node) || this.isJobSoftFailed(j.node));
          for (const job of failedJobs) {
            const duration = this.formatJobDuration(job.node);
            const parallelInfo = job.node.parallelGroupIndex !== undefined
              ? ` ${SEMANTIC_COLORS.dim(`[Parallel: ${job.node.parallelGroupIndex + 1}/${job.node.parallelGroupTotal}]`)}`
              : '';
            const failType = this.isJobSoftFailed(job.node) ? 'Soft Failed' : 'Failed';
            const failColor = this.isJobSoftFailed(job.node) ? SEMANTIC_COLORS.warning : SEMANTIC_COLORS.error;
            lines.push(`    ${failColor('↳ ' + failType)}: ${SEMANTIC_COLORS.dim(duration)}${parallelInfo}`);
          }
        } else {
          // All passed/running/blocked - just show summary
          const avgDuration = this.calculateAverageDuration(group.jobs);
          const coloredLabel = this.colorizeJobLabel(state, label);
          lines.push(`  ${coloredLabel} ${SEMANTIC_COLORS.dim(`(${total} parallel steps, avg: ${avgDuration})`)}`);
        }
      } else {
        // Single job or non-parallel group
        const job = group.jobs[0];
        const label = this.parseEmoji(job.node.label);
        const duration = this.formatJobDuration(job.node);

        const coloredLabel = this.colorizeJobLabel(state, label);

        const parallelInfo = (job.node.parallelGroupIndex !== undefined && job.node.parallelGroupTotal)
          ? ` ${SEMANTIC_COLORS.dim(`[Parallel: ${job.node.parallelGroupIndex + 1}/${job.node.parallelGroupTotal}]`)}`
          : '';

        lines.push(`  ${coloredLabel} ${SEMANTIC_COLORS.dim(`(${duration})`)}${parallelInfo}`);

        // Show additional details if --jobs or --full and single step
        if ((options?.jobs || options?.full) && !group.isParallelGroup) {
          if (job.node.retried) {
            lines.push(`    ${SEMANTIC_COLORS.warning(`${getProgressIcon('RETRY')} Retried`)}`);
          }
        }
      }
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
```

**Step 3: Add helper methods for soft failure detection**

Add these helper methods:

```typescript
private isJobSoftFailed(job: any): boolean {
  const state = job.state?.toUpperCase();

  if (job.exitStatus !== null && job.exitStatus !== undefined) {
    return parseInt(job.exitStatus, 10) !== 0 && job.softFailed === true;
  }

  if (state === 'FINISHED' || state === 'COMPLETED') {
    return job.passed === false && job.softFailed === true;
  }

  return false;
}

private colorizeJobLabel(state: string, label: string): string {
  switch (state) {
    case 'Failed':
      return SEMANTIC_COLORS.error(label);
    case 'Soft Failed':
      return SEMANTIC_COLORS.warning(label);
    case 'Passed':
      return SEMANTIC_COLORS.success(label);
    case 'Running':
      return SEMANTIC_COLORS.info(label);
    case 'Blocked':
      return SEMANTIC_COLORS.warning(label);
    default:
      return label;
  }
}
```

**Step 4: Update colorizeJobState to handle Soft Failed**

Modify the `colorizeJobState` method:

```typescript
private colorizeJobState(state: string): string {
  switch (state.toLowerCase()) {
    case 'failed':
      return SEMANTIC_COLORS.error(state);
    case 'soft failed':
      return SEMANTIC_COLORS.warning(state);
    case 'passed':
      return SEMANTIC_COLORS.success(state);
    case 'running':
      return SEMANTIC_COLORS.info(state);
    case 'blocked':
      return SEMANTIC_COLORS.warning(state);
    case 'skipped':
    case 'canceled':
      return SEMANTIC_COLORS.muted(state);
    default:
      return state;
  }
}
```

**Step 5: Update getJobStateIcon to handle Soft Failed**

Modify the `getJobStateIcon` method:

```typescript
private getJobStateIcon(state: string): string {
  if (state === 'Soft Failed') {
    return getStateIcon('SOFT_FAILED');
  }
  return getStateIcon(state);
}
```

**Step 6: Commit detailed view changes**

```bash
git add src/formatters/build-detail/PlainTextFormatter.ts
git commit -m "feat: add soft failures to detailed job view"
```

---

## Task 6: Update JSON Formatter

**Files:**
- Modify: `src/formatters/build-detail/JsonFormatter.ts`

**Step 1: Add softFailed to job output**

Modify the `formatBuildDetail` method to include softFailed in job objects:

```typescript
formatBuildDetail(buildData: BuildDetail | null, options?: BuildDetailFormatterOptions): string {
  if (options?.hasError || !buildData) {
    return JSON.stringify({
      error: options?.errorMessage || 'Unknown error',
      errorType: options?.errorType || 'unknown'
    }, null, 2);
  }

  const build = buildData.build;

  // Format jobs
  const jobs = build.jobs?.edges?.map((edge: any) => ({
    id: edge.node.id,
    uuid: edge.node.uuid,
    label: edge.node.label,
    state: edge.node.state,
    exit_status: edge.node.exitStatus,
    passed: edge.node.passed,
    soft_failed: edge.node.softFailed,
    started_at: edge.node.startedAt,
    finished_at: edge.node.finishedAt,
    parallel_group_index: edge.node.parallelGroupIndex,
    parallel_group_total: edge.node.parallelGroupTotal
  })) || [];

  // Calculate statistics
  const jobStats = this.calculateJobStats(jobs);

  const result = {
    build: {
      id: build.id,
      number: build.number,
      state: build.state,
      url: build.url,
      branch: build.branch,
      commit: build.commit,
      message: build.message,
      created_at: build.createdAt,
      started_at: build.startedAt,
      finished_at: build.finishedAt,
      created_by: build.createdBy,
      organization: {
        id: build.organization?.id,
        name: build.organization?.name,
        slug: build.organization?.slug
      },
      pipeline: {
        id: build.pipeline?.id,
        name: build.pipeline?.name,
        slug: build.pipeline?.slug
      },
      jobs,
      job_stats: jobStats,
      annotations: build.annotations?.edges?.map((edge: any) => ({
        id: edge.node.id,
        style: edge.node.style,
        context: edge.node.context,
        body: edge.node.body?.html
      })) || []
    }
  };

  return JSON.stringify(result, null, 2);
}
```

**Step 2: Update calculateJobStats helper**

Add or modify the `calculateJobStats` helper method:

```typescript
private calculateJobStats(jobs: any[]): any {
  const stats = {
    total: jobs.length,
    passed: 0,
    failed: 0,
    soft_failed: 0,
    running: 0,
    blocked: 0,
    skipped: 0
  };

  for (const job of jobs) {
    const state = job.state?.toUpperCase();

    if (job.exit_status !== null && job.exit_status !== undefined) {
      const exitCode = parseInt(job.exit_status, 10);
      if (exitCode === 0) {
        stats.passed++;
      } else {
        if (job.soft_failed === true) {
          stats.soft_failed++;
        } else {
          stats.failed++;
        }
      }
    } else if (state === 'RUNNING') {
      stats.running++;
    } else if (state === 'BLOCKED') {
      stats.blocked++;
    } else if (state === 'SKIPPED' || state === 'BROKEN' || state === 'CANCELED') {
      stats.skipped++;
    } else if (state === 'PASSED' || job.passed === true) {
      stats.passed++;
    } else if (state === 'FAILED' || job.passed === false) {
      if (job.soft_failed === true) {
        stats.soft_failed++;
      } else {
        stats.failed++;
      }
    }
  }

  return stats;
}
```

**Step 3: Commit JSON formatter changes**

```bash
git add src/formatters/build-detail/JsonFormatter.ts
git commit -m "feat: add softFailed to JSON formatter output"
```

---

## Task 7: Update Snapshot Command to Use GraphQL

**Files:**
- Modify: `src/commands/Snapshot.ts`

**Step 1: Import GraphQL client**

Add GraphQL client import at the top of Snapshot.ts:

```typescript
import { BuildkiteGraphQLClient } from '../services/BuildkiteGraphQLClient.js';
```

**Step 2: Update class to use both clients**

Modify the Snapshot class to use GraphQL for build metadata:

```typescript
export class Snapshot extends BaseCommand {
  static requiresToken = true;
  private restClient!: BuildkiteRestClient;
  private graphqlClient!: BuildkiteGraphQLClient;

  async ensureInitialized(): Promise<void> {
    if (!this.client) {
      if (!this.token) {
        throw new Error('Token is required for Snapshot command');
      }

      // Initialize GraphQL client for build metadata
      this.client = new BuildkiteGraphQLClient(this.token, {
        caching: this.cacheOptions.enabled,
        cacheTTLs: this.cacheOptions.ttl ? { default: this.cacheOptions.ttl } : undefined,
        debug: this.debug
      });
      this.graphqlClient = this.client;

      // Initialize REST client for logs
      this.restClient = new BuildkiteRestClient(this.token, {
        caching: this.cacheOptions.enabled,
        cacheTTLs: this.cacheOptions.ttl ? { default: this.cacheOptions.ttl } : undefined,
        debug: this.debug
      });

      if (this.cacheOptions.clear) {
        await this.client.clearCache();
        await this.restClient.clearCache();
      }
    }
  }
}
```

**Step 3: Update execute method to use GraphQL for build data**

Modify the execute method to fetch build via GraphQL:

```typescript
async execute(options: SnapshotOptions): Promise<number> {
  if (options.debug) {
    logger.debug('Starting Snapshot command execution', options);
  }

  if (!options.buildRef) {
    logger.error('Build reference is required');
    return 1;
  }

  const spinner = Progress.spinner('Preparing snapshot…', { format: options.format || 'plain' });

  try {
    await this.ensureInitialized();

    // Parse build reference
    const buildRef = parseBuildRef(options.buildRef);
    if (options.debug) {
      logger.debug('Parsed build reference:', buildRef);
    }

    // Construct build slug for GraphQL
    const buildSlug = `${buildRef.org}/${buildRef.pipeline}/${buildRef.number}`;

    spinner.update('Fetching build data…');

    // Fetch build metadata via GraphQL (includes softFailed)
    const buildData = await this.graphqlClient.getBuildSummaryWithAllJobs(buildSlug, {
      fetchAllJobs: true,
      onProgress: (fetched: number, total?: number) => {
        const totalStr = total ? `/${total}` : '';
        spinner.update(`Fetching jobs: ${fetched}${totalStr}…`);
      }
    });

    const build = buildData.build;
    const jobs = build.jobs?.edges || [];

    spinner.stop();

    // Display build summary
    this.displayBuildSummary(build, jobs);

    // Determine output directory
    const outputDir = options.outputDir || path.join(os.tmpdir(), 'buildkite-snapshots', `${buildRef.org}-${buildRef.pipeline}-${buildRef.number}`);

    // Create output directory
    await fs.mkdir(outputDir, { recursive: true });

    // Filter jobs based on options
    const scriptJobs = jobs
      .map((edge: any) => edge.node)
      .filter((job: any) => job.__typename === 'JobTypeCommand' || !job.__typename);

    const jobsToFetch = options.all
      ? scriptJobs
      : scriptJobs.filter((job: any) => this.isFailedJob(job));

    if (jobsToFetch.length === 0) {
      logger.console('\nNo jobs to fetch logs for.');
      return 0;
    }

    logger.console(`\nFetching logs for ${jobsToFetch.length} job${jobsToFetch.length > 1 ? 's' : ''}…`);

    // Progress tracking
    let completed = 0;
    const total = jobsToFetch.length;

    const progressSpinner = Progress.spinner(`Fetching logs: 0/${total}`, { format: options.format || 'plain' });

    // Fetch logs for each job using REST API
    const stepResults: StepResult[] = [];

    for (let i = 0; i < jobsToFetch.length; i++) {
      const job = jobsToFetch[i];
      const stepDirName = getStepDirName(i, job.label || 'unnamed');
      const stepDir = path.join(outputDir, stepDirName);

      try {
        // Create step directory
        await fs.mkdir(stepDir, { recursive: true });

        // Fetch log via REST API
        const log = await this.restClient.getJobLog(
          buildRef.org,
          buildRef.pipeline,
          buildRef.number,
          job.uuid
        );

        // Save log content
        await fs.writeFile(path.join(stepDir, 'log.txt'), log.content, 'utf-8');

        // Save job metadata
        const metadata = {
          id: job.id,
          uuid: job.uuid,
          label: job.label,
          state: job.state,
          exit_status: job.exitStatus,
          passed: job.passed,
          soft_failed: job.softFailed,
          started_at: job.startedAt,
          finished_at: job.finishedAt
        };
        await fs.writeFile(path.join(stepDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

        stepResults.push({
          id: job.id,
          jobId: job.uuid,
          status: 'success'
        });

        completed++;
        progressSpinner.update(`Fetching logs: ${completed}/${total}`);
      } catch (error) {
        const categorized = categorizeError(error as Error);
        stepResults.push({
          id: job.id,
          jobId: job.uuid,
          status: 'failed',
          error: categorized.error,
          message: categorized.message,
          retryable: categorized.retryable
        });

        completed++;
        progressSpinner.update(`Fetching logs: ${completed}/${total}`);
      }
    }

    progressSpinner.stop();

    // Create manifest
    const allSuccess = stepResults.every(r => r.status === 'success');
    const manifest: Manifest = {
      version: 1,
      buildRef: options.buildRef,
      url: build.url,
      fetchedAt: new Date().toISOString(),
      complete: allSuccess,
      build: {
        status: build.state || 'unknown',
      },
      steps: stepResults,
    };

    await this.saveManifest(outputDir, manifest);

    // Summary
    const successCount = stepResults.filter(r => r.status === 'success').length;
    const failCount = stepResults.filter(r => r.status === 'failed').length;

    logger.console('');
    logger.console(`✓ Snapshot saved to: ${outputDir}`);
    logger.console(`  ${successCount} logs fetched successfully`);
    if (failCount > 0) {
      logger.console(`  ${failCount} logs failed to fetch`);
    }

    return 0;
  } catch (error) {
    spinner.stop();
    logger.error('Failed to create snapshot:', error);
    return 1;
  }
}
```

**Step 4: Update isFailedJob to handle soft failures**

Modify the `isFailedJob` method:

```typescript
private isFailedJob(job: any): boolean {
  const state = job.state?.toUpperCase();

  // Check state-based failure
  if (state === 'FAILED' || state === 'TIMED_OUT') {
    return true;
  }

  // Check exit status (non-zero means failure, including soft failures)
  if (job.exitStatus !== null && job.exitStatus !== undefined) {
    const exitCode = parseInt(job.exitStatus, 10);
    return exitCode !== 0;
  }

  // Check passed field
  if (job.passed === false) {
    return true;
  }

  return false;
}
```

**Step 5: Update displayBuildSummary to show soft failures**

Modify the `displayBuildSummary` method:

```typescript
private displayBuildSummary(build: any, jobs: any[]): void {
  const state = build.state || 'unknown';
  const icon = getStateIcon(state);
  const theme = BUILD_STATUS_THEME[state.toUpperCase() as keyof typeof BUILD_STATUS_THEME];
  const coloredIcon = theme ? theme.color(icon) : icon;
  const message = build.message?.split('\n')[0] || 'No message';
  const duration = formatDuration(build.startedAt, build.finishedAt);
  const durationStr = duration ? ` ${SEMANTIC_COLORS.dim(duration)}` : '';

  // First line: status + message + build number + duration
  const coloredState = theme ? theme.color(state.toUpperCase()) : state.toUpperCase();
  logger.console(`${coloredIcon} ${coloredState} ${message} ${SEMANTIC_COLORS.dim(`#${build.number}`)}${durationStr}`);

  // Second line: author + branch + commit + time
  const author = build.createdBy?.name || build.createdBy?.email || 'Unknown';
  const branch = build.branch || 'unknown';
  const commit = build.commit?.substring(0, 7) || 'unknown';
  const created = build.createdAt ? formatDistanceToNow(new Date(build.createdAt), { addSuffix: true }) : '';
  logger.console(`         ${author} • ${SEMANTIC_COLORS.identifier(branch)} • ${commit} • ${SEMANTIC_COLORS.dim(created)}`);

  // Job statistics
  const scriptJobs = jobs
    .map((edge: any) => edge.node)
    .filter((job: any) => job.__typename === 'JobTypeCommand' || !job.__typename);

  const passed = scriptJobs.filter(j => {
    if (j.exitStatus !== null && j.exitStatus !== undefined) {
      return parseInt(j.exitStatus, 10) === 0;
    }
    return j.state === 'PASSED' || j.passed === true;
  }).length;

  const hardFailed = scriptJobs.filter(j => {
    if (j.exitStatus !== null && j.exitStatus !== undefined) {
      const exitCode = parseInt(j.exitStatus, 10);
      return exitCode !== 0 && j.softFailed !== true;
    }
    return (j.state === 'FAILED' || j.passed === false) && j.softFailed !== true;
  }).length;

  const softFailed = scriptJobs.filter(j => {
    if (j.exitStatus !== null && j.exitStatus !== undefined) {
      const exitCode = parseInt(j.exitStatus, 10);
      return exitCode !== 0 && j.softFailed === true;
    }
    return (j.state === 'FAILED' || j.passed === false) && j.softFailed === true;
  }).length;

  const running = scriptJobs.filter(j => j.state === 'RUNNING').length;
  const other = scriptJobs.length - passed - hardFailed - softFailed - running;

  let statsStr = `${scriptJobs.length} steps:`;
  const parts: string[] = [];
  if (passed > 0) parts.push(SEMANTIC_COLORS.success(`${passed} passed`));
  if (hardFailed > 0) parts.push(SEMANTIC_COLORS.error(`${hardFailed} failed`));
  if (softFailed > 0) parts.push(SEMANTIC_COLORS.warning(`▲ ${softFailed} soft failure${softFailed > 1 ? 's' : ''}`));
  if (running > 0) parts.push(SEMANTIC_COLORS.info(`${running} running`));
  if (other > 0) parts.push(SEMANTIC_COLORS.muted(`${other} other`));
  statsStr += ' ' + parts.join(', ');

  logger.console('');
  logger.console(statsStr);
}
```

**Step 6: Commit snapshot command changes**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: migrate snapshot command to use GraphQL for build metadata"
```

---

## Task 8: Manual Testing and Validation

**Files:**
- None (manual testing)

**Step 1: Test with real build that has soft failures**

Run: `bin/bktide build acme/webapp/1404486`
Expected output:
```
✓ PASSED Merge branch 'main' into AH-GPG-76-add-support-for-tiered-contracts #1404486 31m 26s
         AldoHdz • AH-GPG-76-add-support-for-tiered-contracts • 510cf62 • Created 2 days ago

✓ 467 steps: 401 passed, ▲ 3 soft failures

   ▲ bin/pact-can-i-merge - ran 30s
```

**Step 2: Test JSON output**

Run: `bin/bktide build acme/webapp/1404486 --format json | jq '.build.job_stats'`
Expected output includes:
```json
{
  "total": 467,
  "passed": 401,
  "failed": 0,
  "softFailed": 3,
  ...
}
```

**Step 3: Test --jobs flag**

Run: `bin/bktide build acme/webapp/1404486 --jobs`
Expected: Detailed view with "Soft Failed" section showing soft failure jobs

**Step 4: Test --failed flag**

Run: `bin/bktide build acme/webapp/1404486 --failed`
Expected: Shows soft failed jobs (all non-passing jobs)

**Step 5: Test snapshot command**

Run: `bin/bktide snapshot acme/webapp/1404486 --failed`
Expected:
- Shows soft failures in summary
- Fetches logs for soft failed jobs
- Metadata includes softFailed field

**Step 6: Test with ASCII mode**

Run: `bin/bktide build acme/webapp/1404486 --ascii`
Expected: Uses `^` instead of `▲` for soft failures

**Step 7: Document validation results**

Create a validation summary documenting:
- Which builds were tested
- What output was verified
- Any issues found

**Step 8: Commit any fixes from validation**

If issues found during testing, fix and commit:
```bash
git add <files>
git commit -m "fix: <description of fix>"
```

---

## Task 9: Update Tests for Edge Cases

**Files:**
- Test: `test/formatters/build-detail-display.test.ts`

**Step 1: Write test for null softFailed handling**

Add test to verify backwards compatibility:

```typescript
it('should treat null softFailed as hard failure for backwards compatibility', () => {
  const jobs = [
    { node: { exitStatus: '1', passed: false, softFailed: null } },
    { node: { exitStatus: '1', passed: false, softFailed: undefined } }
  ];

  const formatter = new PlainTextFormatter();
  const stats = (formatter as any).getJobStats(jobs);

  expect(stats.failed).toBe(2);
  expect(stats.softFailed).toBe(0);
});
```

**Step 2: Write test for mixed failure states**

```typescript
it('should handle builds with both hard and soft failures', () => {
  const jobs = [
    { node: { exitStatus: '0', passed: true, softFailed: false } },
    { node: { exitStatus: '1', passed: false, softFailed: false } },
    { node: { exitStatus: '1', passed: false, softFailed: true } }
  ];

  const formatter = new PlainTextFormatter();
  const stats = (formatter as any).getJobStats(jobs);

  expect(stats.passed).toBe(1);
  expect(stats.failed).toBe(1);
  expect(stats.softFailed).toBe(1);
});
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- test/formatters/build-detail-display.test.ts`
Expected: All tests pass

**Step 4: Commit edge case tests**

```bash
git add test/formatters/build-detail-display.test.ts
git commit -m "test: add edge case tests for soft failure handling"
```

---

## Task 10: Update Documentation

**Files:**
- Create: `docs/features/soft-failures.md`

**Step 1: Create feature documentation**

```markdown
# Soft Failures

Soft failures are jobs that fail (exit with non-zero status) but are configured to not fail the overall build.

## Detection

Soft failures are detected using the `softFailed` field from Buildkite's GraphQL API. Jobs with:
- `exitStatus != 0`
- `softFailed = true`

Are classified as soft failures.

## Display

### Plain Text Output

Soft failures are displayed with:
- Yellow color (warning semantic)
- Triangle symbol: `▲` (or `^` in ASCII mode)
- "soft failure" / "soft failures" terminology

Example:
```
✓ PASSED Build #1234 30m 26s

✓ 467 steps: 401 passed, ▲ 3 soft failures

   ▲ bin/pact-can-i-merge - ran 30s
   ▲ bin/experimental-check - ran 1m 15s
```

### Detailed View (--jobs)

Soft failures appear in a separate section:

```
Steps: ✗ 2 failed  ▲ 3 soft failed  ✓ 401 passed

✗ Failed (2):
  ...

▲ Soft Failed (3):
  bin/pact-can-i-merge (30s)
  bin/experimental-check (1m 15s)
  ...
```

### JSON Output

Soft failures are included in JSON output:

```json
{
  "build": {
    "jobs": [
      {
        "label": "bin/pact-can-i-merge",
        "exit_status": "1",
        "passed": false,
        "soft_failed": true
      }
    ],
    "job_stats": {
      "passed": 401,
      "failed": 0,
      "soft_failed": 3
    }
  }
}
```

## Commands

### build

Shows soft failures in summary and auto-displays soft failed jobs.

Options:
- `--jobs`: Shows detailed soft failure section
- `--failed`: Includes both hard and soft failures
- `--format json`: Includes `soft_failed` field in output

### snapshot

Shows soft failures in summary. When using `--failed`, fetches logs for both hard and soft failures.

## Backwards Compatibility

Jobs without a `softFailed` field (or with `null`/`undefined` value) are treated as hard failures for backwards compatibility.
```

**Step 2: Commit documentation**

```bash
git add docs/features/soft-failures.md
git commit -m "docs: add soft failures feature documentation"
```

---

## Completion

After all tasks are complete:

1. Run full test suite: `npm test`
2. Build the project: `npm run build`
3. Test with real builds to verify end-to-end functionality
4. Create a summary commit if needed
5. Consider using @superpowers:finishing-a-development-branch for next steps
