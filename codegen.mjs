// ESM-compatible GraphQL codegen configuration
import dotenv from 'dotenv';
import { CredentialManager } from './src/services/CredentialManager.js';

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
}

// Export a promise that resolves to the configuration
export default getConfig(); 