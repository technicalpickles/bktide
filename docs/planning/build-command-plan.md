# Build Command Implementation Plan

## Overview

Add a `bktide build <build-ref>` command that provides a concise, contextual view of individual builds with progressive disclosure for detailed information.

## Goals

1. **Quick triage** - Show most relevant information based on build state
2. **Progressive disclosure** - Start minimal, allow drilling down
3. **Contextual display** - Adapt output to what matters for the current state
4. **Rich annotations** - Surface annotation context and style meaningfully

## Command Structure

```bash
bktide build <build-ref> [options]
```

### Build Reference Formats

The command accepts multiple input formats (leveraging existing `parseBuildRef` utility):

#### Slug Format
```bash
bktide build gusto/zenpayroll/1290734
bktide build my-org/my-pipeline/456
bktide build org-with-dashes/pipeline_with_underscores/789
```

#### URL Format (copy from browser)
```bash
bktide build https://buildkite.com/gusto/zenpayroll/builds/1290734
bktide build "https://buildkite.com/my-org/my-pipeline/builds/456"
```

#### Alfred Workflow Format
```bash
bktide build @https://buildkite.com/gusto/zenpayroll/builds/1290734
```

All formats parse to the same structure: `{ org, pipeline, number }`

### Command Options

```
--jobs              Show job summary and details
--failed            Show only failed job details (implies --jobs)
--annotations       Show annotation details with context
--annotations-full  Show complete annotation content
--full              Show all available information
--summary           Single-line summary only (for scripts)
--format            Output format (plain, json, alfred)
--debug             Debug output
```

## Display Modes by Build State

### Core Display Principles

1. **Always show** (1-2 lines):
   - Status icon + build number
   - State + duration/elapsed time
   - Branch name
   - Age (relative time)
   - Commit message (truncated) + short SHA

2. **Conditionally show** based on state:
   - Failed jobs (for failed builds)
   - Running progress (for running builds)
   - Annotation summary (when present)
   - Block reason (for blocked builds)

### State-Specific Displays

#### PASSED Build
```
✅ #1290734 passed • 10m 30s • main • 2 hours ago
   "Fix payment processing bug" (abc1234)
```

#### FAILED Build
```
❌ #1290734 failed after 28m 44s • main • 2h ago
   "update tapioca dsl" (4551cd7)
   
   Failed: RSpec (361/361) - ran 24m 32s
   📝 4 annotations: 2 errors, 1 warning, 1 info
   
   → bktide build 1290734 --failed    # failure details
   → bktide build 1290734 --annotations  # view annotations
```

#### RUNNING Build
```
🔄 #1290734 running • 5m 23s elapsed • main
   "Deploy hotfix" (def4567)
   
   Progress: 12/20 complete, 3 running, 5 queued
   Running: database-migrations, rspec-models, eslint
```

#### BLOCKED Build
```
⏸️ #1290734 blocked • main • 45 min ago
   "Release v2.3.0" (ghi7890)
   
   🚫 Blocked: "Deploy to Production" (manual unblock required)
   ✅ 15 jobs passed before block
```

#### CANCELED Build
```
🚫 #1290734 canceled • 3m 12s • feature-branch • 1 hour ago
   "WIP: New feature" (jkl0123)
   
   Canceled by: Jane Smith
   Completed: 5/12 jobs before cancellation
```

## Annotation Handling

### Annotation Summary Display

Count annotations by style in default view:
```
📝 7 annotations: 3 errors, 2 warnings, 2 info
```

### Annotation Icons
```typescript
const ANNOTATION_ICONS = {
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  SUCCESS: '✅',
  DEFAULT: '📝'
};
```

### Progressive Annotation Display

1. **Count only** (default for passed builds):
   ```
   📝 2 annotations
   ```

2. **Summary with context** (`--annotations`):
   ```
   ❌ ERROR [rspec-failures]: 361 test failures
   ❌ ERROR [lint]: ESLint issues found
   ⚠️ WARNING [slow-tests]: Performance degradation
   ℹ️ INFO [coverage]: 87.3% coverage
   ```

3. **Full content** (`--annotations-full`):
   - Convert HTML to text
   - Show complete annotation bodies
   - Group by context

