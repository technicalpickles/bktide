# Snapshot UX Improvements - Iteration 2

**Date:** 2026-01-27
**Context:** Feedback from manual testing of iteration 1 implementation
**Prerequisite:** Complete iteration 1 (`docs/plans/2026-01-24-snapshot-ux-improvements.md`)

## Summary

Polish snapshot command output and add incremental fetching to avoid re-downloading unchanged data.

## Background

After implementing iteration 1 (manifest v2, annotations support, contextual tips), manual testing revealed:

1. **Output readability issues**: Sections run together, some elements misplaced or inconsistently formatted
2. **Inefficient re-fetching**: Every snapshot run re-downloads everything, even for unchanged builds
3. **Location friction**: Default `~/.bktide/snapshots/` may require permissions on CI agents

## Goals

1. **Cleaner output**: Better visual separation, consistent formatting, logical tip placement
2. **Incremental fetching**: Only re-fetch changed jobs/annotations
3. **Agent-friendly defaults**: Local temp directory that works without special permissions

---

## Design

### 1. Output Improvements

#### Visual Delimiter for npm run dev

**Problem:** Running `npm run dev` shows "Command-line arguments" noise before actual output, making it hard to distinguish command output.

**Solution:** Add delimiter in the npm script wrapper (not in command itself - command shouldn't know it's wrapped):

```
──────────────────── bktide output ────────────────────
[actual command output here]
```

**Implementation:** Update `package.json` scripts or create a wrapper script.

#### Section Spacing

**Problem:** Build summary and snapshot info run together.

**Solution:** Single blank line between major sections:

```
✗ FAILED Update kafka-common #1407050 1h 2m
         Josh Nichols • feature/bump-kafka • 24c9459
442 steps: 391 passed, 20 failed, 31 other

Snapshot saved to ./tmp/bktide/snapshots/gusto/zenpayroll/1407050/
  20 step(s) captured
  3 annotation(s) captured
```

#### Tip Relocation

**Problem:** "414 passing steps skipped" appears in the middle of output, feels misplaced.

**Solution:** Move to Next Steps section as actionable tip:

```
Next steps:
  → Use --all to include all 414 passing steps
  → List failures: jq -r '.steps[] | select(.state == "failed")' manifest.json
  ...
```

#### "Snapshot saved" Formatting

**Problem:** Current format is verbose and inconsistent.

**Solution:** Path on one line, details on subsequent lines:

```
Snapshot saved to ./tmp/bktide/snapshots/org/pipeline/123/
  20 step(s) captured
  3 annotation(s) captured
```

#### manifest.json Line

**Problem:** "manifest.json has full build metadata and step index" doesn't match tip formatting style.

**Solution:** Either:
- Make it a tip with arrow prefix: `→ manifest.json has full build metadata and step index`
- Or move to a "Files created:" section before tips

### 2. Default Snapshot Location

**Current:** `~/.bktide/snapshots/org/pipeline/build/`

**New default:** `./tmp/bktide/snapshots/org/pipeline/build/`

**Rationale:**
- Relative to current working directory
- Works on CI agents without special permissions
- Users expected to add `./tmp/` to `.gitignore` themselves

**Flags:**
- `--output-dir` / `-o`: Override location (unchanged)

### 3. Incremental Fetching

#### Overview

Don't re-fetch data that hasn't changed since last snapshot.

```
bktide snapshot org/pipeline/123
# First run: full fetch

bktide snapshot org/pipeline/123
# Second run: "Snapshot already up to date: ./tmp/bktide/snapshots/..."

bktide snapshot org/pipeline/123 --force
# Force full re-fetch
```

#### Detection Strategy

**Always use fresh API call** (bypass 30s cache) to check current state.

##### Build-Level

```
If state is RUNNING or SCHEDULED:
  → Full re-fetch (build in progress)

If state is terminal AND finishedAt matches stored value:
  → Check jobs and annotations for changes

If finishedAt differs from stored:
  → Full re-fetch (rebuild scenario)
```

##### Job-Level

Compare each job's `state` + `finishedAt` against manifest:

```
For each job in current API response:
  If job not in manifest:
    → Fetch new job (add to snapshot)

  If job.state != stored.state OR job.finishedAt != stored.finishedAt:
    → Re-fetch that job only

  If job in manifest but not in API response:
    → Update manifest (job removed - edge case)

If no job changes:
  → Skip job fetching
```

##### Annotation-Level

**Migrate from REST API to GraphQL** for efficiency.

Two-phase approach:

