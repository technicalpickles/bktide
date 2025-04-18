# Alfred Buildkite CLI

A command-line tool for interacting with Buildkite's GraphQL API.

## Installation

```bash
npm install
```

## Running the CLI

You can run the CLI in two ways:

### Development Mode (using ts-node)

Run the CLI directly from TypeScript source without compiling:

```bash
npm run dev -- [command] [options]
```

For example:
```bash
npm run dev -- viewer
npm run dev -- orgs
npm run dev -- pipelines --org your-org-slug
```

### Production Mode (compiled)

First build the project, then run the compiled JavaScript:

```bash
npm run build
npm run start -- [command] [options]
```

## Authentication

You can authenticate with Buildkite in two ways:

1. Using the `--token` option with each command:
   ```bash
   npm run dev -- viewer --token YOUR_BUILDKITE_API_TOKEN
   ```

2. Setting the `BK_TOKEN` environment variable:
   ```bash
   export BK_TOKEN=YOUR_BUILDKITE_API_TOKEN
   npm run dev -- viewer
   ```

## Caching

This CLI implements disk-based caching to improve performance, particularly for repeated queries. Cached data is stored in the `~/.alfred-buildkite/cache/` directory.

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

### View Your Login Information

```bash
npm run dev -- viewer
```

### List Your Organizations

```bash
npm run dev -- orgs
```

### List Pipelines in an Organization

```bash
npm run dev -- pipelines --org your-org-slug
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