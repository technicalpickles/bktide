# bktide

A command-line tool for interacting with Buildkite's GraphQL API.

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
- Command suggestions (`bktide <Tab>`)
- Option completions (`bktide builds --<Tab>`)
- Value completions (`bktide --format <Tab>`)
- Dynamic completions for organizations and pipelines (Fish with jq installed)

See [Shell Completions Guide](docs/shell-completions.md) for detailed installation and troubleshooting.

## Documentation

- [Shell Completions](docs/shell-completions.md) - Complete guide for shell auto-completion setup
- [Development Guide](docs/development.md) - Information about running and developing the CLI
- [Authentication](docs/authentication.md) - How to authenticate with Buildkite
- [Caching](docs/caching.md) - Information about the CLI's caching system
- [Alfred Integration (Overview)](docs/alfred.md) - What the Alfred integration does and quick usage
- [Alfred Installation](docs/alfred-installation.md) - End-user install, configuration, and troubleshooting
- [Alfred Development](docs/alfred-development.md) - Packaging, wrapper behavior, metadata, and workflow wiring

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
- **URL format**: `@https://buildkite.com/org/pipeline/builds/number` or `https://buildkite.com/org/pipeline/builds/number`

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

### Generate Shell Completions

```bash
# Generate completions for your shell
bktide completions fish
bktide completions bash
bktide completions zsh

# Auto-detect your shell and generate completions
bktide completions
```

## API Token

You'll need a Buildkite API token with GraphQL scopes. Create one at:
https://buildkite.com/user/api-access-tokens

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

All logs are written to `log/cli.log` in JSON format, which can be processed with tools like jq:

```bash
# View recent errors
cat log/cli.log | grep -v '"level":30' | jq

# Analyze performance 
cat log/cli.log | jq 'select(.duration != null) | {msg, duration}'
``` 