# Alfred Buildkite CLI

A command-line tool for interacting with Buildkite's GraphQL API.

## Installation

```bash
npm install
npm run build
```

## Authentication

You can authenticate with Buildkite in two ways:

1. Using the `--token` option with each command:
   ```bash
   node dist/index.js viewer --token YOUR_BUILDKITE_API_TOKEN
   ```

2. Setting the `BK_TOKEN` environment variable:
   ```bash
   export BK_TOKEN=YOUR_BUILDKITE_API_TOKEN
   node dist/index.js viewer
   ```

## Usage

### View Your Login Information

```bash
node dist/index.js viewer
```

### List Your Organizations

```bash
node dist/index.js orgs
```

### List Pipelines in an Organization

```bash
node dist/index.js pipelines --org your-org-slug
```

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

## API Token

You'll need a Buildkite API token with GraphQL scopes. Create one at:
https://buildkite.com/user/api-access-tokens

## Available GraphQL Queries

The `src/graphql/queries.ts` file contains several pre-defined GraphQL queries:

- `GET_VIEWER`: Get information about the authenticated user
- `GET_ORGANIZATIONS`: List organizations the user belongs to
- `GET_PIPELINES`: List pipelines in an organization
- `GET_BUILDS`: List builds for a pipeline 