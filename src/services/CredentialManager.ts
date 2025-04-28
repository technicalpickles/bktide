import { Entry } from '@napi-rs/keyring';
import { logger } from './logger.js';
import { BuildkiteClient } from './BuildkiteClient.js';
import { BuildkiteRestClient } from './BuildkiteRestClient.js';
import { TokenValidationStatus, OrganizationValidationStatus } from '../types/credentials.js';

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
      const token = this.entry.getPassword();
      return token || undefined;
    } catch (error) {
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
  async validateToken(token?: string): Promise<TokenValidationStatus> {
    try {
      // If no token provided, try to get the stored one
      const tokenToValidate = token || await this.getToken();
      if (!tokenToValidate) {
        logger.debug('No token provided for validation');
        return { 
          valid: false, 
          canListOrganizations: false,
          organizations: {} 
        };
      }

      // Create clients with the token
      const graphqlClient = new BuildkiteClient(tokenToValidate, { debug: false });
      const restClient = new BuildkiteRestClient(tokenToValidate, { debug: false });
      
      // First check if we can list organizations
      let orgSlugs: string[] = [];
      try {
        orgSlugs = await graphqlClient.getViewerOrganizationSlugs();
        logger.debug('Successfully retrieved organization slugs');
      } catch (error) {
        logger.debug('Failed to retrieve organization slugs', error);
        return { 
          valid: false, 
          canListOrganizations: false,
          organizations: {} 
        };
      }

      const organizations: Record<string, OrganizationValidationStatus> = {};
      let allValid = true;

      // Validate each organization
      for (const orgSlug of orgSlugs) {
        const orgStatus: OrganizationValidationStatus = {
          graphql: false,
          builds: false,
          organizations: false
        };

        try {
          // Check GraphQL access
          await graphqlClient.getViewer();
          orgStatus.graphql = true;
        } catch (error) {
          logger.debug(`GraphQL validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        try {
          // Check build access
          await restClient.hasBuildAccess(orgSlug);
          orgStatus.builds = true;
        } catch (error) {
          logger.debug(`Build access validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        try {
          // Check organization access
          await restClient.hasOrganizationAccess(orgSlug);
          orgStatus.organizations = true;
        } catch (error) {
          logger.debug(`Organization access validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        organizations[orgSlug] = orgStatus;
      }

      return {
        valid: allValid,
        canListOrganizations: true,
        organizations
      };
    } catch (error) {
      logger.debug('Token validation failed', error);
      return { 
        valid: false, 
        canListOrganizations: false,
        organizations: {} 
      };
    }
  }
}