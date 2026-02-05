# bktide

Command-line interface for Buildkite CI/CD workflows with rich shell completions (Fish, Bash, Zsh) and Alfred workflow integration for macOS power users.

## Features

- **🚀 Workflow Management**: View and manage builds, pipelines, organizations, and annotations
- **🔧 Smart Shell Completions**: Context-aware completions for Fish, Bash, and Zsh
- **🎯 Alfred Integration**: macOS Alfred workflow for quick access to Buildkite data
- **📊 Multiple Output Formats**: Plain text, JSON, or Alfred-compatible output
- **🔐 Secure Token Storage**: System keychain integration for API credentials
- **⚡ Performance**: Built-in caching for faster repeated operations
- **🤖 AI/LLM Integration**: Export agent rules for Claude Code, Cursor, and other AI tools

## Installation

```bash
npm install -g bktide
```

Once installed, use the `bktide` binary directly from your shell.

## Shell Completions

bktide supports auto-completion for Fish, Bash, and Zsh shells.

### Quick Setup

```bash
# Fish
bktide completions fish > ~/.config/fish/completions/bktide.fish

# Bash
echo 'source <(bktide completions bash)' >> ~/.bashrc

# Zsh  
echo 'source <(bktide completions zsh)' >> ~/.zshrc
```

Completions provide:
- Command suggestions (ie `bktide <Tab>`)
- Option completions (ie `bktide builds --<Tab>`)
- Value completions (ie `bktide --format <Tab>`)
- Dynamic completions for organizations and pipelines (Fish with jq installed)

See [Shell Completions Guide](docs/shell-completions.md) for detailed installation and troubleshooting.

## Documentation

Our documentation is organized by audience to help you find what you need:

### 📖 [User Documentation](docs/user/) - For end users
- [Getting Started](docs/user/getting-started.md) - Quick start guide for new users
- [Authentication](docs/user/authentication.md) - How to authenticate with Buildkite
- [Shell Completions](docs/user/shell-completions.md) - Setting up auto-completion
- [Troubleshooting](docs/user/troubleshooting.md) - Common issues and solutions
- [Alfred Integration](docs/user/alfred/) - macOS Alfred workflow (installation, troubleshooting)

### 👨‍💻 [Developer Documentation](docs/developer/) - For contributors
- [Contributing Guide](docs/developer/contributing.md) - How to contribute to the project
- [Development Guide](docs/developer/development.md) - Setup and coding guidelines
- [Alfred Workflow Development](docs/developer/alfred-workflow-development.md) - Building and packaging
- [Testing Strategy](docs/developer/testing/README.md) - Testing approach and procedures

### 📚 [Reference Documentation](docs/reference/) - For everyone
- [Changelogs](docs/reference/) - What changed and when
- [Release Process](docs/reference/releasing.md) - How releases work

See [Documentation Overview](docs/README.md) for the complete structure and classification guide.

## Testing

Run the test suite with:
```bash
npm test                       # Run all tests
npm run test:watch            # Watch mode for development  
npm run test:coverage         # Generate coverage report
npm run test:extract-patterns # Extract patterns from real data (requires token)
```

See [Testing Strategy](docs/developer/testing/README.md) for details on the hybrid testing approach.

## Usage

### Show Your Login Information

```bash
bktide viewer
```

### List Your Organizations

```bash
bktide orgs
```

### List Pipelines in an Organization

```bash
bktide pipelines
```

Additional options:
```bash
# Filter by organization
bktide pipelines --org your-org-slug

# Limit the number of results
bktide pipelines --count 20

# Filter pipelines by name
bktide pipelines --filter payments
```

### List Your Builds

```bash
bktide builds
```

Additional options:
```bash
# Filter by organization
bktide builds --org your-org-slug

# Filter by pipeline
bktide builds --pipeline pipeline-slug

# Filter by branch
bktide builds --branch main

# Filter by state
bktide builds --state passed

# Pagination
bktide builds --count 20 --page 2

# Output in JSON format
bktide builds --format json

# Output in Alfred-compatible JSON format
bktide builds --format alfred
```

### Show Build Annotations

```bash
bktide annotations <build>
```

The build reference can be specified in two formats:
- **Slug format**: `org/pipeline/number` (e.g., `gusto/zenpayroll/1287418`)
- **URL format**: `https://buildkite.com/org/pipeline/builds/number`

Additional options:
```bash
# Filter by context
bktide annotations gusto/zenpayroll/1287418 --context rspec

# Output in JSON format
bktide annotations gusto/zenpayroll/1287418 --format json

# Output in plain text format (default)
bktide annotations https://buildkite.com/gusto/zenpayroll/builds/1287418 --format plain

# Combine filtering and formatting
bktide annotations gusto/zenpayroll/1287418 --context build-resources --format json
```

### Show Build Details

View detailed information about a specific build including jobs and annotations.

```bash
# View build by slug format
bktide build org/pipeline/123

# View build by URL format
bktide build https://buildkite.com/org/pipeline/builds/123
```

