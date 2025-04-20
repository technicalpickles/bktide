// Use common module exports for compatibility
/** @type {import('@graphql-codegen/cli').CodegenConfig} */
const config = {
  schema: {
    'https://graphql.buildkite.com/v1': {
      headers: {
        Authorization: `Bearer bkua_8c191fcdd7ccf1186c8df4ae77109085b300376d`, // Using token from .env
      },
    },
  },
  documents: ['src/graphql/queries.ts'],
  generates: {
    './src/graphql/generated/': {
      preset: 'client',
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        rawRequest: true,
        documentMode: 'string',
        skipTypename: false,
        avoidOptionals: true,
        dedupeFragments: true,
      },
    },
  },
};

module.exports = config; 