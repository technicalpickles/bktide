# Snapshot UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance snapshot command with better navigation (manifest v2), annotations support, and contextual tips.

**Architecture:** Update Snapshot command to: (1) capture annotations via REST API, (2) enhance manifest.json with full job metadata and annotations status, (3) display contextual post-command tips using Reporter, (4) add comprehensive README documentation.

**Tech Stack:** TypeScript, Node.js, Buildkite REST API, existing Reporter/theme infrastructure

---

## Task 1: Update Manifest Interfaces

**Files:**
- Modify: `src/commands/Snapshot.ts:19-38`

**Step 1: Update StepResult interface**

Add `job` field to store full job object:

```typescript
interface StepResult {
  id: string;
  jobId: string;
  status: 'success' | 'failed';
  job: any;  // Full job object from Buildkite API
  error?: string;
  message?: string;
  retryable?: boolean;
}
```

**Step 2: Update Manifest interface**

Replace existing Manifest interface with version 2 structure:

```typescript
interface Manifest {
  version: number;
  buildRef: string;
  url: string;
  fetchedAt: string;
  fetchComplete: boolean;  // Renamed from 'complete'
  build: {
    state: string;
    number: number;
    message: string;
    branch: string;
    commit: string;
  };
  annotations?: {
    fetchStatus: 'success' | 'none' | 'failed';
    count: number;
  };
  steps: Array<{
    // Our metadata
    id: string;
    fetchStatus: 'success' | 'failed';  // Renamed from 'status'

    // Buildkite job metadata (flat)
    jobId: string;
    type: string;
    name: string;
    label: string;
    state: string;
    exit_status: number | null;
    started_at: string | null;
    finished_at: string | null;
  }>;
  fetchErrors?: Array<{
    id: string;
    jobId: string;
    fetchStatus: 'failed';
    error: string;
    message: string;
    retryable: boolean;
  }>;
}
```

**Step 3: Add AnnotationResult interface**

```typescript
interface AnnotationResult {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
  error?: string;
  message?: string;
}
```

**Step 4: Add AnnotationsFile interface**

```typescript
interface AnnotationsFile {
  fetchedAt: string;
  count: number;
  annotations: any[];  // Raw annotations from Buildkite API
}
```

**Step 5: Compile to check for type errors**

Run: `npm run build`
Expected: May have errors in buildManifest() method - that's OK, we'll fix in next task

**Step 6: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "refactor: update Snapshot interfaces for manifest v2

- Add job field to StepResult
- Update Manifest with v2 structure (renamed fields, expanded build)
- Add AnnotationResult and AnnotationsFile interfaces

Part of snapshot UX improvements."
```

---

## Task 2: Add Annotations REST API Method

**Files:**
- Modify: `src/services/BuildkiteRestClient.ts`

**Step 1: Add getBuildAnnotations method**

Add after the `getJobLog` method (around line 200):

```typescript
/**
 * Get annotations for a build
 * @param org Organization slug
 * @param pipeline Pipeline slug
 * @param buildNumber Build number
 * @returns Array of annotations
 */
