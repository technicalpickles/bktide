# Snapshot UX Improvements - Iteration 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish snapshot command output and add incremental fetching to avoid re-downloading unchanged data.

**Architecture:** Update npm dev script with visual delimiter, refactor Snapshot output formatting for better spacing/tip placement, change default location to `./tmp/bktide/snapshots/`, add change detection comparing build/job/annotation state against existing manifest, implement selective re-fetching for only changed components, migrate annotations from REST to GraphQL.

**Tech Stack:** TypeScript, Node.js, GraphQL (graphql-request), Vitest

---

## Task 1: Add Visual Delimiter to build-and-run.js

**Files:**
- Modify: `build-and-run.js:67-71`

**Step 1: Update the console output before running**

Find lines 67-68 and replace:

```javascript
console.log(`🚀 Running ${entryPoint} with source maps enabled...`);
console.log(`Command-line arguments: ${cliArgs.join(' ')}`);
```

With:

```javascript
if (cliArgs.length > 0) {
  console.log(`🚀 Running: ${entryPoint} ${cliArgs.join(' ')}`);
} else {
  console.log(`🚀 Running: ${entryPoint}`);
}
console.log('────────────────────────── bktide output ──────────────────────────');
```

**Step 2: Verify manually**

Run: `npm run dev -- --help`
Expected: See delimiter line before actual bktide output

**Step 3: Commit**

```bash
git add build-and-run.js
git commit -m "chore: add visual delimiter to npm run dev output

Adds a separator line before actual command output to distinguish
build script messages from bktide output.

Part of snapshot UX iteration 2."
```

---

## Task 2: Add Section Spacing in Snapshot Output

**Files:**
- Modify: `src/commands/Snapshot.ts:295-301`

**Step 1: Add blank line before "Snapshot saved"**

Find line 295-301 in execute():

```typescript
// Then show snapshot info
const fetchErrorCount = stepResults.filter(s => s.status === 'failed').length;

logger.console(`Snapshot saved to ${outputDir}`);
```

Replace with:

```typescript
// Then show snapshot info
const fetchErrorCount = stepResults.filter(s => s.status === 'failed').length;

logger.console('');  // Blank line between build summary and snapshot info
logger.console(`Snapshot saved to ${pathWithTilde(outputDir)}`);
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: add spacing between build summary and snapshot info

Adds blank line to visually separate build summary from snapshot
details for better readability.

Part of snapshot UX iteration 2."
```

---

## Task 3: Relocate "Passing Steps Skipped" Tip

**Files:**
- Modify: `src/commands/Snapshot.ts:326-329`
- Modify: `src/commands/Snapshot.ts:567-617`

**Step 1: Remove inline tip from execute()**

Find lines 326-329:

```typescript
// Show tip about --all if we filtered to failed only and there are passing steps
if (!fetchAll && scriptJobs.length > jobsToFetch.length) {
  const skippedCount = scriptJobs.length - jobsToFetch.length;
  logger.console(`  Tip: ${skippedCount} passing step(s) skipped. Use --all to capture all logs.`);
}
```

Replace with:

```typescript
// Track skipped count for tips section
const skippedCount = !fetchAll ? scriptJobs.length - jobsToFetch.length : 0;
```

**Step 2: Update displayNavigationTips signature**

Find line 567:

```typescript
private displayNavigationTips(
  outputDir: string,
  build: any,
  scriptJobs: any[],
  capturedCount: number,
  annotationResult: AnnotationResult
): void {
```

Replace with:

```typescript
private displayNavigationTips(
  outputDir: string,
  build: any,
  scriptJobs: any[],
  capturedCount: number,
  annotationResult: AnnotationResult,
  skippedCount: number
): void {
```

**Step 3: Add skipped tip to displayNavigationTips**

Find line 606 (before the closing of the if/else for isFailed):

```typescript
    logger.console(`  → Search errors:   grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`);
  } else {
```

Replace with:

```typescript
    logger.console(`  → Search errors:   grep -r "Error\\|Failed\\|Exception" ${stepsPath}/`);

    // Show --all tip if steps were skipped
    if (skippedCount > 0) {
      logger.console(`  → Use --all to include all ${skippedCount} passing steps`);
    }
  } else {
```

**Step 4: Also add to passed builds section**

Find around line 613:

```typescript
    if (capturedCount > 0) {
      logger.console(`  → View a log:      cat ${stepsPath}/01-*/log.txt`);
    }
  }
```

Replace with:

```typescript
    if (capturedCount > 0) {
      logger.console(`  → View a log:      cat ${stepsPath}/01-*/log.txt`);
    }

    // Show --all tip if steps were skipped (for passed builds using default filter)
    if (skippedCount > 0) {
      logger.console(`  → Use --all to include all ${skippedCount} passing steps`);
    }
  }
```

**Step 5: Update the call site**

Find line 335:

```typescript
this.displayNavigationTips(outputDir, build, scriptJobs, stepResults.length, annotationResult);
```

Replace with:

```typescript
this.displayNavigationTips(outputDir, build, scriptJobs, stepResults.length, annotationResult, skippedCount);
```

**Step 6: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 7: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "refactor: move skipped steps tip to Next Steps section

Relocates 'X passing steps skipped' from inline output to the
Next Steps section as actionable guidance.

Part of snapshot UX iteration 2."
```

---

## Task 4: Format manifest.json Line Consistently

**Files:**
- Modify: `src/commands/Snapshot.ts:617-618`

**Step 1: Move manifest.json line to be a tip**

Find lines 617-618:

```typescript
  logger.console(`  → Use --no-tips to hide these hints`);
  logger.console(`  manifest.json has full build metadata and step index`);
}
```

Replace with:

```typescript
  logger.console(`  → Use --no-tips to hide these hints`);
  logger.console('');
  logger.console(SEMANTIC_COLORS.dim(`manifest.json has full build metadata and step index`));
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: format manifest.json line consistently

Moves manifest.json info line outside tips list and dims it
to indicate it's supplementary information.