## Job Display Options

### Job Summary (`--jobs`)
```
Jobs: ✅ 19 passed  ❌ 1 failed  ⏭️ 1 skipped

Passed (19):
  ✅ Helm (1m 12s)
  ✅ Seeds (45s)
  ✅ Constants Package Check (2m 30s)
  [... truncated, 16 more]

Failed (1):
  ❌ RSpec (24m 32s, exit 1)
     361/361 tests failed
     
Skipped (1):
  ⏭️ Post Build (dependency failed)
```

### Failed Jobs Only (`--failed`)
```
Failed Jobs:
────────────
❌ RSpec (24m 32s, exit code 1)
   Started: 10:51 AM (after 1m 42s wait)
   Agent: buildkite-agent-xyz
   
   Last 10 lines of output:
   [... log tail ...]
   
   📝 ERROR annotation: 361 test failures
```

## Technical Implementation

### 1. Command Structure

```typescript
// src/commands/ShowBuild.ts
export interface ShowBuildOptions extends BaseCommandOptions {
  jobs?: boolean;
  failed?: boolean;
  annotations?: boolean;
  annotationsFull?: boolean;
  full?: boolean;
  summary?: boolean;
}

export class ShowBuild extends BaseCommand {
  static requiresToken = true;

  async execute(buildRef: string, options: ShowBuildOptions): Promise<number> {
    // Parse build reference
    const { org, pipeline, number } = parseBuildRef(buildRef);
    
    // Fetch build data
    const build = await this.getBuildData(org, pipeline, number, options);
    
    // Format based on options and state
    const formatter = this.getFormatter(FormatterType.BUILD_DETAIL, options);
    const output = formatter.format(build, options);
    
    logger.console(output);
    return 0;
  }
}
```

### 2. GraphQL Queries

```typescript
// src/graphql/queries.ts

// Basic build info for default view
export const GET_BUILD_SUMMARY = gql`
  query GetBuildSummary($slug: ID!) {
    build(slug: $slug) {
      id
      number
      state
      branch
      message
      commit
      createdAt
      startedAt
      finishedAt
      creator {
        ... on User { name email }
        ... on UnregisteredUser { name email }
      }
      jobs(first: 100) {
        edges {
          node {
            ... on JobTypeCommand {
              id
              label
              state
              exitStatus
              startedAt
              finishedAt
            }
          }
        }
      }
      annotations(first: 50) {
        edges {
          node {
            id
            style
            context
            bodyHTML
          }
        }
      }
    }
  }
`;

// Detailed build info for --full
export const GET_BUILD_FULL = gql`
  query GetBuildFull($slug: ID!) {
    build(slug: $slug) {
      # ... all fields from summary plus:
      url
      pullRequest {
        id
        repository
        number
      }
      triggeredFrom {
        ... on Build {
          number
          pipeline { name slug }
        }
      }
      pipeline {
        name
        slug
        repository { url }
      }
      # ... additional fields
    }
  }
`;
```

### 3. Formatter Implementation