public async getBuildAnnotations(
  org: string,
  pipeline: string,
  buildNumber: number
): Promise<any[]> {
  const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/annotations`;

  if (this.debug) {
    logger.debug(`Fetching annotations for ${org}/${pipeline}/${buildNumber}`);
  }

  return this.get<any[]>(endpoint);
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/services/BuildkiteRestClient.ts
git commit -m "feat: add getBuildAnnotations REST API method

Adds support for fetching build annotations via REST API endpoint:
/v2/organizations/{org}/pipelines/{pipeline}/builds/{number}/annotations

Part of snapshot UX improvements."
```

---

## Task 3: Update fetchAndSaveStep to Include Job

**Files:**
- Modify: `src/commands/Snapshot.ts:261-306`

**Step 1: Update fetchAndSaveStep return values**

Find the success return statement (around line 286) and update:

```typescript
return {
  id: stepDirName,
  jobId: job.id,
  status: 'success',
  job: job,  // Add full job object
};
```

Find the error return statement (around line 299) and update:

```typescript
return {
  id: stepDirName,
  jobId: job.id,
  status: 'failed',
  job: job,  // Add full job object
  error: errorInfo.error,
  message: errorInfo.message,
  retryable: errorInfo.retryable,
};
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "refactor: include full job object in StepResult

Store complete job metadata in StepResult for use in manifest v2.

Part of snapshot UX improvements."
```

---

## Task 4: Add fetchAndSaveAnnotations Method

**Files:**
- Modify: `src/commands/Snapshot.ts`

**Step 1: Add fetchAndSaveAnnotations method**

Add after the `fetchAndSaveStep` method (around line 306):

```typescript
private async fetchAndSaveAnnotations(
  outputDir: string,
  org: string,
  pipeline: string,
  buildNumber: number,
  debug?: boolean
): Promise<AnnotationResult> {
  try {
    const annotations = await this.restClient.getBuildAnnotations(org, pipeline, buildNumber);

    if (debug) {
      logger.debug(`Fetched ${annotations.length} annotation(s)`);
    }

    // Save annotations.json
    const annotationsFile: AnnotationsFile = {
      fetchedAt: new Date().toISOString(),
      count: annotations.length,
      annotations: annotations,
    };

    const annotationsPath = path.join(outputDir, 'annotations.json');
    await fs.writeFile(annotationsPath, JSON.stringify(annotationsFile, null, 2), 'utf-8');

    // Return result
    if (annotations.length === 0) {
      return { fetchStatus: 'none', count: 0 };
    }

    return { fetchStatus: 'success', count: annotations.length };
  } catch (error) {
    if (debug) {
      logger.debug(`Failed to fetch annotations:`, error);
    }

    const errorInfo = categorizeError(error instanceof Error ? error : new Error(String(error)));
    return {
      fetchStatus: 'failed',
      count: 0,
      error: errorInfo.error,
      message: errorInfo.message,
    };
  }
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add fetchAndSaveAnnotations method

Fetches build annotations from REST API and saves to annotations.json.
Returns AnnotationResult with fetchStatus (success/none/failed).

Part of snapshot UX improvements."
```

---

## Task 5: Update buildManifest Method

**Files:**
- Modify: `src/commands/Snapshot.ts:308-328`

**Step 1: Update buildManifest signature**

Update method signature to accept annotationResult:

```typescript
private buildManifest(
  org: string,
  pipeline: string,
  buildNumber: number,
  build: any,
  stepResults: StepResult[],
  annotationResult: AnnotationResult
): Manifest {
```

**Step 2: Update buildManifest implementation**

Replace the entire method body:

```typescript
const allFetchesSucceeded = stepResults.every(s => s.status === 'success');
const fetchErrors = stepResults.filter(s => s.status === 'failed');

const manifest: Manifest = {
  version: 2,
  buildRef: `${org}/${pipeline}/${buildNumber}`,
  url: `https://buildkite.com/${org}/${pipeline}/builds/${buildNumber}`,
  fetchedAt: new Date().toISOString(),
  fetchComplete: allFetchesSucceeded && annotationResult.fetchStatus !== 'failed',
  build: {
    state: build.state || 'unknown',
    number: build.number,
    message: build.message?.split('\n')[0] || '',
    branch: build.branch || 'unknown',
    commit: build.commit?.substring(0, 7) || 'unknown',
  },
  annotations: {
    fetchStatus: annotationResult.fetchStatus,
    count: annotationResult.count,
  },
  steps: stepResults.map(result => ({
    // Our metadata
    id: result.id,
    fetchStatus: result.status,

    // Buildkite job metadata (flat structure)
    jobId: result.jobId,
    type: result.job.type || 'script',
    name: result.job.name || '',
    label: result.job.label || '',
    state: result.job.state || 'unknown',
    exit_status: result.job.exit_status ?? null,
    started_at: result.job.started_at || null,
    finished_at: result.job.finished_at || null,
  })),
};

// Only include fetchErrors if any exist
if (fetchErrors.length > 0) {
  manifest.fetchErrors = fetchErrors.map(err => ({
    id: err.id,
    jobId: err.jobId,
    fetchStatus: 'failed' as const,
    error: err.error!,
    message: err.message!,
    retryable: err.retryable!,
  }));
}

return manifest;
```

**Step 3: Compile to verify**

Run: `npm run build`
Expected: Errors in execute() method where buildManifest is called - that's OK, we'll fix next

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "refactor: update buildManifest for manifest v2

- Bump version to 2
- Rename complete → fetchComplete
- Expand build section with full metadata
- Add annotations section
- Include full job fields in steps array (flat structure)
- Conditionally add fetchErrors array

Part of snapshot UX improvements."
```