Additional options:
```bash
# Fetch all jobs (handles pagination for large builds)
bktide build org/pipeline/123 --jobs

# Show failure details and error summaries
bktide build org/pipeline/123 --failed

# Include full annotation content
bktide build org/pipeline/123 --annotations

# Combine options for comprehensive view
bktide build org/pipeline/123 --jobs --failed --annotations
```

### Show Pipeline Details

View pipeline metadata and recent builds.

```bash
# View pipeline by slug format
bktide pipeline org/pipeline

# View pipeline by URL format
bktide pipeline https://buildkite.com/org/pipeline

# Show more recent builds
bktide pipeline org/pipeline --count 50
```

### View Step Logs

View logs for a specific build step.

```bash
# View logs by providing build reference and step ID
bktide logs org/pipeline/123 <step-id>

# View logs from URL with step ID in query parameter
bktide logs "https://buildkite.com/org/pipeline/builds/123?sid=<step-id>"

# Show all lines (default is last 50 lines)
bktide logs org/pipeline/123 <step-id> --full

# Show last N lines
bktide logs org/pipeline/123 <step-id> --lines 100

# Save logs to file
bktide logs org/pipeline/123 <step-id> --save logs.txt
```

**Note:** Viewing step logs requires `read_build_logs` scope on your API token.

### Smart Reference Command

Paste any Buildkite URL or use short-hand formats, and bktide will figure out what to show.

**Supported formats:**

```bash
# Pipeline view (shows metadata + recent builds)
bktide gusto/schemaflow
bktide https://buildkite.com/gusto/schemaflow

# Build view (shows comprehensive build details)
bktide gusto/schemaflow/76
bktide gusto/schemaflow#76
bktide https://buildkite.com/gusto/schemaflow/builds/76

# Step logs (shows build context + step logs)
bktide https://buildkite.com/gusto/schemaflow/builds/76?sid=019adb19-bd83-4149-b2a7-ece1d7a41c9d
```

**Log display options:**

```bash
# Show last 50 lines (default)
bktide https://buildkite.com/org/pipeline/builds/123?sid=<step-id>

# Show all lines
bktide https://buildkite.com/org/pipeline/builds/123?sid=<step-id> --full

# Show last N lines
bktide https://buildkite.com/org/pipeline/builds/123?sid=<step-id> --lines 100

# Save logs to file
bktide https://buildkite.com/org/pipeline/builds/123?sid=<step-id> --save logs.txt
```

**Note:** Viewing step logs requires `read_build_logs` scope on your API token.

### Generate Shell Completions

```bash
# Generate completions for your shell
bktide completions fish
bktide completions bash
bktide completions zsh

# Auto-detect your shell and generate completions
bktide completions
```

### AI/LLM Integration

Export agent rules to teach AI assistants how to use bktide for CI debugging.

```bash
# View the rules
bktide prime

# Append to Claude Code memory
bktide prime >> ~/.claude/CLAUDE.md

# Append to Cursor rules
bktide prime >> .cursor/rules.md
```

The rules include common workflows for investigating failing builds and integrating with GitHub PRs.

## API Token

You'll need a Buildkite API token. Create one at:
https://buildkite.com/user/api-access-tokens

### Required Scopes

Enable these scopes when creating your token:

- **GraphQL API Access** - Required for all API queries
- **Read Builds** - View builds, jobs, and logs
- **Read Organizations** - List and access organizations
- **Read Pipelines** - View pipeline configurations
- **Read User** - Access your user information

All five scopes are required for full bktide functionality.

### Providing your token

You can provide your token in one of these ways:

- `-t, --token <token>`: e.g. `bktide orgs --token abc123`
- `BK_TOKEN` environment variable: e.g. `BK_TOKEN=abc123 bktide orgs`
- Store once and reuse: `bktide token --store`

Manage stored token:

```bash
bktide token --check   # See if a token is stored
bktide token --reset   # Remove stored token
```

## Visual Features

The CLI provides a modern visual experience with color-coded information and clear hierarchy:

### Color-Coded Build Status
Build statuses are displayed with intuitive colors for quick scanning:
- **Blue** (✓) - Passed builds
- **Orange** (✖) - Failed builds  
- **Cyan** (↻) - Running builds
- **Yellow** (⚠) - Blocked/warning states
- **Gray** (−) - Skipped/inactive states

