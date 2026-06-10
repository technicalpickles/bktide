// ESM-compatible GraphQL codegen configuration
import dotenv from 'dotenv';
import { CredentialManager } from './dist/services/CredentialManager.js';

// Load environment variables from .env file
dotenv.config();

// Create a function to get the configuration asynchronously
async function getConfig() {
  const credentialManager = new CredentialManager();
  const token = await credentialManager.getToken();
  
  if (!token) {
    throw new Error('No Buildkite API token found. Please set up your credentials first.');
  }
  
  return {
    schema: {
      'https://graphql.buildkite.com/v1': {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
    documents: ['src/graphql/queries.ts', 'src/graphql/fragments/**/*.ts'],
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
          },
          // Several queries select `createdBy` across the BuildCreator union
          // (User | UnregisteredUser), whose `name`/`email` differ in nullability
          // (String! vs String). graphql's OverlappingFieldsCanBeMerged rejects
          // that even though the selections are inside distinct inline fragments.
          // Validation is disabled so codegen can run; the tradeoff is that a
          // genuinely malformed query now fails against the API at runtime
          // rather than here at generation time.
          skipDocumentsValidation: true,
        }
      }
    },
    ignoreNoDocuments: true,
  };
}

// Export a promise that resolves to the configuration
export default getConfig(); 