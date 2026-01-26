# Smart Buildkite Reference Command Design

**Date:** 2025-12-08  
**Status:** Design Complete

## Overview

Add a smart command to bktide that intelligently parses Buildkite URLs or references and displays the appropriate content. This allows users to paste any Buildkite URL or use short reference formats without needing to know specific subcommands.

## Goals

- Support pasting Buildkite URLs directly as CLI arguments
- Provide convenient short-hand formats (slash and hash notation)
- Display rich, comprehensive views by default
- Add step log viewing capability
- Keep existing subcommands working as-is

## Supported Input Formats

| Format | Example | Result |
|--------|---------|--------|
| Full URL (build) | `https://buildkite.com/acme/example-pipeline/builds/76` | Build overview |
| Full URL (with step) | `https://buildkite.com/acme/example-pipeline/builds/76?sid=019adb19...` | Step logs |
| Slash format (build) | `acme/example-pipeline/76` | Build overview |
| Hash format (build) | `acme/example-pipeline#76` | Build overview |
| Pipeline reference | `acme/example-pipeline` | Pipeline details + recent builds |

**URL Normalization:**
- Ignore `/steps/canvas` path segments (treat as build overview)
- Handle trailing slashes
- Normalize HTTP to HTTPS
- Extract `?sid=...` query parameter for step ID

## Architecture

### Command Routing

```
User types: bktide <argument>
    ↓
1. Check if argument exactly matches known subcommand
    ↓ (no match)
2. Try parsing as Buildkite reference
    ↓ (parse success)
3. Route to SmartShow command
    ↓
4. Determine type: pipeline | build | build-with-step
    ↓
5. Display appropriate view
```

**Important:** Exact subcommand matching happens first to prevent conflicts (e.g., an org named "builds").

### Reference Types

```typescript
type BuildkiteReference = 
  | { type: 'pipeline'; org: string; pipeline: string }
  | { type: 'build'; org: string; pipeline: string; buildNumber: number }
  | { type: 'build-with-step'; org: string; pipeline: string; buildNumber: number; stepId: string }
```

### Parser Logic

**Location:** `src/utils/parseBuildkiteReference.ts`

1. If input starts with `https://buildkite.com/`:
   - Extract org/pipeline from URL path
   - Extract buildNumber if `/builds/{number}` present
   - Extract stepId from `?sid=` query param
2. If input contains `#`:
   - Split on hash: `org/pipeline#buildNumber`
3. If input contains `/`:
   - Count segments:
     - 2 segments → pipeline
     - 3 segments → build
4. Return typed reference object

## Display Behaviors

### For Pipelines (`acme/example-pipeline`)

**What to Show:**
- Pipeline metadata (name, description, default branch, repository, URL)
- Recent builds table (last 10-20 builds)

**Implementation:**
- Add new GraphQL query to fetch single pipeline by org + slug
- Create `src/formatters/pipeline-detail/` formatter
- Display pipeline header with metadata
- Display builds table using existing builds formatter pattern

**Example Output:**
```
Pipeline: acme/example-pipeline
Description: Schema migration workflow for data platform
Default Branch: main
Repository: github.com/acme/example-pipeline

Recent Builds:
┌────────┬─────────┬─────────┬──────────────┬────────────┐
│ Build  │ Status  │ Branch  │ Message      │ Started    │
├────────┼─────────┼─────────┼──────────────┼────────────┤
│ #76    │ ✓ passed│ main    │ Add index    │ 2h ago     │
│ #75    │ ✖ failed│ feat/x  │ Update...    │ 3h ago     │
└────────┴─────────┴─────────┴──────────────┴────────────┘
```

### For Builds (`acme/example-pipeline/76`)

**What to Show:**
- Comprehensive build view with jobs and failure details

**Implementation:**
- Route to existing `ShowBuild` command
- Set defaults: `--jobs --failed` (more comprehensive than default)
- Reuse existing build detail formatter

**Rationale:** Smart command should be richer by default since users are explicitly asking for a specific build.

### For Builds with Step ID (`acme/example-pipeline/76?sid=...`)

**What to Show:**
1. Build context header (org, pipeline, build number, status, timing)
2. Step information (job label, step state, exit status, timing)
3. Log content (last 50 lines by default)
4. Helpful tip for viewing more

