# Snapshot Command Design

## Overview

Add a `bktide snapshot` command that fetches build data from Buildkite and saves it locally in a structured format suitable for agent processing or offline analysis.

## Command Interface

```bash
# Using URL
bktide snapshot https://buildkite.com/myorg/mypipeline/builds/123

# Using slug
bktide snapshot myorg/mypipeline/123

# With options
bktide snapshot myorg/mypipeline/123 --output-dir ./builds --json
```

### Arguments

- `<build-ref>` (required): Either a Buildkite build URL or an `org/pipeline/number` slug

### Options

- `--output-dir <path>`: Override default snapshot location (default: `~/.bktide/snapshots/`)
- `--json`: Output manifest JSON to stdout when complete (for scripting)

## Output Structure

```
~/.bktide/snapshots/
└── {org}/
    └── {pipeline}/
        └── {build-number}/
            ├── manifest.json
            ├── build.json
            └── steps/
                ├── 01-{label}/
                │   ├── step.json
                │   └── log.txt
                ├── 02-{label}/
                │   ├── step.json
                │   └── log.txt
                └── ...
```

### File Contents

#### manifest.json

Tracks fetch status and completeness:

```json
{
  "version": 1,
  "buildRef": "myorg/mypipeline/123",
  "url": "https://buildkite.com/myorg/mypipeline/builds/123",
  "fetchedAt": "2025-01-21T12:00:00Z",
  "complete": true,
  "build": {
    "status": "success"
  },
  "steps": [
    {
      "id": "01-build",
      "jobId": "0190abc-...",
      "status": "success"
    },
    {
      "id": "02-test",
      "jobId": "0190def-...",
      "status": "success"
    },
    {
      "id": "03-deploy",
      "jobId": "0190ghi-...",
      "status": "failed",
      "error": "rate_limited",
      "message": "Rate limit exceeded",
      "retryable": true
    }
  ]
}
```

Error categories:
- `rate_limited` - API rate limit hit (retryable: true)
- `not_found` - Job/log doesn't exist (retryable: false)
- `permission_denied` - No access to resource (retryable: false)
- `network_error` - Connection failed (retryable: true)
- `unknown` - Unexpected error (retryable: true)

#### build.json

Build metadata from REST API:

```json
{
  "id": "0190abc-...",
  "number": 123,
  "state": "passed",
  "message": "Fix login bug",
  "commit": "abc123",
  "branch": "main",
  "url": "https://buildkite.com/myorg/mypipeline/builds/123",
  "web_url": "https://buildkite.com/myorg/mypipeline/builds/123",
  "created_at": "2025-01-21T10:00:00Z",
  "started_at": "2025-01-21T10:00:05Z",
  "finished_at": "2025-01-21T10:15:00Z",
  "pipeline": {
    "slug": "mypipeline",
    "name": "My Pipeline"
  },
  "creator": {
    "name": "Jane Dev",
    "email": "jane@example.com"
  },
  "jobs": [...]
}
```

#### step.json

Per-step metadata:

```json
{
  "id": "0190abc-...",
  "name": "Build",
  "label": ":hammer: Build",
  "state": "passed",
  "exit_status": 0,
  "started_at": "2025-01-21T10:00:05Z",
  "finished_at": "2025-01-21T10:05:00Z",
  "agent": {
    "name": "builder-1"
  },
  "parallel_group_index": null,
  "parallel_group_total": null
}
```

#### log.txt

Raw log output from the job, as plain text.

## Implementation

### New REST Client Methods

Add to `BuildkiteRestClient`:

```typescript
/**
 * Get a single build
 */
public async getBuild(
  org: string,
  pipeline: string,
  buildNumber: number
): Promise<Build> {
  const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}`;
  return this.get<Build>(endpoint);
}

/**
 * Get job log content
 */
public async getJobLog(
  org: string,
  pipeline: string,
  buildNumber: number,
  jobId: string
): Promise<JobLog> {
  const endpoint = `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/jobs/${jobId}/log`;
  return this.get<JobLog>(endpoint);
}
```

### Command Class

Create `src/commands/Snapshot.ts`:

```typescript
export class Snapshot extends BaseCommand {
  async execute(buildRef: string, options: SnapshotOptions): Promise<number> {
    // 1. Parse build reference (URL or slug)
    const { org, pipeline, buildNumber } = this.parseBuildRef(buildRef);

    // 2. Determine output directory
    const outputDir = this.getOutputDir(options, org, pipeline, buildNumber);

    // 3. Fetch build data
    const build = await this.restClient.getBuild(org, pipeline, buildNumber);

    // 4. Create directory structure
    await this.createDirectories(outputDir);

    // 5. Save build.json
    await this.saveBuildJson(outputDir, build);

    // 6. Fetch and save each job's data and logs
    const stepResults = await this.fetchSteps(outputDir, org, pipeline, buildNumber, build.jobs);

    // 7. Write manifest
    const manifest = this.buildManifest(org, pipeline, buildNumber, stepResults);
    await this.saveManifest(outputDir, manifest);

    // 8. Output if --json flag
    if (options.json) {
      logger.console(JSON.stringify(manifest, null, 2));
    }

    return manifest.complete ? 0 : 1;
  }
}
```

### Step Naming

Steps are numbered by their order in the build, with a sanitized label:

```typescript
function getStepDirName(index: number, label: string): string {
  const num = String(index + 1).padStart(2, '0');
  const sanitized = label
    .replace(/:[^:]+:/g, '')     // Remove emoji shortcodes
    .replace(/[^a-zA-Z0-9-]/g, '-')  // Replace non-alphanumeric
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .replace(/^-|-$/g, '')        // Trim dashes
    .toLowerCase()
    .slice(0, 50);                // Limit length
  return `${num}-${sanitized || 'step'}`;
}
```

### Error Handling

Wrap each fetch operation to categorize errors:

```typescript
function categorizeError(error: Error): StepError {
  const message = error.message.toLowerCase();

  if (message.includes('rate limit') || message.includes('429')) {
    return { error: 'rate_limited', message: error.message, retryable: true };
  }
  if (message.includes('not found') || message.includes('404')) {
    return { error: 'not_found', message: error.message, retryable: false };
  }
  if (message.includes('permission') || message.includes('403') || message.includes('401')) {
    return { error: 'permission_denied', message: error.message, retryable: false };
  }
  if (message.includes('network') || message.includes('ECONNREFUSED')) {
    return { error: 'network_error', message: error.message, retryable: true };
  }
  return { error: 'unknown', message: error.message, retryable: true };
}
```

### Caching

The command uses the existing `BuildkiteRestClient` which handles caching automatically:
- Reads from cache if data exists and is fresh
- Populates cache after successful fetches
- No additional caching logic needed in the command

## CLI Registration

In `src/index.ts`:

```typescript
program
  .command('snapshot <build-ref>')
  .description('Fetch and save build data locally for offline analysis')
  .option('--output-dir <path>', 'Output directory for snapshot')
  .option('--json', 'Output manifest JSON to stdout')
  .action(createCommandHandler(Snapshot));
```

## Future Improvements

- XDG-compliant default directory (`~/.local/share/bktide/snapshots/`)
- `--no-logs` flag to skip log fetching
- Pipeline context: recent builds for the same branch
- Retry logic for rate-limited steps
- `BKTIDE_SNAPSHOTS_DIR` environment variable

## Testing

- Unit tests for `parseBuildRef()` (URL and slug formats)
- Unit tests for `getStepDirName()` (edge cases, emoji handling)
- Unit tests for `categorizeError()`
- Integration test with mocked REST client
- Test overwrite behavior (re-running on same build)
