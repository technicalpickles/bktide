import { Entry } from '@napi-rs/keyring';
import { logger } from './logger.js';

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
} 