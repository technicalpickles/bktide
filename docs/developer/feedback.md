# Snapshot Tips Display Issues

## Problem 1: Tips Not Showing in Non-TTY Environments

**Observed:** When running through `npm run dev` or other build scripts, `process.stdout.isTTY` is undefined, causing `isInteractive()` to return false and suppress tips.

**Impact:** Makes testing difficult - can't verify tips output through automated tests or build scripts.

## Problem 2: Potential stdout/stderr Ordering

**Observed:** Tips may appear out of order when stdout and stderr are mixed:
- Progress bar writes to stderr
- Build summary and tips write to stdout
- Output can be interleaved unexpectedly

## Proposed Solutions

### Solution 1: Add --force-interactive Flag

Add global flag to override TTY detection:

```typescript
// In index.ts global options
.option('--force-interactive', 'Force interactive mode (for testing)')
```

Update `isInteractive()` in reporter.ts:

```typescript
function isInteractive(): boolean {
  // Check for forced interactive mode first
  if (process.env.BKTIDE_FORCE_INTERACTIVE === '1') {
    return true;
  }

  // Only show decorative messages when stdout is a TTY (not piped/redirected)
  return Boolean(process.stdout.isTTY);
}
```

Usage:
```bash
# For testing
BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot ...

# Or with flag
node dist/index.js snapshot ... --force-interactive
```

###Solution 2: Ensure Consistent Stream Usage

**Current:**
- Progress: stderr
- Everything else: stdout

**Options:**
1. Move everything to stdout (simpler, but progress bars might interfere with output)
2. Keep as-is but add explicit flushes
3. Move build summary to stderr (not recommended)

**Recommendation:** Keep current design but add flush after progress bar completes:

```typescript
// After progressBar.complete()
process.stderr.write(''); // Force flush
```

### Solution 3: Better Path Display in Tips

Instead of ugly relative paths (`../../../../../.bktide/...`), use one of:

**Option A: Assume cd into directory**
```
Next steps:
  $ cd ~/.bktide/snapshots/org/pipeline/123
  → List failures:   jq -r '.steps[] | select(.state == "failed")' manifest.json
```

**Option B: Use tilde paths**
```
Next steps:
  → List failures:   jq -r ... ~/.bktide/snapshots/org/pipeline/123/manifest.json
```

**Option C: Use absolute paths**
```
Next steps:
  → List failures:   jq -r ... /Users/user/.bktide/snapshots/org/pipeline/123/manifest.json
```

**Recommendation:** Option B (tilde paths) - familiar to users, not too verbose

## Testing Strategy

1. Add `BKTIDE_FORCE_INTERACTIVE` env var support
2. Update tests to use this flag
3. Add explicit test for tip output format
4. Verify tip ordering in integration tests

## Priority

- High: Add --force-interactive / env var (blocks testing)
- Medium: Fix path display (UX issue)
- Low: stdout/stderr ordering (may not be real issue)

## Resolution

**Date:** 2026-01-24

All issues have been addressed:

1. ✅ **Force Interactive Support**: Added `BKTIDE_FORCE_INTERACTIVE` env var to enable testing tips in non-TTY environments

2. ✅ **Path Display**: Updated `displayNavigationTips()` to use tilde paths instead of ugly relative paths
   - Before: `../../../../../.bktide/snapshots/...`
   - After: `~/.bktide/snapshots/...`

3. ✅ **Stream Ordering**: Added stderr flush after progress bar to prevent output interleaving

**Testing:**
```bash
# Force interactive mode for testing
BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot org/pipeline/123

# Normal usage in terminal
node dist/index.js snapshot org/pipeline/123
```

**See Also:**
- Implementation plan: `docs/plans/2026-01-24-snapshot-tips-display-fixes.md`
- Developer docs: `docs/developer/development.md`
