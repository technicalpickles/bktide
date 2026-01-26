# Snapshot Tips Display Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix snapshot navigation tips display issues: enable testing with force-interactive flag and improve path formatting.

**Architecture:** Add BKTIDE_FORCE_INTERACTIVE env var support to Reporter's isInteractive() check, and update displayNavigationTips() to use tilde paths (~) instead of ugly relative paths.

**Tech Stack:** TypeScript, Node.js, existing Reporter infrastructure

---

## Task 1: Add Force Interactive Support to Reporter

**Files:**
- Modify: `src/ui/reporter.ts:9-12`

**Step 1: Update isInteractive function**

Find the `isInteractive()` function (around line 9) and replace:

```typescript
function isInteractive(): boolean {
  // Only show decorative messages when stdout is a TTY (not piped/redirected)
  return Boolean(process.stdout.isTTY);
}
```

With:

```typescript
function isInteractive(): boolean {
  // Check for forced interactive mode first (for testing)
  if (process.env.BKTIDE_FORCE_INTERACTIVE === '1') {
    return true;
  }

  // Only show decorative messages when stdout is a TTY (not piped/redirected)
  return Boolean(process.stdout.isTTY);
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Test with environment variable**

Run: `BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050`
Expected: Tips should appear at the end (may still have path issues, we'll fix next)

**Step 4: Commit**

```bash
git add src/ui/reporter.ts
git commit -m "feat: add BKTIDE_FORCE_INTERACTIVE env var for testing

Allows forcing interactive mode when process.stdout.isTTY is undefined.
Useful for testing tips output through npm scripts and build tools.

Usage: BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot ...

Part of snapshot tips display fixes."
```

---

## Task 2: Add Tilde Path Helper Function

**Files:**
- Modify: `src/commands/Snapshot.ts`

**Step 1: Add helper function**

Add after the `getStepDirName` function (around line 102):

```typescript
/**
 * Convert absolute path to use tilde (~) for home directory
 * Makes paths more readable and portable
 */
