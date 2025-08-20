# Build Command Improvements - Implementation Guide

## Priority 1: Visual & Formatting Fixes

### 1. Semantic Colors
**Files to modify**: `src/formatters/build-detail/PlainTextFormatter.ts`

```typescript
// Import chalk for colors
import chalk from 'chalk';

// Add color helpers
private colorizeState(state: string): string {
  switch (state.toUpperCase()) {
    case 'PASSED': return chalk.green(state.toLowerCase());
    case 'FAILED': 
    case 'BROKEN': return chalk.red(state.toLowerCase());
    case 'RUNNING': return chalk.yellow(state.toLowerCase());
    case 'BLOCKED': return chalk.blue(state.toLowerCase());
    case 'CANCELED': return chalk.gray(state.toLowerCase());
    default: return state.toLowerCase();
  }
}
```

### 2. Replace UTF-8 Icons with Emoji
**Current → Target mappings**:
- ✅ → ✅ (keep, it's already emoji)
- ❌ → ❌ (keep, it's already emoji)
- 🔄 → 🏃 or ⚡ (for running)
- ⏸️ → 🚫 (for blocked)
- 📝 → 📝 (keep for annotations)
- ℹ️ → ℹ️ (keep for info)
- ⚠️ → ⚠️ (keep for warning)

### 3. Parse Buildkite Emoji in Labels
**Implementation approach**:
```typescript
// Map of Buildkite emoji codes to Unicode/display
const BUILDKITE_EMOJI: Record<string, string> = {
  ':rspec:': '🧪',
  ':jest:': '🃏',
  ':eslint:': '📝',
  ':rubocop:': '👮',
  ':docker:': '🐳',
  ':kubernetes:': '☸️',
  // Standard emoji pass-through
  ':smile:': '😊',
  ':rocket:': '🚀',
  // ... more mappings
};

function parseEmoji(label: string): string {
  return label.replace(/:(\w+):/g, (match, code) => {
    return BUILDKITE_EMOJI[match] || match;
  });
}
```

### 4. Fix Tips Formatting
**Current issues**:
- Inconsistent format
- "Tips:" label with special color
- Mixed command/description order

**Solution**:
```typescript
// In formatFailedBuild and similar methods
// Instead of:
lines.push('💡 Tips:');
lines.push('  • Use --debug flag for more details');

// Use:
lines.push('');
lines.push('→ bin/bktide build 1234 --failed  # show failure details');
lines.push('→ bin/bktide build 1234 --annotations  # view annotations');
```

## Priority 2: Job Display Optimization

### 1. Group Identical Jobs
**Algorithm**:
```typescript
interface JobGroup {
  label: string;
  state: string;
  count: number;
  exitStatuses: Set<number>;
  durations: number[];
  firstJob: any;
}

private groupIdenticalJobs(jobs: any[]): JobGroup[] {
  const groups = new Map<string, JobGroup>();
  
  for (const job of jobs) {
    const key = `${job.node.label}:${job.node.state}`;
    if (!groups.has(key)) {
      groups.set(key, {
        label: job.node.label,
        state: job.node.state,
        count: 0,
        exitStatuses: new Set(),
        durations: [],
        firstJob: job
      });
    }
    
    const group = groups.get(key)!;
    group.count++;
    if (job.node.exitStatus) {
      group.exitStatuses.add(job.node.exitStatus);
    }
    if (job.node.startedAt && job.node.finishedAt) {
      group.durations.push(/* calculate duration */);
    }
  }
  
  return Array.from(groups.values());
}

// Display format:
private formatJobGroup(group: JobGroup): string {
  if (group.count === 1) {
    return `${group.label} - ${formatDuration(group.firstJob)}`;
  }
  
  const statusInfo = group.exitStatuses.size > 0 
    ? `, exit codes: ${Array.from(group.exitStatuses).join(',')}`
    : ', not started';
    
  return `${group.label} (${group.count} jobs${statusInfo})`;
}
```

### 2. Default Limiting with Summary
```typescript
private formatFailedJobsSummary(failedJobs: any[]): string {
  const groups = this.groupIdenticalJobs(failedJobs);
  const displayGroups = groups.slice(0, 10);
  const remaining = groups.length - 10;
  
  const lines = displayGroups.map(group => 
    `   Failed: ${this.formatJobGroup(group)}`
  );
  
  if (remaining > 0) {
    lines.push(`   ...and ${remaining} more job types`);
    lines.push(`   → bin/bktide build ${build.number} --all-jobs  # show all`);
  }
  
  return lines.join('\n');
}
```

## Priority 3: Performance & Data

### 1. Smart Defaults
- Limit job fetching in GraphQL query to 100 by default
- Only fetch all jobs with `--all-jobs` flag
- Cache job groupings for repeated views

### 2. PR URL Construction
```typescript
// If we have PR ID but not full details
if (build.pullRequest?.id) {
  // Extract PR number from GraphQL ID if possible
  // Or construct GitHub URL based on repo URL
  const repoUrl = build.pipeline?.repository?.url;
  if (repoUrl && repoUrl.includes('github.com')) {
    const prUrl = `${repoUrl}/pull/${prNumber}`;
    lines.push(`  Pull Request: ${prUrl}`);
  }
}
```

## Testing Plan

1. **Color Testing**:
   - Test with `--no-color` flag
   - Test in different terminal emulators
   - Verify readability in light/dark themes

2. **Emoji Testing**:
   - Test common Buildkite emoji codes
   - Test fallback for unknown codes
   - Verify display in different terminals

3. **Performance Testing**:
   - Test with builds having 500+ jobs
   - Measure response time improvements
   - Verify grouping accuracy

4. **Edge Cases**:
   - Builds with no jobs
   - Jobs with no labels
   - Mixed job states in same label group
