# Smart Reference Command

The smart reference command allows you to paste any Buildkite URL or use convenient short-hand formats without needing to know specific subcommands.

## Overview

Instead of remembering different commands for pipelines, builds, and logs, just paste what you have:

```bash
bktide <any-buildkite-reference>
```

bktide will automatically figure out what you want to see and show the appropriate view.

## Supported Formats

### Pipeline References

Show pipeline metadata and recent builds:

```bash
# Slash format
bktide org/pipeline

# Full URL
bktide https://buildkite.com/org/pipeline
```

**Output includes:**
- Pipeline name, description, default branch
- Repository URL
- Table of recent builds (last 20)

### Build References

Show comprehensive build details (equivalent to `bktide build <ref> --jobs --failed`):

```bash
# Slash format
bktide org/pipeline/123

# Hash format (GitHub-style)
bktide org/pipeline#123

# Full URL
bktide https://buildkite.com/org/pipeline/builds/123
```

**Output includes:**
- Build status and metadata
- All jobs and their states
- Failed steps with error details
- Build annotations

### Step Log References

Show build context, step information, and logs:

```bash
# URL with step ID query parameter
bktide https://buildkite.com/org/pipeline/builds/123?sid=<step-id>

# With /steps/canvas path (ignored)
bktide https://buildkite.com/org/pipeline/builds/123/steps/canvas?sid=<step-id>
```

**Output includes:**
- Build context (org, pipeline, number, status, timing)
- Step information (label, state, exit status)
- Log content (last 50 lines by default)
- Tips for viewing more

## Log Display Options

When viewing step logs, you can control how logs are displayed:

### Show Last N Lines (Default: 50)

```bash
bktide <url-with-sid> --lines 100
```

### Show All Lines

```bash
bktide <url-with-sid> --full
```

### Save to File

```bash
bktide <url-with-sid> --save logs.txt
```

The file will contain the full log content with ANSI color codes preserved.

### Combine Options

```bash
# Save full log and display last 100 lines
bktide <url-with-sid> --save logs.txt --lines 100
```

## Caching

Logs are cached using the same cache system as other API calls. Running the same command twice will be instant on the second run (unless you use `--no-cache`).

## Permissions

**For pipeline and build views:** Requires standard scopes (`read_builds`, `read_organizations`, `read_pipelines`)

**For step logs:** Additionally requires `read_build_logs` scope

If you get a permission error when viewing logs:
1. Go to https://buildkite.com/user/api-access-tokens
2. Edit your token and add the `read_build_logs` scope
3. Update your stored token: `bktide token --store`

## Examples

### View a Pipeline

```bash
$ bktide gusto/schemaflow

Pipeline: gusto/schemaflow
Description: Schema migration workflow for data platform
Default Branch: main
Repository: github.com/gusto/schemaflow

Recent Builds:
┌────────┬─────────┬─────────┬──────────────┬────────────┐
│ Build  │ Status  │ Branch  │ Message      │ Started    │
├────────┼─────────┼─────────┼──────────────┼────────────┤
│ #76    │ ✓ passed│ main    │ Add index    │ 2h ago     │
│ #75    │ ✖ failed│ feat/x  │ Update...    │ 3h ago     │
└────────┴─────────┴─────────┴──────────────┴────────────┘
```

### View a Build

```bash
$ bktide gusto/schemaflow#76

# Shows comprehensive build details with jobs and failure info
```

### View Step Logs

```bash
$ bktide "https://buildkite.com/gusto/schemaflow/builds/76?sid=019adb19..."

Build: gusto/schemaflow #76
Status: ✖ failed
Started: 2 hours ago
Duration: 15m 32s

Step: Run RSpec Tests
Job ID: 019adb19-bd83-4149-b2a7-ece1d7a41c9d
State: failed
Exit Status: 1

Logs (last 50 lines of 1,247):
──────────────────────────────────────
[... log content ...]
──────────────────────────────────────

→ Log is 2.3 MB. Showing last 50 lines.
→ Run with --full to see all 1,247 lines
→ Run with --save <path> to save to file
```

## Output Formats

Like all bktide commands, you can specify output format:

```bash
# JSON output
bktide org/pipeline --format json

# Alfred-compatible JSON
bktide org/pipeline --format alfred
```

## Tips

1. **Use quotes for URLs with query parameters:**
   ```bash
   bktide "https://buildkite.com/org/pipeline/builds/123?sid=abc"
   ```

2. **Hash format is convenient for quick access:**
   ```bash
   bktide org/pipeline#76
   ```

3. **Logs are cached - second access is instant:**
   ```bash
   bktide <url-with-sid>  # Fetches from API
   bktide <url-with-sid>  # Instant from cache
   ```

4. **Save large logs for analysis:**
   ```bash
   bktide <url-with-sid> --save logs.txt
   less -R logs.txt  # View with colors
   ```