**Implementation:**
- Fetch build details (for context)
- Fetch job/step metadata
- Fetch logs via REST API
- Create `src/formatters/step-logs/` formatter

**Example Output:**
```
Build: acme/example-pipeline #76
Status: ✖ failed
Started: 2 hours ago
Duration: 15m 32s

Step: Run RSpec Tests
Job ID: 019adb19-bd83-4149-b2a7-ece1d7a41c9d
State: failed
Exit Status: 1

Logs (last 50 lines of 1,247):
──────────────────────────────────────
[... log content with ANSI colors ...]
──────────────────────────────────────

→ Log is 2.3 MB. Showing last 50 lines.
→ Run with --full to see all 1,247 lines
→ Run with --save <path> to save to file
```

## Log Fetching Implementation

### REST API Integration

**Extend:** `src/services/BuildkiteRestClient.ts`

```typescript
async getJobLog(
  org: string,
  pipeline: string,
  buildNumber: number,
  jobId: string
): Promise<JobLog> {
  const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/jobs/${jobId}/log`;
  return this.get<JobLog>(endpoint);
}
```

**Endpoint:** `GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{build}/jobs/{job}/log`  
**Content-Type:** `application/json` (structured response with metadata)

**Response Type:**
```typescript
interface JobLog {
  url: string;           // Log URL
  content: string;       // Raw ANSI log content
  size: number;          // Size in bytes
  header_times: number[]; // Timing information
}
```

### Caching Strategy

- Use existing `CacheManager`
- Cache key: `log:${org}:${pipeline}:${buildNumber}:${jobId}`
- Use default cache TTL (same as builds)
- Logs are immutable once job finishes → safe to cache aggressively
- Cache full content, render only requested lines

### Log Display

**Default Behavior:**
- Show last 50 lines
- Preserve ANSI color codes
- Show total line count and file size
- Display helpful tip for viewing more

**Flags:**
- `--lines <n>`: Show last N lines (default: 50)
- `--full`: Show all lines
- `--save <path>`: Save full log to file

**Line Counting:**
- Split `content` by `\n`
- Take last N lines for display
- `--full` takes precedence over `--lines`

**File Saving:**
- Write full log content regardless of `--lines`
- Preserve ANSI codes (useful for `less -R`)
- Show confirmation: "Log saved to <path> (2.3 MB, 1,247 lines)"

## Command Options

```bash
# Inherited from BaseCommand
--format <plain|json|alfred>  # Output format
--token, -t <token>           # API token
--org <org>                   # Override org from reference
--debug, -d                   # Debug mode
--no-cache                    # Disable caching
--cache-ttl <ms>              # Cache TTL override

# New flags (apply to log display only)
--full                        # Show all log lines
--save <path>                 # Save logs to file
--lines <n>                   # Show last N lines (default: 50)
```

## Error Handling

| Scenario | Error Message |
|----------|---------------|
| Invalid reference format | `Invalid Buildkite reference. Examples: acme/example-pipeline, acme/example-pipeline/76, https://buildkite.com/...` |
| Pipeline not found | `Pipeline not found: acme/example-pipeline. Check organization and pipeline names.` |
| Build not found | `Build not found: acme/example-pipeline/76. Build may not exist or you may not have access.` |
| Step not found | `Step not found in build #76. The step ID may be invalid or the step may have been deleted.` |
| Missing log permissions | `Your API token needs 'read_build_logs' scope to view logs. Update your token at: https://buildkite.com/user/api-access-tokens` |
| Failed to fetch logs | `Failed to fetch logs: [API error]. Try again or use --debug for details.` |

## Edge Cases

### Token Permissions
- Existing features: `read_builds`, `read_organizations`, `read_pipelines`
- New requirement: `read_build_logs` for log viewing
- Show clear error when logs fail due to missing scope

### URL Variations
- Trailing slashes: normalize `acme/example-pipeline/` → `acme/example-pipeline`
- HTTP vs HTTPS: normalize to HTTPS
- Step URLs without query params: ignore `/steps/canvas`, treat as build
- Invalid step IDs: fetch build metadata, show "Step not found" error

