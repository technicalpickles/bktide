import { Entry } from '@napi-rs/keyring';
import { logger } from './logger.js';
import { BuildkiteClient } from './BuildkiteClient.js';
import { BuildkiteRestClient } from './BuildkiteRestClient.js';

const SERVICE_NAME = 'bktide';
const ACCOUNT_KEY = 'default';

/**
 * Manages secure storage of credentials using the system's keychain
 */
export class CredentialManager {
  private entry: Entry;

  constructor(serviceName = SERVICE_NAME, accountName = ACCOUNT_KEY) {
    this.entry = new Entry(serviceName, accountName);
  }

  /**
   * Stores a token in the system keychain
   * @param token The Buildkite API token to store
   * @returns true if token was successfully stored
   */
  async saveToken(token: string): Promise<boolean> {
    try {
      await this.entry.setPassword(token);
      logger.debug('Token saved to system keychain');
      return true;
    } catch (error) {
      logger.error('Failed to save token to system keychain', error);
      return false;
    }
  }

  /**
   * Retrieves the stored token from the system keychain
   * @returns The stored token or undefined if not found
   */
  async getToken(): Promise<string | undefined> {
    try {
      const token = await this.entry.getPassword();
      return token || undefined;
    } catch (error) {
      logger.debug('No token found in system keychain', error);
      return undefined;
    }
  }

  /**
   * Deletes the stored token from the system keychain
   * @returns true if token was successfully deleted
   */
  async deleteToken(): Promise<boolean> {
    try {
      await this.entry.deletePassword();
      logger.debug('Token deleted from system keychain');
      return true;
    } catch (error) {
      logger.error('Failed to delete token from system keychain', error);
      return false;
    }
  }

  /**
   * Checks if a token exists in the system keychain
   * @returns true if a token exists
   */
  async hasToken(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  /**
   * Validates if a token is valid by making test API calls to both GraphQL and REST APIs
   * @param token Optional token to validate. If not provided, will use the stored token.
   * @returns Object containing validation status for both GraphQL and REST APIs
   */
  async validateToken(token?: string): Promise<{ graphqlValid: boolean; restValid: boolean }> {
    try {
      // If no token provided, try to get the stored one
      const tokenToValidate = token || await this.getToken();
      if (!tokenToValidate) {
        logger.debug('No token provided for validation');
        return { graphqlValid: false, restValid: false };
      }

      // Create clients with the token
      const graphqlClient = new BuildkiteClient(tokenToValidate, { debug: false });
      const restClient = new BuildkiteRestClient(tokenToValidate, { debug: false });
      
      // Try to make simple API calls that require authentication
      // First check GraphQL API
      let graphqlValid = false;
      try {
        await graphqlClient.getViewer();
        logger.debug('GraphQL API token validation successful');
        graphqlValid = true;
      } catch (error) {
        logger.debug('GraphQL API token validation failed', error);
      }
      
      // Then check REST API
      let restValid = false;
      try {
        // Try to get organizations as a simple REST API test
        await restClient.hasOrganizationAccess('buildkite');
        logger.debug('REST API token validation successful');
        restValid = true;
      } catch (error) {
        logger.debug('REST API token validation failed', error);
      }
      
      logger.debug(`Token validation results: GraphQL=${graphqlValid}, REST=${restValid}`);
      return { graphqlValid, restValid };
    } catch (error) {
      logger.debug('Token validation failed', error);
      return { graphqlValid: false, restValid: false };
    }
  }
} 