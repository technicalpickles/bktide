// ESM-compatible GraphQL codegen configuration
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default {
  schema: {
    'https://graphql.buildkite.com/v1': {
      headers: {
        Authorization: `Bearer ${process.env.BK_TOKEN}`,
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
        addESModuleExports: true,
        documentMode: 'documentNode',
        importDocumentNodeExternallyFrom: 'graphql-tag',
        scalars: {
          DateTime: 'string',
          ID: 'string'
        }
      }
    }
  },
  ignoreNoDocuments: true,
}; 