---

## Task 6: Update execute() to Fetch Annotations

**Files:**
- Modify: `src/commands/Snapshot.ts:107-244`

**Step 1: Add annotations fetch after saving build.json**

Find the comment `// 6. Filter and fetch jobs` (around line 147) and add before it:

```typescript
// 6. Fetch and save annotations
spinner.update('Fetching annotations…');
const annotationResult = await this.fetchAndSaveAnnotations(
  outputDir,
  buildRef.org,
  buildRef.pipeline,
  buildRef.number,
  options.debug
);
```

**Step 2: Update the comment**

Change `// 6. Filter and fetch jobs` to `// 7. Filter and fetch jobs`

**Step 3: Update buildManifest call**

Find the line `const manifest = this.buildManifest(...)` (around line 200) and update:

```typescript
const manifest = this.buildManifest(
  buildRef.org,
  buildRef.pipeline,
  buildRef.number,
  build,
  stepResults,
  annotationResult  // Add annotation result
);
```

**Step 4: Update output to show annotation count**

Find the output section after manifest is saved (around line 213) and update:

Replace:
```typescript
if (stepResults.length > 0) {
  logger.console(`  ${stepResults.length} step(s) captured`);
}
```

With:
```typescript
if (stepResults.length > 0) {
  logger.console(`  ${stepResults.length} step(s) captured`);
}

if (annotationResult.count > 0) {
  logger.console(`  ${annotationResult.count} annotation(s) captured`);
} else if (annotationResult.fetchStatus === 'none') {
  if (options.debug) {
    logger.console(`  No annotations present`);
  }
} else if (annotationResult.fetchStatus === 'failed') {
  logger.console(`  Warning: Failed to fetch annotations`);
}
```

**Step 5: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 6: Run tests**

Run: `npm test`
Expected: Tests may fail - that's OK, we'll update them later

**Step 7: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: integrate annotations into snapshot execution

- Fetch annotations after saving build.json
- Pass annotationResult to buildManifest
- Show annotation count in output

Part of snapshot UX improvements."
```

---

## Task 7: Add Reporter and Navigation Tips Infrastructure

**Files:**
- Modify: `src/commands/Snapshot.ts:1-106`

**Step 1: Add imports**

Add to the imports section at the top:

```typescript
import { Reporter } from '../ui/reporter.js';
import { TipStyle } from '../ui/theme.js';
```

**Step 2: Add reporter field to class**

Add after `static requiresToken = true;` (around line 105):

```typescript
private reporter: Reporter;
```

**Step 3: Add constructor**

Add after the class declaration:

```typescript
constructor(options?: Partial<SnapshotOptions>) {
  super(options);
  this.reporter = new Reporter(options?.format || 'plain', options?.quiet, options?.tips);
}
```

**Step 4: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add Reporter to Snapshot command

Initialize Reporter in constructor for contextual tips support.

Part of snapshot UX improvements."
```

---

## Task 8: Add getFirstFailedStepDir Helper

**Files:**
- Modify: `src/commands/Snapshot.ts`

**Step 1: Add helper method**

Add after the `isFailedJob` method (around line 350):

```typescript
/**
 * Get directory name of first failed step for concrete example in tips
 */
private getFirstFailedStepDir(scriptJobs: any[]): string | null {
  for (let i = 0; i < scriptJobs.length; i++) {
    const job = scriptJobs[i];
    if (this.isFailedJob(job)) {
      return getStepDirName(i, job.name || job.label || 'step');
    }
  }
  return null;
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add getFirstFailedStepDir helper

Helper to find first failed step directory name for concrete
examples in navigation tips.

Part of snapshot UX improvements."
```

---

## Task 9: Add displayNavigationTips Method

**Files:**
- Modify: `src/commands/Snapshot.ts`

**Step 1: Add displayNavigationTips method**

Add after the `getFirstFailedStepDir` method:

