# Development Guide

## Running the CLI

The CLI can be run in several ways:

```bash
# Regular development mode
npm run dev -- <command> [options]

# With source maps and improved error handling
npm run dev:sourcemap -- <command> [options]

# Compiled mode with source maps (recommended for debugging)
npm run dev:compiled -- <command> [options]
```

## Error Handling Improvements

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

## Common Commands

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