### Visual Hierarchy
- **Bold + underlined headers** for table columns
- **Cyan highlighting** for identifiers (#1234, IDs)
- **Magenta** for numeric counts
- **Dimmed text** for auxiliary information and tips
- **Arrow indicators** (→) for actionable tips

### Accessibility
- **Colorblind-safe palette** - Uses blue/orange instead of green/red
- **NO_COLOR support** - Set `NO_COLOR=1` for no colors
- **ASCII mode** - Use `BKTIDE_ASCII=1` for screen reader compatibility
- **Symbols with text fallbacks** - Information never relies solely on color

### Smart Empty States
When no results are found, helpful suggestions guide you:
```
No builds found

Try specifying an organization with --org <name>
Use --count to increase the number of results
```

### Enhanced Error Messages
Errors provide clear context and actionable solutions:
```
✖ Error: Authentication Failed

The provided token is invalid or expired.

To fix this:
  1. Get a new token from Buildkite
  2. Run: bktide token --store
  3. Try your command again
```

## Snapshot: Offline Build Analysis

When you need to do deep debugging or feed build data into other tools, use `snapshot` to download complete build data locally.

### Capture a Build Snapshot

```bash
# Capture failed steps from a build
bktide snapshot https://buildkite.com/org/pipeline/builds/123
bktide snapshot org/pipeline/123

# Capture all steps (not just failures)
bktide snapshot org/pipeline/123 --all

# Force re-fetch (bypass incremental update)
bktide snapshot org/pipeline/123 --force

# Custom output location
bktide snapshot org/pipeline/123 --output-dir ./investigation
```

Subsequent runs detect changes automatically. If the build hasn't changed, it shows "Snapshot already up to date" and skips re-fetching.

### What Gets Captured

Snapshots are saved to `./tmp/bktide/snapshots/org/pipeline/build/` (relative to cwd) with:

- **manifest.json** - Build metadata and step index for quick filtering
- **build.json** - Complete build data from Buildkite API
- **annotations.json** - Test failures, warnings, and structured information from annotations
- **steps/NN-name/log.txt** - Full logs for each step
- **steps/NN-name/step.json** - Step metadata (state, exit code, timing)

### Common Use Cases

**Find what failed:**

```bash
cd ./tmp/bktide/snapshots/org/pipeline/123
jq -r '.steps[] | select(.state == "failed") | "\(.id): \(.label)"' manifest.json
```

**View test failure summaries:**
```bash
jq -r '.annotations[] | select(.style == "error") | "\(.context): \(.body_html)"' annotations.json
```

**Search logs for errors:**
```bash
grep -r "Error\|Exception" steps/
```

**Feed to AI agents:**
```bash
bktide snapshot org/pipeline/123
claude "analyze failures in ./tmp/bktide/snapshots/org/pipeline/123"
```

**Share with teammates:**
```bash
tar -czf build-123-investigation.tar.gz ./tmp/bktide/snapshots/org/pipeline/123
```

**Note:** Add `./tmp/` to your `.gitignore` if using the default location.

## Global Options

These flags work with all commands:

- `--log-level <level>`: trace|debug|info|warn|error|fatal (default: info)
- `-d, --debug`: verbose debug output and detailed errors
- `--no-cache`: disable API response caching
- `--cache-ttl <ms>`: set cache TTL in milliseconds
- `--clear-cache`: clear cached data before running
- `-t, --token <token>`: provide Buildkite API token (or use `BK_TOKEN`)
- `--save-token`: save token to system keychain
- `-f, --format <format>`: plain|json|alfred (affects output and errors)
- `--color <mode>`: auto|always|never (controls color in plain format)
- `-q, --quiet`: suppress non-error output (success messages, tips)
- `--tips`: show helpful tips after operations (default: true)
- `--no-tips`: hide helpful tips

### Output Behavior

- Plain format (default): human-friendly output with color-coded statuses, bold headers, and visual hierarchy. Progress indicators (spinners for indeterminate operations, progress bars for operations with known totals) show during long operations only in interactive TTYs and are cleared on completion (no residual lines). Tips appear dimmed with arrow indicators (→) at the end of output.
- JSON/Alfred formats: strictly machine-readable; no extra lines, no colors, no spinners or confirmations.
- Streams: results go to stdout; errors go through the error formatter. When using `--format json|alfred`, only the formatted payload is printed.
- Colors: by default `--color auto` enables color in TTYs with semantic coloring (blue for success, orange for errors, etc.). Use `--color never` or `NO_COLOR=1` to disable. Use `--color always` to force color in plain output.
- Accessibility: Full functionality without colors - symbols provide visual cues (✓, ✖, ⚠, →) with ASCII fallbacks when `BKTIDE_ASCII=1` is set.

# Logging System

The CLI uses a structured logging system based on Pino. This provides several benefits:

- Different log levels (trace, debug, info, warn, error, fatal)
- JSON logs saved to disk (in `log/cli.log`)
- Pretty-printed logs to the console
- Performance measurements

## Log Level Configuration

You can configure the log level with the `--log-level` option:

```bash
bktide orgs --log-level=debug  # Show debug messages
bktide builds --log-level=trace # Show all messages including trace
```

Available log levels (from most to least verbose):
- trace: Very detailed tracing for debugging
- debug: Detailed information for developers
- info: General information (default)
- warn: Warning conditions
- error: Error conditions
- fatal: Severe errors causing termination

## Log Files

All logs are written to `~/.local/state/bktide/logs/cli.log` in JSON format, which can be processed with tools like jq:

```bash
# View recent errors
cat ~/.local/state/bktide/logs/cli.log | grep -v '"level":30' | jq

# Analyze performance 
cat ~/.local/state/bktide/logs/cli.log | jq 'select(.duration != null) | {msg, duration}'
``` 