1. **Lightweight check** - fetch only comparison fields:
   ```graphql
   query {
     build(slug: "org/pipeline/123") {
       annotations(first: 100) {
         edges {
           node {
             uuid
             updatedAt
           }
         }
       }
     }
   }
   ```

2. **Full fetch** - only if changes detected:
   ```graphql
   query {
     build(slug: "org/pipeline/123") {
       annotations(first: 100) {
         edges {
           node {
             uuid
             context
             style
             body { html }
             createdAt
             updatedAt
           }
         }
       }
     }
   }
   ```

**Comparison logic:**
```
For each annotation in current API response:
  If uuid not in stored annotations:
    → Annotation added

  If uuid exists but updatedAt > stored.updatedAt:
    → Annotation modified

If any changes detected:
  → Re-fetch all annotations (simpler than merging)
  → Save to annotations.json
```

#### Output When Unchanged

```
Snapshot already up to date: ./tmp/bktide/snapshots/org/pipeline/123/

Next steps:
  → List failures: jq -r '.steps[] | select(.state == "failed")' manifest.json
  → View annotations: jq -r '.annotations[] | {context, style}' annotations.json
  ...
```

Tips still display even when no re-fetch needed.

#### New Flag: --force

```
bktide snapshot org/pipeline/123 --force
```

Bypasses all change detection, performs full re-fetch.

---

## Implementation Plan

### Phase 1: Output Polish

1. **Section spacing**: Add blank line between build summary and snapshot info
2. **Tip relocation**: Move "X passing steps skipped" to Next Steps
3. **"Snapshot saved" format**: Path on one line, details below
4. **manifest.json line**: Apply consistent formatting

### Phase 2: Default Location Change

1. **Update default path**: `./tmp/bktide/snapshots/...`
2. **Update README**: Document new default location
3. **Update tests**: Adjust path expectations

### Phase 3: Incremental Fetching Infrastructure

1. **Add --force flag**: Bypass change detection
2. **Load existing manifest**: Check if snapshot exists at expected path
3. **Fresh state check**: Fetch current build state (bypass cache)
4. **Build-level comparison**: Check state + finishedAt

### Phase 4: Job-Level Incremental Updates

1. **Job comparison logic**: Compare each job's state + finishedAt
2. **Selective fetching**: Only fetch changed jobs
3. **Manifest merging**: Update manifest with new job data
4. **Preserve unchanged files**: Keep existing log.txt/step.json

### Phase 5: Annotation Migration to GraphQL

1. **Add GraphQL queries**: Lightweight and full annotation queries
2. **Remove REST dependency**: Replace `getBuildAnnotations` REST call
3. **Annotation comparison**: Compare uuid + updatedAt
4. **Selective re-fetch**: Only fetch annotations if changes detected

### Phase 6: npm dev Script Delimiter

1. **Create wrapper script**: Add visual delimiter
2. **Update package.json**: Use wrapper for `npm run dev`

---

## Testing Considerations

### Output Polish
- Visual inspection of output formatting
- Verify spacing between sections
- Verify tip placement in Next Steps

### Default Location
- Test snapshot creates in `./tmp/bktide/snapshots/`
- Test `--output-dir` override still works
- Verify relative paths in tips are correct

### Incremental Fetching
- Test with running build (should always re-fetch)
- Test with unchanged finished build (should show "up to date")
- Test with `--force` (should re-fetch)
- Test with changed job (should re-fetch only that job)
- Test with new annotation (should re-fetch annotations)

### GraphQL Migration
- Verify annotation data matches previous REST output
- Test builds with 0, 1, many annotations
- Test annotation comparison logic

---

## Migration Notes

### REST to GraphQL for Annotations

The current implementation uses REST API:
```
GET /v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/annotations
```

Migrate to GraphQL for:
- Selective field fetching (efficiency)
- Consistent with rest of codebase
- Better typing via codegen

### Backwards Compatibility

- Existing snapshots (manifest v2) remain valid
- New snapshots will use `./tmp/` by default
- Users with existing `~/.bktide/snapshots/` workflows can use `--output-dir`

---

## Success Metrics

1. **Output clarity**: Users can quickly scan output and find relevant info
2. **Fetch efficiency**: Unchanged builds skip network calls for jobs/annotations
3. **Agent compatibility**: Snapshots work without permission issues on CI

---

## Related Documentation

- Iteration 1: `docs/plans/2026-01-24-snapshot-ux-improvements.md`
- Original design: `docs/plans/2025-01-21-snapshot-command-design.md`
- UI design system: `docs/developer/ui-design-system.md`