```typescript
// src/formatters/build-detail/PlainTextFormatter.ts
export class PlainTextBuildDetailFormatter extends BaseFormatter {
  format(build: Build, options: ShowBuildOptions): string {
    // Determine what to show based on state
    if (options.summary) {
      return this.formatSummaryLine(build);
    }
    
    if (options.full) {
      return this.formatFullDetails(build);
    }
    
    // Default: contextual display based on state
    switch (build.state) {
      case 'FAILED':
        return this.formatFailedBuild(build, options);
      case 'RUNNING':
        return this.formatRunningBuild(build, options);
      case 'BLOCKED':
        return this.formatBlockedBuild(build, options);
      case 'PASSED':
        return this.formatPassedBuild(build, options);
      default:
        return this.formatDefaultBuild(build, options);
    }
  }
  
  private formatFailedBuild(build: Build, options: ShowBuildOptions): string {
    const lines: string[] = [];
    
    // Header line
    lines.push(this.formatHeader(build));
    lines.push(this.formatCommit(build));
    lines.push('');
    
    // Failed jobs summary
    const failedJobs = build.jobs.filter(j => j.state === 'FAILED');
    if (failedJobs.length > 0) {
      lines.push(this.formatFailedJobsSummary(failedJobs));
    }
    
    // Annotation summary
    if (build.annotations.length > 0) {
      lines.push(this.formatAnnotationSummary(build.annotations));
    }
    
    // Hints for more info
    if (!options.failed && failedJobs.length > 0) {
      lines.push('');
      lines.push(`→ bktide build ${build.number} --failed    # failure details`);
    }
    if (!options.annotations && build.annotations.length > 0) {
      lines.push(`→ bktide build ${build.number} --annotations  # view annotations`);
    }
    
    return lines.join('\n');
  }
  
  private formatAnnotationSummary(annotations: Annotation[]): string {
    const counts = this.countAnnotationsByStyle(annotations);
    const parts = [];
    
    if (counts.ERROR > 0) parts.push(`${counts.ERROR} error${counts.ERROR > 1 ? 's' : ''}`);
    if (counts.WARNING > 0) parts.push(`${counts.WARNING} warning${counts.WARNING > 1 ? 's' : ''}`);
    if (counts.INFO > 0) parts.push(`${counts.INFO} info`);
    if (counts.SUCCESS > 0) parts.push(`${counts.SUCCESS} success`);
    
    return `📝 ${annotations.length} annotation${annotations.length > 1 ? 's' : ''}: ${parts.join(', ')}`;
  }
}
```

### 4. Integration with CLI

```typescript
// src/index.ts
program
  .command('build <build-ref>')
  .description('Show details for a specific build')
  .option('--jobs', 'Show job summary and details')
  .option('--failed', 'Show only failed job details')
  .option('--annotations', 'Show annotation details')
  .option('--annotations-full', 'Show complete annotation content')
  .option('--full', 'Show all available information')
  .option('--summary', 'Single-line summary only')
  .option('--format <format>', 'Output format', 'plain')
  .option('--debug', 'Enable debug output')
  .action(async (buildRef: string, options) => {
    const command = new ShowBuild();
    const exitCode = await command.execute(buildRef, options);
    process.exit(exitCode);
  });
```

## Testing Strategy

### Test Cases

1. **Build reference parsing**:
   - Slug format: `org/pipeline/123`
   - URL format: `https://buildkite.com/org/pipeline/builds/123`
   - URL with @ prefix: `@https://...`
   - Invalid formats

2. **State-specific display**:
   - Test each build state (passed, failed, running, blocked, canceled)
   - Verify appropriate information is shown for each state

3. **Annotation handling**:
   - Builds with no annotations
   - Builds with multiple annotation styles
   - Annotation truncation and full display

4. **Job display**:
   - All passed jobs
   - Mixed pass/fail jobs
   - Job grouping and summaries

5. **Option combinations**:
   - `--failed` implies `--jobs`
   - `--full` shows everything
   - `--summary` overrides other options

### Manual Testing Commands

```bash
# Test various build states with slug format
bin/bktide build gusto/zenpayroll/1290734  # failed build
bin/bktide build gusto/zenpayroll/1290735  # passed build
bin/bktide build gusto/zenpayroll/1290736  # running build

# Test URL format (both work identically)
bin/bktide build "https://buildkite.com/gusto/zenpayroll/builds/1290734"
bin/bktide build https://buildkite.com/gusto/zenpayroll/builds/1290735  # quotes optional if no special chars

# Test Alfred workflow format
bin/bktide build "@https://buildkite.com/gusto/zenpayroll/builds/1290734"

# Test annotation display (works with any format)
bin/bktide build gusto/zenpayroll/1290734 --annotations
bin/bktide build "https://buildkite.com/gusto/zenpayroll/builds/1290734" --annotations-full

# Test job display
bin/bktide build gusto/zenpayroll/1290734 --jobs
bin/bktide build gusto/zenpayroll/1290734 --failed

# Test output formats
bin/bktide build gusto/zenpayroll/1290734 --format json
bin/bktide build gusto/zenpayroll/1290734 --format alfred

# Edge cases - orgs/pipelines with special characters
bin/bktide build my-org/my-pipeline-name/123
bin/bktide build org_with_underscores/pipeline_name/456
```

## Implementation Phases