### Large Logs
- Logs can exceed 10 MB for long-running jobs
- Cache full content but only render requested lines
- Show file size in tips: "Log is 2.3 MB (1,247 lines)"
- Consider streaming for `--save` to avoid memory issues with huge logs

### Organization Ambiguity
- Parser extracts org from reference (no ambiguity)
- Global `--org` flag can override if needed
- No automatic org detection needed

## Implementation Plan

### Phase 1: Parser
- [ ] Create `src/utils/parseBuildkiteReference.ts`
- [ ] Implement URL parsing
- [ ] Implement slash/hash format parsing
- [ ] Write unit tests for all input formats
- [ ] Test edge cases (trailing slashes, http vs https, etc.)

### Phase 2: Pipeline View
- [ ] Add GraphQL query for single pipeline
- [ ] Create `src/formatters/pipeline-detail/` formatter
- [ ] Implement pipeline metadata display
- [ ] Implement recent builds display
- [ ] Test with real API data

### Phase 3: Build View
- [ ] Create `src/commands/SmartShow.ts` skeleton
- [ ] Implement routing to `ShowBuild` with `--jobs --failed`
- [ ] Test build display works as expected

### Phase 4: Logs
- [ ] Add `JobLog` interface to `src/types/buildkite.ts`
- [ ] Implement `getJobLog()` in `BuildkiteRestClient.ts`
- [ ] Add caching for logs in `CacheManager`
- [ ] Create `src/formatters/step-logs/` formatter
- [ ] Implement `--lines`, `--full`, `--save` flags
- [ ] Test with small and large logs

### Phase 5: Integration
- [ ] Modify `src/index.ts` to add routing logic
- [ ] Export `SmartShow` from `src/commands/index.ts`
- [ ] Add integration tests for all reference types
- [ ] Test error scenarios
- [ ] Update documentation

### Files to Create
1. `src/commands/SmartShow.ts` - Main command class
2. `src/utils/parseBuildkiteReference.ts` - Parser utility
3. `src/formatters/pipeline-detail/Formatter.ts` - Pipeline view formatter
4. `src/formatters/pipeline-detail/PlainFormatter.ts` - Plain text output
5. `src/formatters/pipeline-detail/JsonFormatter.ts` - JSON output
6. `src/formatters/pipeline-detail/index.ts` - Exports
7. `src/formatters/step-logs/Formatter.ts` - Step logs formatter
8. `src/formatters/step-logs/PlainFormatter.ts` - Plain text output
9. `src/formatters/step-logs/JsonFormatter.ts` - JSON output
10. `src/formatters/step-logs/index.ts` - Exports

### Files to Modify
1. `src/index.ts` - Add SmartShow routing
2. `src/services/BuildkiteRestClient.ts` - Add `getJobLog()`
3. `src/types/buildkite.ts` - Add `JobLog` interface
4. `src/graphql/queries.ts` - Add single pipeline query
5. `src/commands/index.ts` - Export SmartShow

## Testing Strategy

### Unit Tests
- Parser: test all input formats and edge cases
- Reference type detection: ensure correct typing
- Log line extraction: test last N lines logic

### Mock Tests
- Log fetching with pattern-based mocks
- Cache hit/miss scenarios
- Error handling for each failure mode

### Integration Tests
- End-to-end test for each reference type
- Test with real API (using existing hybrid mock strategy)
- Test all formatters (plain, json, alfred)

### Manual Testing Checklist
- [ ] Pipeline view shows correct data
- [ ] Build view shows comprehensive details
- [ ] Log view shows last N lines correctly
- [ ] `--full` shows all lines
- [ ] `--save` writes file correctly
- [ ] Caching works (second run is instant)
- [ ] Error messages are helpful
- [ ] Tips are displayed appropriately

## Future Enhancements

**Out of scope for initial implementation:**
- Log streaming for running builds
- Follow mode (`--follow`) for live log tailing
- Search/filter within logs (`--grep`)
- Annotations on specific steps
- Direct links to failed lines in logs
- Log syntax highlighting based on job type

## Success Criteria

✅ Users can paste any Buildkite URL and see relevant content  
✅ Short-hand formats work (slash and hash notation)  
✅ Log viewing works with caching  
✅ Error messages are clear and actionable  
✅ All existing commands continue to work  
✅ Tests cover all reference types and edge cases  
✅ Documentation is updated