Part of snapshot UX iteration 2."
```

---

## Task 5: Change Default Snapshot Location

**Files:**
- Modify: `src/commands/Snapshot.ts:351-354`

**Step 1: Update getOutputDir default**

Find lines 351-354:

```typescript
private getOutputDir(options: SnapshotOptions, org: string, pipeline: string, buildNumber: number): string {
  const baseDir = options.outputDir || path.join(os.homedir(), '.bktide', 'snapshots');
  return path.join(baseDir, org, pipeline, String(buildNumber));
}
```

Replace with:

```typescript
private getOutputDir(options: SnapshotOptions, org: string, pipeline: string, buildNumber: number): string {
  const baseDir = options.outputDir || path.join(process.cwd(), 'tmp', 'bktide', 'snapshots');
  return path.join(baseDir, org, pipeline, String(buildNumber));
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: change default snapshot location to ./tmp/bktide/snapshots/

Changes default from ~/.bktide/snapshots/ to a local temp directory
relative to cwd for better CI agent compatibility.

Users should add ./tmp/ to .gitignore.

Part of snapshot UX iteration 2."
```

---

## Task 6: Add --force Flag to SnapshotOptions

**Files:**
- Modify: `src/commands/Snapshot.ts:11-17`
- Modify: `src/index.ts` (find snapshot command registration)

**Step 1: Add force to SnapshotOptions interface**

Find lines 11-17:

```typescript
export interface SnapshotOptions extends BaseCommandOptions {
  buildRef?: string;
  outputDir?: string;
  json?: boolean;
  failed?: boolean;
  all?: boolean;
}
```

Replace with:

```typescript
export interface SnapshotOptions extends BaseCommandOptions {
  buildRef?: string;
  outputDir?: string;
  json?: boolean;
  failed?: boolean;
  all?: boolean;
  force?: boolean;
}
```

**Step 2: Find and update command registration in src/index.ts**

Search for `snapshot` command registration and add the --force option.

Find the snapshot command block and add after other options:

```typescript
.option('--force', 'Force full re-fetch, bypassing change detection')
```

**Step 3: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Verify --help shows new flag**

Run: `npm run dev -- snapshot --help`
Expected: Shows --force option in help

**Step 5: Commit**

```bash
git add src/commands/Snapshot.ts src/index.ts
git commit -m "feat: add --force flag to snapshot command

Adds flag to bypass change detection and force full re-fetch.
Implementation of change detection to follow.

Part of snapshot UX iteration 2."
```

---

## Task 7: Add Manifest Loading Helper

**Files:**
- Modify: `src/commands/Snapshot.ts` (add after saveManifest method around line 523)

**Step 1: Add loadExistingManifest method**

Add after the `saveManifest` method:

```typescript
/**
 * Load existing manifest if present
 * Returns null if no manifest exists or parsing fails
 */
private async loadExistingManifest(outputDir: string): Promise<Manifest | null> {
  const manifestPath = path.join(outputDir, 'manifest.json');
  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as Manifest;
    // Validate it's a v2 manifest
    if (manifest.version !== 2) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add loadExistingManifest helper method

Loads and validates existing manifest.json for change detection.
Returns null if not found or invalid format.

Part of snapshot UX iteration 2."
```

---

## Task 8: Add Build State Types for Incremental Checking

**Files:**
- Modify: `src/commands/Snapshot.ts` (add after AnnotationsFile interface around line 82)

**Step 1: Add change detection types**

Add after the `AnnotationsFile` interface:

```typescript
interface BuildChangeResult {
  hasChanges: boolean;
  reason?: 'build_running' | 'build_finished_changed' | 'no_existing_manifest' | 'force_refresh';
  jobsToRefetch?: string[];  // Job IDs that need re-fetching
  annotationsChanged?: boolean;
}

const TERMINAL_BUILD_STATES = ['PASSED', 'FAILED', 'CANCELED', 'BLOCKED', 'NOT_RUN'];
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add BuildChangeResult type for change detection

Defines structure for tracking what needs to be re-fetched
during incremental snapshot updates.

Part of snapshot UX iteration 2."
```

---

## Task 9: Add Change Detection Method

**Files:**
- Modify: `src/commands/Snapshot.ts` (add after loadExistingManifest method)

**Step 1: Add detectChanges method**

Add after `loadExistingManifest`:

```typescript
/**
 * Detect what has changed since last snapshot
 * Compares current build state against stored manifest
 */
private detectChanges(
  currentBuild: any,
  currentJobs: any[],
  existingManifest: Manifest | null,
  force: boolean
): BuildChangeResult {
  // Force refresh requested
  if (force) {
    return { hasChanges: true, reason: 'force_refresh' };
  }

  // No existing manifest - full fetch needed
  if (!existingManifest) {
    return { hasChanges: true, reason: 'no_existing_manifest' };
  }

  const currentState = currentBuild.state?.toUpperCase();
  const storedState = existingManifest.build.state?.toUpperCase();

  // Build still running - always re-fetch
  if (!TERMINAL_BUILD_STATES.includes(currentState)) {
    return { hasChanges: true, reason: 'build_running' };
  }

  // Check if build finished at different time (rebuild scenario)
  const currentFinishedAt = currentBuild.finishedAt;
  // Note: we need to store finishedAt in manifest - will add in next task

  // Compare job states
  const jobsToRefetch: string[] = [];
  const storedJobMap = new Map(
    existingManifest.steps.map(s => [s.jobId, s])
  );

  for (const jobEdge of currentJobs) {
    const job = jobEdge.node;
    if (job.__typename !== 'JobTypeCommand' && job.__typename) continue;

    const storedJob = storedJobMap.get(job.id);

    // New job - needs fetch
    if (!storedJob) {
      jobsToRefetch.push(job.id);
      continue;
    }

    // Job state changed
    if (job.state !== storedJob.state) {
      jobsToRefetch.push(job.id);
      continue;
    }

    // Job finished at different time
    if (job.finishedAt !== storedJob.finished_at) {
      jobsToRefetch.push(job.id);
    }
  }

  // If any jobs need re-fetching, there are changes
  if (jobsToRefetch.length > 0) {
    return {
      hasChanges: true,
      reason: 'build_finished_changed',
      jobsToRefetch,
    };
  }

  // No changes detected
  return { hasChanges: false };
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add detectChanges method for incremental fetching

Compares current build/job state against stored manifest to
determine what needs re-fetching. Handles:
- Force refresh flag
- No existing manifest
- Build still running
- Individual job state changes

Part of snapshot UX iteration 2."
```

---

## Task 10: Add finishedAt to Manifest Build Section

**Files:**
- Modify: `src/commands/Snapshot.ts:35-41` (Manifest interface)
- Modify: `src/commands/Snapshot.ts:477-483` (buildManifest method)

**Step 1: Update Manifest interface**

Find lines 35-41:

```typescript
build: {
  state: string;
  number: number;
  message: string;
  branch: string;
  commit: string;
};
```

Replace with:

```typescript
build: {
  state: string;
  number: number;
  message: string;
  branch: string;
  commit: string;
  finishedAt: string | null;
};
```

**Step 2: Update buildManifest method**

Find lines 477-483:

```typescript
build: {
  state: build.state || 'unknown',
  number: build.number,
  message: build.message?.split('\n')[0] || '',
  branch: build.branch || 'unknown',
  commit: build.commit?.substring(0, 7) || 'unknown',
},
```

Replace with:

```typescript
build: {
  state: build.state || 'unknown',
  number: build.number,
  message: build.message?.split('\n')[0] || '',
  branch: build.branch || 'unknown',
  commit: build.commit?.substring(0, 7) || 'unknown',
  finishedAt: build.finishedAt || null,
},
```

**Step 3: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add finishedAt to manifest build section

Stores build completion timestamp for change detection.
Used to detect rebuild scenarios where same build number
gets a new finishedAt value.

Part of snapshot UX iteration 2."
```

---

## Task 11: Integrate Change Detection into execute()

**Files:**
- Modify: `src/commands/Snapshot.ts:163-340` (execute method)

**Step 1: Add change detection after fetching build data**

Find around line 202-204:

```typescript
const build = buildData.build;
const jobs = build.jobs?.edges || [];

// 4. Create directory structure
```

Replace with:

```typescript
const build = buildData.build;
const jobs = build.jobs?.edges || [];

// 4. Check for existing snapshot and detect changes
const existingManifest = await this.loadExistingManifest(outputDir);
const changeResult = this.detectChanges(build, jobs, existingManifest, options.force === true);

if (!changeResult.hasChanges) {
  spinner.stop();
  logger.console(`Snapshot already up to date: ${pathWithTilde(outputDir)}`);
  logger.console('');

  // Still show navigation tips
  const scriptJobs = jobs
    .map((edge: any) => edge.node)
    .filter((job: any) => job.__typename === 'JobTypeCommand' || !job.__typename);

  if (this.options.tips !== false && existingManifest) {
    const annotationResult: AnnotationResult = existingManifest.annotations || { fetchStatus: 'none', count: 0 };
    this.displayNavigationTips(outputDir, build, scriptJobs, existingManifest.steps.length, annotationResult, 0);
  }
  return 0;
}

if (options.debug && changeResult.reason) {
  logger.debug(`Change detected: ${changeResult.reason}`);
  if (changeResult.jobsToRefetch) {
    logger.debug(`Jobs to refetch: ${changeResult.jobsToRefetch.length}`);
  }
}

// 5. Create directory structure
```

**Step 2: Update comment numbers**

Update subsequent comments:
- `// 4. Create directory structure` → `// 5. Create directory structure`
- `// 5. Save build.json` → `// 6. Save build.json`
- `// 6. Fetch and save annotations` → `// 7. Fetch and save annotations`
- `// 7. Filter and fetch jobs` → `// 8. Filter and fetch jobs`
- `// 8. Write manifest` → `// 9. Write manifest`
- `// 9. Output based on options` → `// 10. Output based on options`

**Step 3: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: integrate change detection into snapshot execute

Checks for existing manifest and compares build state before
fetching. Shows 'already up to date' message with tips when
no changes detected. Full re-fetch when:
- --force flag used
- No existing manifest
- Build still running
- Build finishedAt changed

Part of snapshot UX iteration 2."
```

---

## Task 12: Add GraphQL Query for Annotation Timestamps

**Files:**
- Modify: `src/graphql/queries.ts`

**Step 1: Add lightweight annotation check query**

Find the queries file and add a new query for fetching just annotation timestamps:

```typescript
export const GET_BUILD_ANNOTATION_TIMESTAMPS = gql`
  query GetBuildAnnotationTimestamps($slug: ID!) {
    build(slug: $slug) {
      annotations(first: 100) {
        edges {
          node {
            uuid
            updatedAt
            createdAt
          }
        }
      }
    }
  }
`;
```

**Step 2: Add full annotation fetch query**

```typescript
export const GET_BUILD_ANNOTATIONS_FULL = gql`
  query GetBuildAnnotationsFull($slug: ID!) {
    build(slug: $slug) {
      annotations(first: 100) {
        edges {
          node {
            uuid
            context
            style
            body {
              html
              text
            }
            createdAt
            updatedAt
          }
        }
      }
    }
  }
`;
```

**Step 3: Run codegen**

Run: `npm run codegen`
Expected: SUCCESS - generates types

**Step 4: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add src/graphql/queries.ts src/graphql/generated/
git commit -m "feat: add GraphQL queries for annotation fetching

Adds two queries:
- GET_BUILD_ANNOTATION_TIMESTAMPS: lightweight check for change detection
- GET_BUILD_ANNOTATIONS_FULL: full annotation data when changes detected

Migrates annotations from REST to GraphQL for selective field fetching.

Part of snapshot UX iteration 2."
```

---

## Task 13: Add GraphQL Annotation Methods to BuildkiteClient

**Files:**
- Modify: `src/services/BuildkiteClient.ts`

**Step 1: Add getAnnotationTimestamps method**

Add to BuildkiteClient class:

```typescript
/**
 * Get annotation timestamps for change detection (lightweight)
 */
public async getAnnotationTimestamps(buildSlug: string): Promise<Array<{ uuid: string; updatedAt: string | null; createdAt: string }>> {
  const data = await this.client.request(GET_BUILD_ANNOTATION_TIMESTAMPS, { slug: buildSlug });
  return (data.build?.annotations?.edges || []).map((edge: any) => edge.node);
}

/**
 * Get full annotation data
 */
public async getAnnotationsFull(buildSlug: string): Promise<any[]> {
  const data = await this.client.request(GET_BUILD_ANNOTATIONS_FULL, { slug: buildSlug });
  return (data.build?.annotations?.edges || []).map((edge: any) => edge.node);
}
```

**Step 2: Import the queries at top of file**

Add to imports:

```typescript
import { GET_BUILD_ANNOTATION_TIMESTAMPS, GET_BUILD_ANNOTATIONS_FULL } from '../graphql/queries.js';
```

**Step 3: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/services/BuildkiteClient.ts
git commit -m "feat: add GraphQL annotation methods to BuildkiteClient

Adds methods for:
- getAnnotationTimestamps: lightweight check for change detection
- getAnnotationsFull: full data when re-fetch needed

Part of snapshot UX iteration 2."
```

---

## Task 14: Update fetchAndSaveAnnotations to Use GraphQL

**Files:**
- Modify: `src/commands/Snapshot.ts:415-458` (fetchAndSaveAnnotations method)

**Step 1: Replace REST call with GraphQL**

Find the fetchAndSaveAnnotations method and replace:

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
```

With:

```typescript
private async fetchAndSaveAnnotations(
  outputDir: string,
  buildSlug: string,
  debug?: boolean
): Promise<AnnotationResult> {
  try {
    const annotations = await this.client.getAnnotationsFull(buildSlug);
```

**Step 2: Update the call site in execute()**

Find where fetchAndSaveAnnotations is called (around line 215):

```typescript
const annotationResult = await this.fetchAndSaveAnnotations(
  outputDir,
  buildRef.org,
  buildRef.pipeline,
  buildRef.number,
  options.debug
);
```

Replace with:

```typescript
const buildSlug = `${buildRef.org}/${buildRef.pipeline}/${buildRef.number}`;
const annotationResult = await this.fetchAndSaveAnnotations(
  outputDir,
  buildSlug,
  options.debug
);
```

Note: buildSlug is already defined earlier, so just use it:

```typescript
const annotationResult = await this.fetchAndSaveAnnotations(
  outputDir,
  buildSlug,
  options.debug
);
```

**Step 3: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "refactor: migrate annotations from REST to GraphQL

Replaces REST API call with GraphQL for consistent data fetching
and better typing. Prepares for incremental annotation updates.

Part of snapshot UX iteration 2."
```

---

## Task 15: Add Annotation Timestamps to Manifest

**Files:**
- Modify: `src/commands/Snapshot.ts` (Manifest interface and buildManifest)

**Step 1: Update Manifest annotations section**

Find the annotations section in Manifest interface:

```typescript
annotations?: {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
};
```

Replace with:

```typescript
annotations?: {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
  items?: Array<{
    uuid: string;
    updatedAt: string | null;
  }>;
};
```

**Step 2: Update AnnotationResult to include items**

Find AnnotationResult interface:

```typescript
interface AnnotationResult {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
  error?: string;
  message?: string;
}
```

Replace with:

```typescript
interface AnnotationResult {
  fetchStatus: 'success' | 'none' | 'failed';
  count: number;
  items?: Array<{ uuid: string; updatedAt: string | null }>;
  error?: string;
  message?: string;
}
```

**Step 3: Update fetchAndSaveAnnotations to return items**

In fetchAndSaveAnnotations, update the success return:

```typescript
return {
  fetchStatus: 'success',
  count: annotations.length,
  items: annotations.map(a => ({ uuid: a.uuid, updatedAt: a.updatedAt })),
};
```

**Step 4: Update buildManifest to include annotation items**

In buildManifest, update annotations section:

```typescript
annotations: {
  fetchStatus: annotationResult.fetchStatus,
  count: annotationResult.count,
  items: annotationResult.items,
},
```

**Step 5: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: store annotation timestamps in manifest

Adds uuid and updatedAt for each annotation to enable
change detection on subsequent snapshots.

Part of snapshot UX iteration 2."
```

---

## Task 16: Add Annotation Change Detection to detectChanges

**Files:**
- Modify: `src/commands/Snapshot.ts` (detectChanges method)

**Step 1: Update detectChanges to check annotations**

Add annotation check before the "No changes detected" return. Find:

```typescript
// If any jobs need re-fetching, there are changes
if (jobsToRefetch.length > 0) {
  return {
    hasChanges: true,
    reason: 'build_finished_changed',
    jobsToRefetch,
  };
}

// No changes detected
return { hasChanges: false };
```

Replace with:

```typescript
// If any jobs need re-fetching, there are changes
if (jobsToRefetch.length > 0) {
  return {
    hasChanges: true,
    reason: 'build_finished_changed',
    jobsToRefetch,
    annotationsChanged: false,  // Will check separately
  };
}

// No changes detected
return { hasChanges: false, annotationsChanged: false };
```

**Step 2: Add separate annotation check method**

Add after detectChanges method:

```typescript
/**
 * Check if annotations have changed
 * Returns true if any annotation is new or has been updated
 */
private async checkAnnotationsChanged(
  buildSlug: string,
  existingManifest: Manifest | null
): Promise<boolean> {
  if (!existingManifest?.annotations?.items) {
    return true;  // No stored annotations, need to fetch
  }

  try {
    const currentTimestamps = await this.client.getAnnotationTimestamps(buildSlug);

    // Create map of stored annotations
    const storedMap = new Map(
      existingManifest.annotations.items.map(a => [a.uuid, a.updatedAt])
    );

    // Check for new or updated annotations
    for (const current of currentTimestamps) {
      const storedUpdatedAt = storedMap.get(current.uuid);
      if (storedUpdatedAt === undefined) {
        return true;  // New annotation
      }
      if (current.updatedAt !== storedUpdatedAt) {
        return true;  // Updated annotation
      }
    }

    // Check count matches
    if (currentTimestamps.length !== existingManifest.annotations.items.length) {
      return true;  // Annotation count changed (deleted)
    }

    return false;
  } catch {
    return true;  // Error checking, re-fetch to be safe
  }
}
```

**Step 3: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: add annotation change detection

Compares current annotation timestamps against stored values
to determine if annotations need re-fetching. Uses lightweight
GraphQL query to minimize data transfer.

Part of snapshot UX iteration 2."
```

---

## Task 17: Integrate Annotation Check into execute()

**Files:**
- Modify: `src/commands/Snapshot.ts` (execute method)

**Step 1: Add annotation change check**

Find the annotation fetch section in execute() (around line 214):

```typescript
// 7. Fetch and save annotations
spinner.update('Fetching annotations…');
const annotationResult = await this.fetchAndSaveAnnotations(
  outputDir,
  buildSlug,
  options.debug
);
```

Replace with:

```typescript
// 7. Check and fetch annotations if changed
spinner.update('Checking annotations…');
let annotationResult: AnnotationResult;

const annotationsChanged = await this.checkAnnotationsChanged(buildSlug, existingManifest);
if (annotationsChanged || options.force) {
  spinner.update('Fetching annotations…');
  annotationResult = await this.fetchAndSaveAnnotations(
    outputDir,
    buildSlug,
    options.debug
  );
} else {
  // Use existing annotation data
  annotationResult = existingManifest?.annotations
    ? { fetchStatus: existingManifest.annotations.fetchStatus, count: existingManifest.annotations.count, items: existingManifest.annotations.items }
    : { fetchStatus: 'none', count: 0 };
  if (options.debug) {
    logger.debug('Annotations unchanged, using cached data');
  }
}
```

**Step 2: Compile to verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "feat: integrate annotation change check into execute

Only fetches annotations when changes detected. Uses lightweight
timestamp check before full fetch. Reuses cached data when
annotations unchanged.

Part of snapshot UX iteration 2."
```

---

## Task 18: Update Tests for New Behavior

**Files:**
- Modify: `test/commands/Snapshot.test.ts`

**Step 1: Read existing test file**

Read: `test/commands/Snapshot.test.ts`
Purpose: Understand current test structure and what needs updating

**Step 2: Add test for --force flag**

Add test case:

```typescript
it('should re-fetch when --force is provided', async () => {
  // Setup: Create existing manifest
  // Execute with --force
  // Verify: Full fetch occurred
});
```

**Step 3: Add test for "already up to date" scenario**

```typescript
it('should show "already up to date" when build unchanged', async () => {
  // Setup: Create existing manifest with matching state
  // Execute without --force
  // Verify: No fetch, shows up to date message
});
```

**Step 4: Add test for new default location**

```typescript
it('should use ./tmp/bktide/snapshots as default location', async () => {
  // Execute without --output-dir
  // Verify: Files created in ./tmp/bktide/snapshots/
});
```

**Step 5: Run tests**

Run: `npm test -- test/commands/Snapshot.test.ts`
Expected: All tests pass

**Step 6: Commit**

```bash
git add test/commands/Snapshot.test.ts
git commit -m "test: add tests for snapshot iteration 2 features

Tests for:
- --force flag bypasses change detection
- 'Already up to date' message when unchanged
- New default location ./tmp/bktide/snapshots/

Part of snapshot UX iteration 2."
```

---

## Task 19: Update README Documentation

**Files:**
- Modify: `README.md`

**Step 1: Find snapshot documentation section**

Search for existing snapshot documentation in README

**Step 2: Update default location**

Change references from `~/.bktide/snapshots/` to `./tmp/bktide/snapshots/`

**Step 3: Add --force flag documentation**

Add to options list:

```markdown
- `--force` - Force full re-fetch, bypassing change detection
```

**Step 4: Add incremental fetch note**

Add explanation:

```markdown
### Incremental Updates

Subsequent runs of `snapshot` on the same build detect changes and only re-fetch
what's needed. Use `--force` to bypass this and fetch everything fresh.
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: update README for snapshot iteration 2

- Update default location to ./tmp/bktide/snapshots/
- Document --force flag
- Add incremental fetching explanation

Part of snapshot UX iteration 2."
```

---

## Task 20: Run Full Test Suite and Manual Verification

**Files:**
- N/A (verification)

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Manual test - first snapshot**

Run: `npm run dev -- snapshot [org/pipeline/build]`
Expected:
- Visual delimiter visible
- Snapshot created in ./tmp/bktide/snapshots/
- Proper spacing in output
- Tips in Next Steps section

**Step 3: Manual test - second snapshot (no changes)**

Run: `npm run dev -- snapshot [org/pipeline/build]`
Expected: "Snapshot already up to date" message

**Step 4: Manual test - force refresh**

Run: `npm run dev -- snapshot [org/pipeline/build] --force`
Expected: Full re-fetch despite existing snapshot

**Step 5: Commit any fixes**

If any issues found, fix and commit.

**Step 6: Final commit**

```bash
git add .
git commit -m "chore: complete snapshot UX iteration 2

All features implemented and tested:
- Visual delimiter in npm run dev
- Improved output spacing and formatting
- Relocated tips to Next Steps section
- Changed default location to ./tmp/bktide/snapshots/
- Incremental fetching with change detection
- --force flag to bypass cache
- GraphQL migration for annotations"
```

---

## Task 21: Add Blank Line Before "Next steps:"

**Problem:** No visual separation between annotation count and "Next steps:" section.

**Files:**
- Modify: `src/commands/Snapshot.ts` (displayNavigationTips method)

**Step 1: Add blank line at start of displayNavigationTips**

Find the start of displayNavigationTips where it outputs "Next steps:":

```typescript
logger.console('Next steps:');
```

Add blank line before:

```typescript
logger.console('');  // Blank line before Next steps
logger.console('Next steps:');
```

**Step 2: Compile and verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: add blank line before Next steps section

Improves visual separation between snapshot info and tips.

Part of snapshot UX iteration 2."
```

---

## Task 22: Format manifest.json Line as Tip with Arrow

**Problem:** manifest.json line doesn't match tip formatting style (no arrow prefix).

**Files:**
- Modify: `src/commands/Snapshot.ts` (displayNavigationTips method)

**Step 1: Update manifest.json line format**

Find current format:

```typescript
logger.console('');
logger.console(SEMANTIC_COLORS.dim(`manifest.json has full build metadata and step index`));
```

Replace with arrow-prefixed tip style:

```typescript
logger.console('');
logger.console(SEMANTIC_COLORS.dim(`  → manifest.json has full build metadata and step index`));
```

**Step 2: Compile and verify**

Run: `npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: format manifest.json line with arrow prefix

Matches the tip formatting style for consistency.

Part of snapshot UX iteration 2."
```

---

## Task 23: Use Relative Path Display for Default Location

**Problem:** Path displays as `~/workspace/.../tmp/bktide/...` instead of `./tmp/bktide/...` when using default location.

**Files:**
- Modify: `src/commands/Snapshot.ts` (add pathForDisplay helper, update path outputs)

**Step 1: Add pathForDisplay helper**

Add after pathWithTilde helper usage or as new method:

```typescript
/**
 * Format path for display: use relative ./tmp/... for default location,
 * tilde path for custom locations
 */
private pathForDisplay(absolutePath: string): string {
  const cwd = process.cwd();
  const defaultBase = path.join(cwd, 'tmp', 'bktide', 'snapshots');

  // If path is under default location, show as relative
  if (absolutePath.startsWith(defaultBase)) {
    return './' + path.relative(cwd, absolutePath);
  }

  // Otherwise use tilde path
  return pathWithTilde(absolutePath);
}
```

**Step 2: Replace pathWithTilde with pathForDisplay for output paths**

Find all `pathWithTilde(outputDir)` calls in execute() and displayNavigationTips() and replace with `this.pathForDisplay(outputDir)`.

Key locations:
- "Snapshot saved to" line
- "Snapshot already up to date" line
- All tip paths (manifest.json, steps/, log.txt, etc.)

**Step 3: Compile and verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Manual verification**

Run: `npm run dev -- snapshot [build-ref]`
Expected: Paths show as `./tmp/bktide/snapshots/org/pipeline/123/...`

**Step 5: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: use relative paths for default snapshot location

Shows ./tmp/bktide/snapshots/... instead of expanded ~/workspace/...
when using the default location. Custom locations still use tilde paths.

Part of snapshot UX iteration 2."
```

---

## Task 24: Remove or Relocate "Fetched N steps" Line

**Problem:** "Fetched 74 steps" appears before build summary but wasn't in design.

**Files:**
- Modify: `src/commands/Snapshot.ts` (execute method, progress callbacks)

**Step 1: Identify source of "Fetched N steps" output**

This likely comes from the progress bar complete message. Find:

```typescript
progressBar.complete(`Fetched ${totalJobs} step${totalJobs > 1 ? 's' : ''}`);
```

**Step 2: Update to not show fetched count (already in summary)**

The step count is already shown in build summary. Change to:

```typescript
progressBar.complete('');  // Silent completion, count shown in summary
```

Or remove the fetched count message entirely since it's redundant with "N step(s) captured".

**Step 3: Compile and verify**

Run: `npm run build`
Expected: SUCCESS

**Step 4: Manual verification**

Run: `npm run dev -- snapshot [build-ref]`
Expected: No "Fetched N steps" line before build summary

**Step 5: Commit**

```bash
git add src/commands/Snapshot.ts
git commit -m "fix: remove redundant 'Fetched N steps' output

Step count is already shown in 'N step(s) captured' line.
Reduces noise in output.

Part of snapshot UX iteration 2."
```

---

## Task 25: Final Output Verification

**Files:**
- N/A (verification only)

**Step 1: Run snapshot and verify output format**

Run: `npm run dev -- snapshot [org/pipeline/build]`

**Expected output format:**

```
────────────────────────── bktide output ──────────────────────────
✗ FAILED Build Name #123 1h 2m
         Author • branch • commit • time ago
N steps: X passed, Y failed, Z other

Snapshot saved to ./tmp/bktide/snapshots/org/pipeline/123
  N step(s) captured
  M annotation(s) captured

Next steps:
  → List failures:   jq -r '...' ./tmp/bktide/snapshots/.../manifest.json
  → View annotations: jq -r '...' ./tmp/bktide/snapshots/.../annotations.json
  → ...
  → Use --no-tips to hide these hints

  → manifest.json has full build metadata and step index
```

**Verify:**
1. ✅ Visual delimiter before output
2. ✅ Blank line after step count, before "Snapshot saved"
3. ✅ Blank line after annotation count, before "Next steps:"
4. ✅ Paths show as `./tmp/...` not `~/workspace/.../tmp/...`
5. ✅ manifest.json line has arrow prefix
6. ✅ No "Fetched N steps" line

**Step 2: Test "already up to date" output**

Run same command again:

```
Snapshot already up to date: ./tmp/bktide/snapshots/org/pipeline/123

Next steps:
  → ...
```

**Step 3: Commit any remaining fixes**

If any issues found, fix and commit individually.

---

## Summary

This plan implements snapshot UX iteration 2 in 25 tasks:

1. **Tasks 1-5**: Output polish (delimiter, spacing, tip relocation, formatting, location)
2. **Tasks 6-11**: Change detection infrastructure (--force flag, manifest loading, state comparison)
3. **Tasks 12-17**: GraphQL annotation migration and annotation change detection
4. **Tasks 18-20**: Testing and documentation
5. **Tasks 21-25**: Output format fixes (gaps identified during review)

**Key architectural decisions:**
- Change detection at build, job, and annotation levels
- GraphQL for annotations (lightweight + full queries)
- Incremental job re-fetching (only changed jobs)
- Annotations re-fetch all-or-nothing when changes detected

**Testing strategy:**
- Unit tests for new flags and behaviors
- Manual verification for output formatting
- End-to-end test of incremental fetching flow
