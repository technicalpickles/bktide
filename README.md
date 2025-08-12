# bktide

A command-line tool for interacting with Buildkite's GraphQL API.

## Installation

```bash
npm install -g bktide
```

## Documentation

- [Development Guide](docs/development.md) - Information about running and developing the CLI
- [Authentication](docs/authentication.md) - How to authenticate with Buildkite
- [Caching](docs/caching.md) - Information about the CLI's caching system
- [Alfred Integration](docs/alfred.md) - How to integrate with Alfred workflows

## Usage

### Show Your Login Information

```bash
npm run dev -- viewer
```

### List Your Organizations

```bash
npm run dev -- orgs
```

### List Pipelines in an Organization

```bash
npm run dev -- pipelines
```

Additional options:
```bash
# Filter by organization
npm run dev -- pipelines --org your-org-slug

# Limit the number of results
npm run dev -- pipelines --count 20
```

### List Your Builds

```bash
npm run dev -- builds
```

Additional options:
```bash
# Filter by organization
npm run dev -- builds --org your-org-slug

# Filter by pipeline
npm run dev -- builds --pipeline pipeline-slug

# Filter by branch
npm run dev -- builds --branch main

# Filter by state
npm run dev -- builds --state passed

# Pagination
npm run dev -- builds --count 20 --page 2

# Output in JSON format
npm run dev -- builds --json

# Output in Alfred-compatible JSON format
npm run dev -- builds --alfred
```

### Show Build Annotations

```bash
npm run dev -- annotations <build>
```

The build reference can be specified in two formats:
- **Slug format**: `org/pipeline/number` (e.g., `gusto/zenpayroll/1287418`)
- **URL format**: `@https://buildkite.com/org/pipeline/builds/number` or `https://buildkite.com/org/pipeline/builds/number`

Additional options:
```bash
# Filter by context
npm run dev -- annotations gusto/zenpayroll/1287418 --context rspec

# Output in JSON format
npm run dev -- annotations gusto/zenpayroll/1287418 --format json

# Output in plain text format (default)
npm run dev -- annotations https://buildkite.com/gusto/zenpayroll/builds/1287418 --format plain

# Combine filtering and formatting
npm run dev -- annotations gusto/zenpayroll/1287418 --context build-resources --format json
```

## API Token

You'll need a Buildkite API token with GraphQL scopes. Create one at:
https://buildkite.com/user/api-access-tokens

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