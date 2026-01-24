# Snapshot UX Improvements

**Date:** 2026-01-24
**Context:** Based on feedback from AI agent (Claude Code) usage documented in `docs/retrospective/2026-01-23-claude-code-usage-feedback.md`

## Summary

Improve the discoverability and usability of the `bktide snapshot` command by:
1. Adding comprehensive documentation to the README
2. Enhancing the manifest.json structure to mirror Buildkite's API for easier navigation
3. Providing contextual post-command tips that guide users to relevant data

## Background

The snapshot command was successfully used by an AI agent to debug CI failures, but the experience revealed several pain points:

- **Discoverability**: Agent didn't know snapshot existed until the user suggested it
- **Output structure unclear**: Had to explore directory structure through trial and error
- **No navigation guidance**: After capture, no clear path to finding relevant data

The command IS registered in `--help` and works well, but needs better positioning and user guidance.

## Goals

1. **Increase discoverability**: Make snapshot prominent in README as a tool for deep debugging and tool integration
2. **Improve navigability**: Enhance manifest.json to be a comprehensive index that mirrors Buildkite's API structure
3. **Guide users**: Show contextual tips after snapshot completes with specific commands to find relevant data

## Design

### 1. Enhanced manifest.json Structure

**Current problem:**
- manifest.json only tracks fetch status, not build status
- Need to open each step.json to find which steps failed
- Confusing that `status` field means "did we fetch it" not "did it pass"

**Proposed structure:**

```json
{
  "version": 2,
  "buildRef": "org/pipeline/123",
  "url": "https://buildkite.com/...",
  "fetchedAt": "2026-01-23T...",
  "fetchComplete": true,
  "build": {
    "state": "failed",
    "number": 123,
    "message": "Fix login bug",
    "branch": "main",
    "commit": "abc123"
  },
  "steps": [
    {
      "id": "01-rspec-system",
      "fetchStatus": "success",
      "jobId": "abc-123-uuid",
      "type": "script",
      "name": "RSpec System",
      "label": ":rspec: RSpec System",
      "state": "failed",
      "exit_status": 1,
      "started_at": "2026-01-23T10:00:00Z",
      "finished_at": "2026-01-23T10:05:00Z"
    }
  ],
  "fetchErrors": [
    {
      "id": "03-deploy",
      "jobId": "def-456",
      "fetchStatus": "failed",
      "error": "rate_limited",
      "message": "Rate limit exceeded",
      "retryable": true
    }
  ]
}
```

**Key changes:**
- Include all relevant job fields from Buildkite API (flat structure, as they provide it)
- Rename `status` → `fetchStatus` to avoid confusion with `state`
- Rename `complete` → `fetchComplete` for clarity
- Expand `build` section with commonly needed fields
- Separate `fetchErrors` array for steps that failed to fetch
- Version bump to 2 to indicate format change

**Benefits:**
- Quick filtering: `jq '.steps[] | select(.state == "failed")'`
- No need to open individual step.json files
- Clear separation: `state` = build result, `fetchStatus` = did we get the log

### 2. README Documentation

**Placement:** Add new section after "Visual Features" (around line 350) and before "Global Options"

**Rationale:** Separates snapshot from interactive navigation commands, positioning it as a tool for deep debugging and tool integration.

**Content:**

```markdown
## Snapshot: Offline Build Analysis

When you need to do deep debugging or feed build data into other tools, use `snapshot` to download complete build data locally.

### Capture a Build Snapshot

```bash
# Capture failed steps from a build
bktide snapshot https://buildkite.com/org/pipeline/builds/123
bktide snapshot org/pipeline/123

# Capture all steps (not just failures)
bktide snapshot org/pipeline/123 --all

# Custom output location
bktide snapshot org/pipeline/123 --output-dir ./investigation
```

### What Gets Captured

Snapshots are saved to `~/.bktide/snapshots/org/pipeline/build/` with:

- **manifest.json** - Build metadata and step index for quick filtering
- **build.json** - Complete build data from Buildkite API
- **steps/NN-name/log.txt** - Full logs for each step
- **steps/NN-name/step.json** - Step metadata (state, exit code, timing)

### Common Use Cases

**Find what failed:**
```bash
cd ~/.bktide/snapshots/org/pipeline/123
jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' manifest.json
```

**Search logs for errors:**
```bash
grep -r "Error\|Exception" steps/
```

**Feed to AI agents:**
```bash
bktide snapshot org/pipeline/123
claude "analyze failures in ~/.bktide/snapshots/org/pipeline/123"
```

**Share with teammates:**
```bash
tar -czf build-123-investigation.tar.gz ~/.bktide/snapshots/org/pipeline/123
```
```

### 3. Contextual Post-Command Tips

