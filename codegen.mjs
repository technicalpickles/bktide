// ESM-compatible GraphQL codegen configuration
export default {
  schema: {
    'https://graphql.buildkite.com/v1': {
      headers: {
        Authorization: `Bearer bkua_8c191fcdd7ccf1186c8df4ae77109085b300376d`,
      },
    },
  },
  documents: ['src/graphql/queries.ts'],
  generates: {
    './src/graphql/generated/sdk.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request'
      ],
      config: {
        avoidOptionals: false,
        skipTypename: true,
        withHooks: false,
        withComponent: false,
        withHOC: false,
        dedupeFragments: true,
        exportFragmentSpreadSubTypes: true,
        preResolveTypes: true,
        addESModuleExports: true
      }
    }
  },
  ignoreNoDocuments: true,
}; 