# Typed GraphQL Client for Buildkite API

This project includes a strongly-typed GraphQL client for the Buildkite API. Initially, we attempted to use GraphQL Code Generator to automate the type generation, but due to compatibility issues, we've manually defined the type interfaces.

## Manual Type Definitions

Instead of using GraphQL Codegen, we've manually defined TypeScript interfaces in `src/services/BuildkiteClient.ts` for each query:

- `GetViewerQuery` 
- `GetOrganizationsQuery`
- `GetPipelinesQuery` and `GetPipelinesQueryVariables`
- `GetBuildsQuery` and `GetBuildsQueryVariables`
- `GetViewerBuildsQuery` and `GetViewerBuildsQueryVariables`

These interfaces match the expected responses from the Buildkite GraphQL API and provide strong typing for the client.

## Using the Typed Methods

The BuildkiteClient has been enhanced with typed methods that provide TypeScript type safety:

- `getViewerTyped()`
- `getOrganizationsTyped()`
- `getPipelinesTyped(organizationSlug, first?, after?)`
- `getBuildsTyped(pipelineSlug, organizationSlug, first?)`
- `getViewerBuildsTyped(first)`

These methods use the same GraphQL queries as the original methods but with strong type safety.

## Benefits

Using the typed methods provides several advantages:

1. **Type Safety**: All GraphQL operations are fully typed, preventing type errors.
2. **Auto-completion**: The IDE will suggest available fields and proper types.
3. **Error Prevention**: Type mismatches are caught at compile time, not runtime.

## Examples

Using the typed methods:

```typescript
// Get organizations with full type safety
const organizations = await client.getOrganizationsTyped();

// TypeScript knows the structure of the response
const orgNames = organizations.viewer.organizations.edges.map(
  edge => edge.node.name
);

// Get builds with typed parameters
const builds = await client.getBuildsTyped(
  "my-pipeline", 
  "my-organization", 
  10
);
```

## Migrating Existing Code

To migrate existing code to use the typed methods:

1. Identify places where `client.query()` is called with raw GraphQL strings
2. Replace them with the corresponding typed method calls
3. Update any type assertions to use the defined interfaces

## Future Improvements

If needed in the future, we can revisit the GraphQL Code Generator approach by:

1. Fixing the compatibility issues with our current setup
2. Using a different tool or approach for automatic type generation
3. Keeping the manually defined interfaces updated with any API changes

For now, the manual interfaces provide a clean and effective way to get strong typing for the Buildkite GraphQL API. 