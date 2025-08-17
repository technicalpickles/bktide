// Avoid importing native module eagerly; import lazily when needed
import type { Entry } from '@napi-rs/keyring';
import { logger } from './logger.js';
import { BuildkiteClient } from './BuildkiteClient.js';
import { BuildkiteRestClient } from './BuildkiteRestClient.js';
import { TokenValidationStatus, OrganizationValidationStatus } from '../types/credentials.js';
import { isRunningInAlfred } from '../utils/alfred.js';
import { Progress } from '../ui/progress.js';

const SERVICE_NAME = 'bktide';
const ACCOUNT_KEY = 'default';

/**
 * Manages secure storage of credentials using the system's keychain
 */
export class CredentialManager {
  private entry: Entry | undefined;

  constructor(serviceName = SERVICE_NAME, accountName = ACCOUNT_KEY) {
    // Do not load keyring when running under Alfred
    if (!isRunningInAlfred()) {
      // Lazy init via dynamic import to avoid resolving native module in Alfred context
      // Note: constructor remains sync; actual instantiation is deferred in ensureEntry
      void this.ensureEntry(serviceName, accountName);
    }
  }

  private async ensureEntry(serviceName = SERVICE_NAME, accountName = ACCOUNT_KEY): Promise<Entry | undefined> {
    if (this.entry) return this.entry;
    if (isRunningInAlfred()) return undefined;
    try {
      const keyring = await import('@napi-rs/keyring');
      this.entry = new keyring.Entry(serviceName, accountName) as Entry;
      return this.entry;
    } catch (error) {
      logger.debug('Failed to initialize keyring Entry, continuing without keychain', error);
      this.entry = undefined;
      return undefined;
    }
  }

  /**
   * Stores a token in the system keychain
   * @param token The Buildkite API token to store
   * @returns true if token was successfully stored
   */
  async saveToken(token: string): Promise<boolean> {
    if (isRunningInAlfred()) {
      // In Alfred path, we do not persist tokens programmatically
      throw new Error('In Alfred, set token via Workflow Configuration (User Configuration).');
    }
    try {
      const entry = await this.ensureEntry();
      if (!entry) throw new Error('Keyring unavailable');
      await entry.setPassword(token);
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
    // Alfred: use env var only
    if (isRunningInAlfred()) {
      return process.env.BUILDKITE_API_TOKEN || process.env.BK_TOKEN || undefined;
    }
    try {
      const entry = await this.ensureEntry();
      if (!entry) return undefined;
      const token = entry.getPassword();
      return token || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Deletes the stored token from the system keychain
   * @returns true if token was successfully deleted
   */
  async deleteToken(): Promise<boolean> {
    if (isRunningInAlfred()) {
      // Nothing to delete in keyring under Alfred
      return true;
    }
    try {
      const entry = await this.ensureEntry();
      if (!entry) return false;
      await entry.deletePassword();
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
   * @param options Optional configuration for progress display
   * @returns Object containing validation status for both GraphQL and REST APIs
   */
  async validateToken(token?: string, options?: { format?: string; showProgress?: boolean }): Promise<TokenValidationStatus> {
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
      const graphqlClient = new BuildkiteClient(tokenToValidate, { debug: false, caching: false });
      const restClient = new BuildkiteRestClient(tokenToValidate, { debug: false });
      
      // First check if we can list organizations
      let orgSlugs: string[] = [];
      try {
        orgSlugs = await graphqlClient.getOrganizations().then(orgs => orgs.map(org => org.slug));
        logger.debug('Successfully retrieved organization slugs');
      } catch (error) {
        logger.debug('Failed to retrieve organization slugs', {
          error: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error && error.cause ? error.cause : undefined
        });
        return { 
          valid: false, 
          canListOrganizations: false,
          organizations: {} 
        };
      }

      const organizations: Record<string, OrganizationValidationStatus> = {};
      let allValid = true;

      // Determine if we should show progress
      const showProgress = options?.showProgress !== false && 
                          !isRunningInAlfred() && 
                          orgSlugs.length > 0;
      
      const progress = showProgress ? Progress.bar({
        total: orgSlugs.length * 3,
        label: 'Validating token access',
        format: options?.format
      }) : null;

      let checkCount = 0;

      // Validate each organization
      for (const orgSlug of orgSlugs) {
        const orgStatus: OrganizationValidationStatus = {
          graphql: false,
          builds: false,
          organizations: false
        };

        // Check GraphQL access
        if (progress) {
          progress.update(checkCount++, `Checking GraphQL access for ${orgSlug}`);
        }
        try {
          await graphqlClient.getViewer();
          orgStatus.graphql = true;
        } catch (error) {
          logger.debug(`GraphQL validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        // Check build access
        if (progress) {
          progress.update(checkCount++, `Checking build access for ${orgSlug}`);
        }
        try {
          await restClient.hasBuildAccess(orgSlug);
          orgStatus.builds = true;
        } catch (error) {
          logger.debug(`Build access validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        // Check organization access
        if (progress) {
          progress.update(checkCount++, `Checking organization access for ${orgSlug}`);
        }
        try {
          await restClient.hasOrganizationAccess(orgSlug);
          orgStatus.organizations = true;
        } catch (error) {
          logger.debug(`Organization access validation failed for organization ${orgSlug}`, error);
          allValid = false;
        }

        organizations[orgSlug] = orgStatus;
      }

      // Complete the progress bar
      if (progress) {
        const successCount = Object.values(organizations)
          .filter(org => org.graphql && org.builds && org.organizations)
          .length;
        progress.complete(`✓ Validated ${orgSlugs.length} organizations (${successCount} fully accessible)`);
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