```typescript
/**
 * Display contextual navigation tips based on build state
 */
private displayNavigationTips(
  outputDir: string,
  build: any,
  scriptJobs: any[],
  capturedCount: number,
  annotationResult: AnnotationResult
): void {
  const buildState = build.state?.toLowerCase();
  const isFailed = buildState === 'failed' || buildState === 'failing';

  // Relative path for commands
  const relPath = path.relative(process.cwd(), outputDir);
  const manifestPath = path.join(relPath, 'manifest.json');
  const stepsPath = path.join(relPath, 'steps');
  const annotationsPath = path.join(relPath, 'annotations.json');

  logger.console(`  manifest.json has full build metadata and step index`);
  logger.console('');

  const tips: string[] = [];

  if (isFailed) {
    // Tips for failed builds
    tips.push(`List failures:   jq -r '.steps[] | select(.state == "failed") | "\\(.id): \\(.label)"' ${manifestPath}`);

    // Add annotation tip if annotations exist
    if (annotationResult.count > 0) {
      tips.push(`View annotations: jq -r '.annotations[] | {context, style}' ${annotationsPath}`);
    }

    tips.push(`Get exit codes:  jq -r '.steps[] | "\\(.id): exit \\(.exit_status)"' ${manifestPath}`);

    // If we captured steps, show how to view first failed log
    if (capturedCount > 0) {
      const firstFailedDir = this.getFirstFailedStepDir(scriptJobs);
      if (firstFailedDir) {
        tips.push(`View a log:      cat ${path.join(stepsPath, firstFailedDir, 'log.txt')}`);
      }
    }

    tips.push(`Search errors:   grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`);
  } else {
    // Tips for passed builds
    tips.push(`List all steps:  jq -r '.steps[] | "\\(.id): \\(.label) (\\(.state))"' ${manifestPath}`);
    tips.push(`Browse logs:     ls ${stepsPath}/`);

    if (capturedCount > 0) {
      tips.push(`View a log:      cat ${stepsPath}/01-*/log.txt`);
    }
  }

  // Use ACTIONS style for "Next steps:" formatting
  this.reporter.tips(tips, TipStyle.ACTIONS);
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add displayNavigationTips method

Show contextual post-command tips based on build state:
- Failed builds: show how to find failures, annotations, errors
- Passed builds: show how to explore steps and logs
- Uses Reporter with TipStyle.ACTIONS
- Includes annotation tips when present

Part of snapshot UX improvements."
```

---

## Task 10: Integrate Tips into execute()

**Files:**
- Modify: `src/commands/Snapshot.ts:107-244`

**Step 1: Add tips display**

Find the output section after the `--all` tip (around line 231) and add:

```typescript
logger.console('');

// Show contextual navigation tips (check if tips are enabled)
if (this.options.tips !== false) {
  this.displayNavigationTips(outputDir, build, scriptJobs, stepResults.length, annotationResult);
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Test manually**

Run: `npm run build && node dist/index.js snapshot --help`
Expected: Shows help output

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: integrate navigation tips into snapshot output

Call displayNavigationTips after snapshot completes if tips are enabled.
Respects --tips/--no-tips flags.

Part of snapshot UX improvements."
```

---

## Task 11: Update Snapshot Tests for Manifest v2

**Files:**
- Modify: `test/commands/Snapshot.test.ts`

**Step 1: Read existing test file**

Read: `test/commands/Snapshot.test.ts`
Purpose: Understand current test structure

**Step 2: Update manifest assertions**

Find tests that check manifest structure and update them for v2:
- Version should be 2
- Check for `fetchComplete` instead of `complete`
- Check for expanded `build` section
- Check for `annotations` section
- Steps should have `fetchStatus` instead of `status`
- Steps should include job fields (type, name, label, state, exit_status, etc.)

**Step 3: Add annotation tests**

Add tests for:
- Annotations with count > 0 (fetchStatus: 'success')
- No annotations (fetchStatus: 'none', count: 0)
- Annotations fetch failure (fetchStatus: 'failed')

**Step 4: Run tests**

Run: `npm test test/commands/Snapshot.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add test/commands/Snapshot.test.ts
git commit -m "test: update Snapshot tests for manifest v2

- Update manifest version check to 2
- Check renamed fields (fetchComplete, fetchStatus)
- Verify expanded build section
- Verify annotations section
- Add annotation-specific test cases

Part of snapshot UX improvements."
```

---

## Task 12: Add README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Find insertion point**

Search for "Visual Features" section (around line 305)
Find the end of that section (before "Global Options")

**Step 2: Add Snapshot section**

