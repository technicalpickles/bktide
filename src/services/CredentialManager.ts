import { Entry } from '@napi-rs/keyring';
import { logger } from './logger.js';
import { BuildkiteClient } from './BuildkiteClient.js';
import { GET_VIEWER } from '../graphql/queries.js';

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
   * Validates if a token is valid by making a test API call
   * @param token Optional token to validate. If not provided, will use the stored token.
   * @returns true if the token is valid, false otherwise
   */
  async validateToken(token?: string): Promise<boolean> {
    try {
      // If no token provided, try to get the stored one
      const tokenToValidate = token || await this.getToken();
      if (!tokenToValidate) {
        logger.debug('No token provided for validation');
        return false;
      }

      // Create a client with the token
      const client = new BuildkiteClient(tokenToValidate, { debug: false });
      
      // Try to make a simple API call that requires authentication
      await client.query(GET_VIEWER, {});
      
      logger.debug('Token validation successful');
      return true;
    } catch (error) {
      logger.debug('Token validation failed', error);
      return false;
    }
  }
} 