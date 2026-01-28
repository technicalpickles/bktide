# Smart Reference Command

The smart reference command allows you to paste any Buildkite URL or use convenient short-hand formats without needing to know specific subcommands.

## Overview

Instead of remembering different commands for pipelines, builds, and logs, just paste what you have:

```bash
bktide <any-buildkite-reference>
```

bktide will automatically figure out what you want to see and show the appropriate view.

## Smart References vs. Explicit Commands

bktide provides **two ways** to access the same functionality:

### Explicit Commands (Discoverable)
```bash
bktide pipeline org/pipeline          # Pipeline details
bktide logs org/pipeline/123 <sid>    # Step logs
bktide build org/pipeline/123         # Build details
```

**Benefits:**
- Discoverable via `bktide --help`
- Clear, self-documenting
- Access to all command options
- Tab completion in shells

### Smart References (Convenient)
```bash
bktide org/pipeline                   # Same as: bktide pipeline org/pipeline
bktide org/pipeline/123               # Same as: bktide build org/pipeline/123
bktide <url-with-sid>                 # Same as: bktide logs <url>
```

**Benefits:**
- Copy-paste URLs directly from browser
- Shorter syntax for common operations
- Automatically routes to the right command

**Both approaches support the same options** (`--format`, `--debug`, `--full`, etc.)

## Supported Formats

### Pipeline References

Show pipeline metadata and recent builds:

```bash
# Smart reference (short)
bktide org/pipeline
bktide https://buildkite.com/org/pipeline

# Explicit command (discoverable)
bktide pipeline org/pipeline
bktide pipeline https://buildkite.com/org/pipeline
bktide pipeline org/pipeline --count 50
```

**Output includes:**
- Pipeline name, description, default branch
- Repository URL
- Table of recent builds (default: 20)

### Build References

Show comprehensive build details:

```bash
# Smart reference (short) - automatically adds --jobs --failed
bktide org/pipeline/123
bktide org/pipeline#123
bktide https://buildkite.com/org/pipeline/builds/123

# Explicit command (more control)
bktide build org/pipeline/123
bktide build org/pipeline/123 --jobs
bktide build org/pipeline/123 --jobs --failed --annotations
```

**Output includes:**
- Build status and metadata
- All jobs and their states
- Failed steps with error details
- Build annotations

### Step Log References

Show build context, step information, and logs:

```bash
# Smart reference (from URL)
bktide https://buildkite.com/org/pipeline/builds/123?sid=<step-id>

# Explicit command (more options)
bktide logs org/pipeline/123 <step-id>
bktide logs org/pipeline/123 <step-id> --full
bktide logs org/pipeline/123 <step-id> --lines 100
bktide logs org/pipeline/123 <step-id> --save logs.txt
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
$ bktide acme/example-pipeline

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

### View a Build

```bash
$ bktide acme/example-pipeline#76

# Shows comprehensive build details with jobs and failure info
```

### View Step Logs

```bash
$ bktide "https://buildkite.com/acme/example-pipeline/builds/76?sid=019adb19..."

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

## For Developers

If you're contributing to bktide and want to understand the design principles behind input flexibility:

- **Design system:** [`docs/developer/ui-design-system.md`](../developer/ui-design-system.md#input-affordances) - Guidelines for supporting multiple input formats
- **Implementation:** [`docs/plans/2025-12-08-smart-reference-command-design.md`](../plans/2025-12-08-smart-reference-command-design.md) - Original design document