Insert the following after the Visual Features section:

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
- **annotations.json** - Test failures, warnings, and structured information from annotations
- **steps/NN-name/log.txt** - Full logs for each step
- **steps/NN-name/step.json** - Step metadata (state, exit code, timing)

### Common Use Cases

**Find what failed:**
```bash
cd ~/.bktide/snapshots/org/pipeline/123
jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' manifest.json
```

**View test failure summaries:**
```bash
jq -r '.annotations[] | select(.style == "error") | "\(.context): \(.body.html)"' annotations.json
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

**Step 3: Compile to verify README renders**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Snapshot section to README

Add comprehensive snapshot documentation:
- Positioned after Visual Features as deep debugging tool
- Command examples with URL and slug formats
- Output structure explanation including annotations
- Five concrete use cases with actual commands
- AI agent integration example

Part of snapshot UX improvements."
```

---

## Task 13: Manual Testing

**Files:**
- N/A (manual testing)

**Step 1: Build the project**

Run: `npm run build`
Expected: SUCCESS with no errors

**Step 2: Test snapshot with failed build**

Run: `node dist/index.js snapshot [org/pipeline/failed-build-number]`
Expected:
- Snapshot created
- manifest.json shows version 2
- annotations.json exists (if build has annotations)
- Tips displayed showing how to navigate

**Step 3: Test snapshot with passed build**

Run: `node dist/index.js snapshot [org/pipeline/passed-build-number] --all`
Expected:
- Snapshot created with all steps
- Different tips shown for passed build

**Step 4: Test with --no-tips**

Run: `node dist/index.js snapshot [org/pipeline/build-number] --no-tips`
Expected: No tips displayed

**Step 5: Verify manifest structure**

Run: `cat ~/.bktide/snapshots/[org]/[pipeline]/[number]/manifest.json | jq .`
Expected:
- version: 2
- fetchComplete: boolean
- build: {state, number, message, branch, commit}
- annotations: {fetchStatus, count}
- steps: array with full job fields
- fetchErrors: array (if any fetches failed)

**Step 6: Verify annotations file**

Run: `cat ~/.bktide/snapshots/[org]/[pipeline]/[number]/annotations.json | jq .`
Expected:
- fetchedAt: ISO timestamp
- count: number
- annotations: array of annotation objects

**Step 7: Document test results**

Create note: All manual tests passed ✓

---

## Task 14: Run Full Test Suite

**Files:**
- N/A (testing)

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run lint checks**

Run: `npm run lint` (if available)
Expected: No lint errors

**Step 3: Check test coverage**

Run: `npm run test:coverage` (if available)
Expected: Coverage maintained or improved

**Step 4: Commit if any test fixes needed**

```bash
git add test/
git commit -m "test: fix any remaining test issues

Ensure all tests pass with snapshot UX improvements."
```

---

## Task 15: Final Review and Cleanup

**Files:**
- Review all changed files

**Step 1: Review all changes**

Run: `git diff main`
Review: Ensure all changes align with design document

**Step 2: Check for console.log or debug statements**

Run: `grep -r "console.log" src/commands/Snapshot.ts`
Expected: None found (should use logger.debug instead)

**Step 3: Check for TODO comments**

Run: `grep -r "TODO" src/commands/Snapshot.ts`
Expected: None found or documented in issues

**Step 4: Verify commit messages**

Run: `git log --oneline main..HEAD`
Expected: Clear, descriptive commit messages following conventional commits

**Step 5: Final commit if needed**

```bash
git add .
git commit -m "chore: final cleanup for snapshot UX improvements"
```

---

## Summary

This plan implements snapshot UX improvements in 15 tasks:

1. **Tasks 1-6**: Core functionality (manifest v2, annotations support)
2. **Tasks 7-10**: Navigation tips infrastructure
3. **Task 11**: Update tests
4. **Task 12**: Add README documentation
5. **Tasks 13-15**: Testing and review

**Key architectural decisions:**
- Use REST API for annotations (not GraphQL) for consistency
- Manifest v2 combines UX improvements and annotations
- Reporter handles tips display (respects flags)
- Contextual tips based on build state

**Testing strategy:**
- Update existing tests for manifest v2
- Add annotation-specific tests
- Manual testing for end-to-end verification
- Full test suite before completion

**Documentation:**
- README section positioned as deep debugging tool
- Concrete use cases with actual commands
- AI agent integration example