function pathWithTilde(absolutePath: string): string {
  const homeDir = os.homedir();
  if (absolutePath.startsWith(homeDir)) {
    return absolutePath.replace(homeDir, '~');
  }
  return absolutePath;
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add pathWithTilde helper for readable paths

Converts absolute paths to use tilde (~) for home directory.
Improves readability of paths in navigation tips.

Part of snapshot tips display fixes."
```

---

## Task 3: Update displayNavigationTips to Use Tilde Paths

**Files:**
- Modify: `src/commands/Snapshot.ts:557-610`

**Step 1: Update path variables in displayNavigationTips**

Find the path variable assignments (around line 568) and replace:

```typescript
// Relative path for commands
const relPath = path.relative(process.cwd(), outputDir);
const manifestPath = path.join(relPath, 'manifest.json');
const stepsPath = path.join(relPath, 'steps');
const annotationsPath = path.join(relPath, 'annotations.json');
```

With:

```typescript
// Use tilde paths for readability
const basePath = pathWithTilde(outputDir);
const manifestPath = path.join(basePath, 'manifest.json');
const stepsPath = path.join(basePath, 'steps');
const annotationsPath = path.join(basePath, 'annotations.json');
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Test manually**

Run: `BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050`
Expected: Tips should show paths like `~/.bktide/snapshots/org/pipeline/123/manifest.json`

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: use tilde paths in snapshot navigation tips

Replace ugly relative paths (../../../../../.bktide/...) with
readable tilde paths (~/.bktide/snapshots/...).

Before: ../../../../../.bktide/snapshots/org/pipeline/123/manifest.json
After:  ~/.bktide/snapshots/org/pipeline/123/manifest.json

Part of snapshot tips display fixes."
```

---

## Task 4: Add Stream Flush After Progress Bar

**Files:**
- Modify: `src/commands/Snapshot.ts:267-268`

**Step 1: Add stderr flush after progress bar completes**

Find the `progressBar.complete()` call (around line 267) and add after it:

```typescript
progressBar.complete(`Fetched ${totalJobs} step${totalJobs > 1 ? 's' : ''}`);

// Force stderr flush to prevent output interleaving
if (process.stderr.write) {
  process.stderr.write('');
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Test manually**

Run: `BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050`
Expected: Output order should be consistent (progress bar, then build summary, then tips)

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: flush stderr after progress bar to prevent interleaving

Force stderr flush after progress bar completes to ensure
consistent output ordering between stderr (progress) and
stdout (build summary, tips).

Part of snapshot tips display fixes."
```

---

## Task 5: Add Documentation for Force Interactive Flag

**Files:**
- Modify: `docs/developer/development.md` (or create if doesn't exist)

**Step 1: Add testing section**

Add or update a "Testing Tips Output" section:

```markdown
## Testing Tips Output

Tips are shown when stdout is a TTY (interactive terminal). When running through npm scripts or build tools, stdout may not be detected as a TTY, causing tips to be suppressed.

### Force Interactive Mode

Use the `BKTIDE_FORCE_INTERACTIVE` environment variable to force interactive mode for testing:

```bash
# Test snapshot tips
BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot org/pipeline/123

# Test other commands with tips
BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- builds --tips
```

### Testing in CI

In CI environments, tips are automatically suppressed because stdout is not a TTY. To test tip logic in CI:

1. Set `BKTIDE_FORCE_INTERACTIVE=1` in your CI environment
2. Capture stdout and assert expected tip content
3. Verify tips respect `--no-tips` flag even when forced interactive

### Implementation Details

The `isInteractive()` function in `src/ui/reporter.ts` checks:
1. `BKTIDE_FORCE_INTERACTIVE` environment variable (highest priority)
2. `process.stdout.isTTY` (standard TTY detection)
3. Returns false if neither condition is met
```

**Step 2: Commit**

```bash
git add docs/developer/development.md
git commit -m "docs: add documentation for BKTIDE_FORCE_INTERACTIVE flag

Document how to test tips output in non-TTY environments
using the BKTIDE_FORCE_INTERACTIVE env var.

Part of snapshot tips display fixes."
```

---

## Task 6: Update README with Note About Paths

**Files:**
- Modify: `README.md`

**Step 1: Update Common Use Cases section**

Find the "Find what failed:" example in the Snapshot section and update the intro text:

Replace:
```markdown
**Find what failed:**
```bash
cd ~/.bktide/snapshots/org/pipeline/123
jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' manifest.json
```
```

With:
```markdown
**Find what failed:**

All commands use tilde paths (`~/.bktide/...`) and can be run from any directory:

```bash
jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' ~/.bktide/snapshots/org/pipeline/123/manifest.json
```

Or navigate to the snapshot directory first:

```bash
cd ~/.bktide/snapshots/org/pipeline/123
jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' manifest.json
```
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: clarify snapshot path usage in README

Explain that commands use tilde paths and work from any directory,
or users can cd into snapshot directory for shorter commands.

Part of snapshot tips display fixes."
```

---

## Task 7: Manual End-to-End Testing

**Files:**
- N/A (manual testing)

**Step 1: Build the project**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 2: Test with force interactive flag**

Run: `BKTIDE_FORCE_INTERACTIVE=1 npm run dev -- snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050`
Expected:
- Tips appear at the end after "manifest.json has full build metadata"
- Paths use tilde format: `~/.bktide/snapshots/...`
- "Next steps:" header is visible
- 5 tips shown for failed build

**Step 3: Test without force interactive**

Run: `npm run dev -- snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050`
Expected:
- Tips suppressed (no "Next steps:" section)
- Rest of output works normally

**Step 4: Test in real terminal (direct node)**

Run: `node dist/index.js snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050`
Expected:
- Tips appear (real TTY detected)
- Paths use tilde format
- Output order is correct

**Step 5: Test with --no-tips flag**

Run: `node dist/index.js snapshot https://buildkite.com/gusto/zenpayroll/builds/1407050 --no-tips`
Expected:
- No tips shown even in real terminal
- Rest of output works normally

**Step 6: Test with passed build and --all**

Run: `BKTIDE_FORCE_INTERACTIVE=1 node dist/index.js snapshot [org/pipeline/passed-build] --all`
Expected:
- Different tips shown for passed build
- Browse logs, list all steps tips
- No "List failures" tip

**Step 7: Verify path readability**

Check: Tips should show `~/.bktide/snapshots/org/pipeline/123/manifest.json`
Not: `../../../../../.bktide/snapshots/org/pipeline/123/manifest.json`

**Step 8: Document test results**

Create note: All manual tests passed ✓

---

## Task 8: Run Full Test Suite

**Files:**
- N/A (testing)

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Check for any test failures**

If tests fail related to Reporter or tips:
- Update test to use `BKTIDE_FORCE_INTERACTIVE=1` if testing tip output
- Ensure tests don't accidentally depend on TTY detection

**Step 3: Run lint checks**

Run: `npm run lint` (if available)
Expected: No lint errors

**Step 4: Commit any test fixes**

```bash
git add test/
git commit -m "test: update tests for force interactive support

Ensure tests work with new BKTIDE_FORCE_INTERACTIVE env var.

Part of snapshot tips display fixes."
```

---

## Task 9: Final Review and Documentation Update

**Files:**
- Review: `docs/developer/feedback.md`

**Step 1: Update feedback document status**

Add a "Resolution" section to `docs/developer/feedback.md`:

```markdown
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
```

**Step 2: Commit**

```bash
git add docs/developer/feedback.md
git commit -m "docs: mark snapshot tips issues as resolved

Document resolution of all three issues:
- Force interactive support added
- Path display improved with tilde paths
- Stream ordering fixed with flush

Part of snapshot tips display fixes."
```

---

## Summary

This plan fixes snapshot tips display issues in 9 tasks:

1. **Task 1**: Add `BKTIDE_FORCE_INTERACTIVE` env var support
2. **Task 2**: Add `pathWithTilde()` helper function
3. **Task 3**: Update tips to use tilde paths
4. **Task 4**: Add stderr flush for output ordering
5. **Task 5**: Document force interactive flag
6. **Task 6**: Update README with path clarification
7. **Task 7**: Manual end-to-end testing
8. **Task 8**: Run full test suite
9. **Task 9**: Update documentation with resolution

**Key improvements:**
- Tips work in test environments with `BKTIDE_FORCE_INTERACTIVE=1`
- Paths are readable: `~/.bktide/...` instead of `../../../../../.bktide/...`
- Output ordering is consistent with stderr flush
- Well documented for future developers and testing

**Testing verification:**
- Force interactive mode enables tips in npm scripts
- Tilde paths are readable and portable
- Output order is consistent (progress → summary → tips)
- Tips respect `--no-tips` flag even when forced interactive
