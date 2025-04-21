# bktide

A command-line tool for interacting with Buildkite's GraphQL API.

## Installation

```bash
npm install -g bktide
```

## Development

### Running the CLI

The CLI can be run in several ways:

```bash
# Regular development mode
npm run dev -- <command> [options]

# With source maps and improved error handling
npm run dev:sourcemap -- <command> [options]

# Compiled mode with source maps (recommended for debugging)
npm run dev:compiled -- <command> [options]
```

### Error Handling Improvements

For better error handling and stack traces:

1. Configure TypeScript with source maps in `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "sourceMap": true,
       "inlineSources": true,
       "sourceRoot": "/"
     }
   }
   ```

2. Use the `dev:compiled` script, which:
   - Compiles TypeScript with source maps
   - Runs Node.js with source maps enabled
   - Provides proper stack traces back to the original TypeScript files

3. For direct debugging with Chrome DevTools, use:
   ```bash
   npm run debug:inspect -- <command> [options]
   ```

### Common Commands

```bash
# Show current user information
npm run dev -- viewer

# List organizations
npm run dev -- orgs

# List pipelines for an organization
npm run dev -- pipelines [--org <org>] [--count <count>]

# List builds
npm run dev -- builds [--org <org>] [--pipeline <pipeline>] [--branch <branch>]
```

Add the `--debug` flag to any command for detailed error information.

## Authentication

You can authenticate with Buildkite in several ways:

1. Using the `--token` option with each command:
   ```bash
   npm run dev -- viewer --token YOUR_BUILDKITE_API_TOKEN
   ```

2. Setting the `BK_TOKEN` environment variable:
   ```bash
   export BK_TOKEN=YOUR_BUILDKITE_API_TOKEN
   npm run dev -- viewer
   ```

3. Using the system keychain (recommended):
   ```bash
   # Store your token securely in the system keychain
   npm run dev -- token store YOUR_BUILDKITE_API_TOKEN
   
   # Now you can run commands without providing the token
   npm run dev -- viewer
   ```

### Credential Management

The CLI now includes secure credential management using the system's native keychain:

```bash
# Store a token in the system keychain
npm run dev -- token store YOUR_BUILDKITE_API_TOKEN

# Check if a token is stored
npm run dev -- token check

# Delete the stored token
npm run dev -- token delete
```

You can also use the `--save-token` flag with any command to save the token used to the system keychain:

```bash
# Use and store a token provided on the command line
npm run dev -- viewer --token YOUR_BUILDKITE_API_TOKEN --save-token

# Use and store a token from the environment variable
# (requires BK_TOKEN to be set)
npm run dev -- viewer --save-token
```

This secure storage method:
- Uses the system's native keychain (Keychain Access on macOS, Credential Manager on Windows, Secret Service API on Linux)
- Eliminates the need to store tokens in plain text or environment variables
- Makes future commands more convenient as no token needs to be provided

## Caching

This CLI implements disk-based caching to improve performance, particularly for repeated queries. Cached data is stored in the `~/.bktide/cache/` directory.

### Default Cache TTL Values

- Viewer data: 1 hour
- Organization data: 1 hour
- Pipeline data: 1 minute
- Build data: 30 seconds
- Other queries: 30 seconds

### Cache Control Options

You can control caching behavior with these options:

```bash
# Disable caching for a command
npm run dev -- viewer --no-cache

# Clear the cache before executing a command
npm run dev -- viewer --clear-cache

# Set a custom TTL (time-to-live) in milliseconds
npm run dev -- viewer --cache-ttl 60000  # 1 minute TTL
```

### API Caching

The caching system works for both GraphQL and REST API calls:

- **GraphQL**: Caches responses for GraphQL queries like `GET_VIEWER` and `GET_ORGANIZATIONS`
- **REST API**: Caches responses for REST endpoints like `/organizations/:org/builds`

This is particularly useful for the `builds` command, which can be used for filtering without hitting the API repeatedly:

```bash
# First call fetches from API
npm run dev -- builds --org your-org --count 50

# Subsequent filtering uses cached data
npm run dev -- builds --org your-org --count 50 --pipeline specific-pipeline
npm run dev -- builds --org your-org --count 50 --branch main
```

### Automatic Cache Invalidation

- The cache is automatically invalidated when your API token changes
- Mutation operations (like triggering a build) will invalidate the relevant cache types
- Each cache entry has a TTL after which it will expire and be refreshed

### Cache Implementation

The caching system uses `node-persist` for persistent storage between CLI invocations. This provides:

- Disk-based storage that persists between CLI runs
- Automatic TTL management
- Token-aware cache invalidation
- Type-based cache management (viewer, organizations, etc.)

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

## Alfred Integration

This CLI supports integration with Alfred workflows via the `--alfred` option:

```bash
npm run dev -- builds --alfred
```

This outputs builds in a JSON format that Alfred can process as a Script Filter. Each build will be shown as a result row with:

- Title: Pipeline name and build number
- Subtitle: State, branch, and commit message
- Action: Opens the build URL when clicked

### Alfred Workflow Setup

1. Create a new Alfred workflow
2. Add a "Script Filter" trigger
3. Set the script to:
   ```bash
   /path/to/your/project/node_modules/.bin/node /path/to/your/project/dist/index.js builds --alfred
   ```
4. Connect it to an "Open URL" action

### Icons

For better visuals, you can add icons matching build states in the `icons/` directory:
- `passed.png`
- `failed.png`
- `running.png`
- `scheduled.png`
- `canceled.png`
- `unknown.png`

## Using the GraphQL Client in Your Code

The Buildkite GraphQL client can be used in your own code:

```typescript
import { BuildkiteClient } from './services/BuildkiteClient';
import { GET_PIPELINES } from './graphql/queries';

const client = new BuildkiteClient('your-api-token');

async function getPipelines(organizationSlug: string) {
  const variables = {
    organizationSlug,
    first: 10
  };
  
  const data = await client.query(GET_PIPELINES, variables);
  return data.organization.pipelines.edges;
}
```

## Using the REST API Client

The Buildkite REST API client can be used in your own code:

```typescript
import { BuildkiteRestClient } from './services/BuildkiteRestClient';

const restClient = new BuildkiteRestClient('your-api-token');

async function getBuildsForUser(org: string, userId: string) {
  const builds = await restClient.getBuilds(org, {
    creator: userId,
    per_page: '10',
    page: '1'
  });
  
  return builds;
}
```

## API Token

You'll need a Buildkite API token with GraphQL scopes. Create one at:
https://buildkite.com/user/api-access-tokens

## Available GraphQL Queries

The `src/graphql/queries.ts` file contains several pre-defined GraphQL queries:

- `GET_VIEWER`: Get information about the authenticated user
- `GET_ORGANIZATIONS`: List organizations the user belongs to
- `GET_PIPELINES`: List pipelines in an organization
- `GET_BUILDS`: List builds for a pipeline
- `GET_VIEWER_BUILDS`: List builds for the current user

## Available API Endpoints

### GraphQL API
The `src/graphql/queries.ts` file contains several pre-defined GraphQL queries:

- `GET_VIEWER`: Get information about the authenticated user
- `GET_ORGANIZATIONS`: List organizations the user belongs to
- `GET_PIPELINES`: List pipelines in an organization
- `GET_BUILDS`: List builds for a pipeline

### REST API
The `src/services/BuildkiteRestClient.ts` file provides access to the Buildkite REST API endpoints:

- `getBuilds`: Get builds from an organization with filtering options including by creator/user 

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