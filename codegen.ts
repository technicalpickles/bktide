import { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: {
    'https://graphql.buildkite.com/v1': {
      headers: {
        Authorization: `Bearer bkua_8c191fcdd7ccf1186c8df4ae77109085b300376d`,
      },
    },
  },
  documents: ['src/graphql/queries.ts'],
  generates: {
    './src/graphql/generated/': {
      preset: 'client',
    },
    './src/graphql/generated/sdk.ts': {
      plugins: ['typescript-graphql-request'],
      config: {
        rawRequest: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config; 