**Goal:** After snapshot completes, show specific actionable commands (not raw data dumps).

**For failed builds:**

```bash
✓ FAILED Update gusto-kafka-common to use kafka-rails 11.1.0 #1407050 1h 2m
         Josh Nichols • jnichols/bump-kafka-rails-11-1-0 • 24c9459
442 steps: 391 passed, 20 failed, 31 other
  ✗ :rspec: RSpec System (10 more...)

Snapshot saved to ~/.bktide/snapshots/gusto/zenpayroll/1407050/
  20 step(s) captured
  manifest.json has full build metadata and step index

Next steps:
  → List failures:   jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' manifest.json
  → Get exit codes:  jq -r '.steps[] | "\(.id): exit \(.exit_status)"' manifest.json
  → View a log:      cat steps/01-rspec-system/log.txt
  → Search errors:   grep -r "Error\|Failed\|Exception" steps/
```

**For passed builds (with --all):**

```bash
✓ PASSED Fix login validation #1407051 5m 12s
         Josh Nichols • main • 24c9459
15 steps: 15 passed

Snapshot saved to ~/.bktide/snapshots/gusto/zenpayroll/1407051/
  15 step(s) captured
  manifest.json has full build metadata and step index

Next steps:
  → List all steps:  jq -r '.steps[] | "\(.id): \(.label) (\(.state))"' manifest.json
  → Browse logs:     ls steps/
  → View a log:      cat steps/01-build/log.txt
```

**Implementation approach:**
- Use existing `Reporter` class for tips (respects `--tips`/`--no-tips`)
- Use `TipStyle.ACTIONS` for "Next steps:" formatting
- Show relative paths from snapshot directory
- Contextual based on build state (failed vs passed)
- Check `this.options.tips !== false` in execute() before calling

## Implementation Plan

### Phase 1: Enhanced Manifest

**File:** `src/commands/Snapshot.ts`

1. Update `Manifest` interface:
   - Bump version to 2
   - Rename `complete` → `fetchComplete`
   - Expand `build` section
   - Add `fetchErrors` array

2. Update `StepResult` interface:
   - Add `job: any` field to store full job object

3. Update `buildManifest()` method:
   - Include job fields in steps array (flat structure)
   - Rename status fields for clarity
   - Separate fetch errors into dedicated array

4. Update `fetchAndSaveStep()`:
   - Return full job object in StepResult

### Phase 2: Post-Command Tips

**File:** `src/commands/Snapshot.ts`

1. Add `Reporter` to constructor:
   ```typescript
   import { Reporter } from '../ui/reporter.js';
   import { TipStyle } from '../ui/theme.js';

   private reporter: Reporter;

   constructor(options?: Partial<SnapshotOptions>) {
     super(options);
     this.reporter = new Reporter(options?.format || 'plain', options?.quiet, options?.tips);
   }
   ```

2. Add `displayNavigationTips()` method:
   - Build contextual tips array based on build state
   - Use relative paths for commands
   - Call `this.reporter.tips(tips, TipStyle.ACTIONS)`

3. Add helper method `getFirstFailedStepDir()`:
   - Find first failed step directory name for concrete example

4. Update `execute()` output section:
   - Add check: `if (this.options.tips !== false)`
   - Call `displayNavigationTips()` when tips enabled

**Note:** Review tip formatting in other commands (ListBuilds, ManageToken, ShowLogs) for consistency in:
- Spacing/blank lines before tips
- TipStyle choice
- Message phrasing
- Path formatting

### Phase 3: README Updates

**File:** `README.md`

1. Add new "Snapshot: Offline Build Analysis" section after "Visual Features"
2. Include:
   - Use case framing (deep debugging, tool integration)
   - Command examples with both URL and slug formats
   - Output structure explanation
   - Four concrete use cases with actual commands
   - AI agent integration example

## Testing Considerations

1. **Manifest structure:**
   - Verify version 2 format
   - Confirm all job fields are included
   - Check fetchErrors array is only included when present

2. **Tips display:**
   - Test with `--tips` (should show)
   - Test with `--no-tips` (should not show)
   - Test with `--quiet` (should not show)
   - Test with failed build (contextual tips)
   - Test with passed build + --all (contextual tips)

3. **Backwards compatibility:**
   - Existing snapshots (version 1) should still be readable
   - Tools parsing manifest.json may need updates

## Success Metrics

1. **Discoverability**: Users and AI agents find snapshot command without prompting
2. **Navigation speed**: Time to find failed steps reduced (no need to explore structure)
3. **Self-service**: Post-command tips enable immediate productive use

## Future Enhancements

- Add `bktide snapshot --help` with detailed examples
- Consider `bktide analyze <snapshot-dir>` command for common queries
- Shell completion for snapshot paths
- Snapshot diff tool to compare builds