### Phase 1: Basic Command (MVP)
- [ ] Create ShowBuild command class
- [ ] ✅ Build reference parsing (reuse existing `parseBuildRef` - already tested and working)
- [ ] Add basic GraphQL query for build data
- [ ] Implement state-based formatting
- [ ] Add to CLI entry point

**Note**: The `parseBuildRef` utility already exists and has been verified to handle:
- Slug format: `org/pipeline/123`
- URL format: `https://buildkite.com/org/pipeline/builds/123`
- Alfred format: `@https://buildkite.com/org/pipeline/builds/123`

### Phase 2: Annotations
- [ ] Extend GraphQL query for annotations
- [ ] Implement annotation formatting with styles and context
- [ ] Add `--annotations` and `--annotations-full` options
- [ ] HTML to text conversion for annotation bodies

### Phase 3: Job Details
- [ ] Add job querying and formatting
- [ ] Implement `--jobs` and `--failed` options
- [ ] Add job state summaries and grouping

### Phase 4: Polish
- [ ] Add `--full` option for complete information
- [ ] Add `--summary` option for scripts
- [ ] Implement JSON and Alfred formatters
- [ ] Add shell completions
- [ ] Documentation and examples

## Success Metrics

1. **Conciseness**: Default output is 3-5 lines max
2. **Relevance**: Information shown matches what users need for that build state
3. **Speed**: Response time under 500ms for default view
4. **Discoverability**: Clear hints for accessing more information
5. **Consistency**: Follows existing CLI patterns and visual design

## Related Work

- Existing `annotations` command shows annotations for a specific build
  - Consider whether to enhance `annotations` vs new `build` command
  - Current annotations command: `bktide annotations <build-ref>`
  - Could add `--build-details` to annotations command as alternative
- `builds` list command provides entry point to individual builds
- Consider adding build URL/number to other command outputs for easy reference

### Integration Considerations

The new `build` command would complement the existing commands:
- `builds` - lists builds (multiple)
- `build` - shows single build details (new)
- `annotations` - shows annotations for a build (existing, focused)

This follows the pattern of having both list and detail commands for entities.

## Open Questions

1. Should we support build aliases like `latest`, `last-failed`?
2. Should we add a `--watch` option for running builds?
3. How to handle very long annotation content (pagination vs truncation)?
4. Should we fetch logs for failed jobs inline or keep separate?

## Follow-up Improvements

### Phase 1: Visual & Formatting Enhancements
- **Add semantic colors**: Use color for pass/fail states consistently throughout
- **Emoji support**: 
  - Parse and display emoji from step labels (e.g., `:smile:`, `:rspec:`)
  - Support both standard emoji and Buildkite-specific ones
  - Replace UTF-8 characters with emoji for consistency (❌ → 🔴, ✅ → 🟢, etc.)
- **Fix tips formatting**: 
  - Remove "Tips:" label and special coloring
  - Use consistent format: `→ command  # description` instead of mixed formats

### Phase 2: Job Display Optimization
- **Group identical jobs**: When multiple jobs have same label/state, show as:
  ```
  Failed: :jest: Jest (87 jobs, all not started)
  Failed: :rspec: RSpec (1 job, exit 1, 24m 32s)
  ```
- **Enhanced job details** with `--jobs`:
  - Agent information (name, hostname)
  - Precise timing (queued, started, finished)
  - Exit codes and retry information
  - Parallel group info (e.g., "187/360")
- **Pagination/limiting**:
  - Default to showing first 10 unique job types
  - Add `--all-jobs` flag to show everything
  - Show summary like "...and 73 more similar jobs"

### Phase 3: Data Enhancements
- **Pull request details**: Work around GraphQL limitations
  - Consider fetching PR info from REST API if available
  - Or at minimum, construct GitHub PR URL from ID
- **Performance optimizations**:
  - Implement smart defaults (limit jobs to 10 unique types)
  - Add progress indicator for large builds
  - Consider caching job patterns

### Phase 4: Advanced Features
- Add `build logs <build-ref> <job-name>` for viewing job logs
- Support build artifact listing/downloading
- Add build retry/cancel capabilities (with appropriate permissions)
- Integration with `open` command to open build in browser
- Add `--watch` option for running builds
