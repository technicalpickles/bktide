import { TokenStatus, TokenValidationStatus } from '../../types/credentials.js';
import { isRunningInAlfred } from '../../utils/alfred.js';
import { BaseTokenFormatter } from './Formatter.js';

interface AlfredItem {
  title: string;
  subtitle: string;
  icon: string;
  arg: string;
}

/**
 * Alfred formatter for tokens
 */
export class AlfredFormatter extends BaseTokenFormatter {
  name = 'alfred';

  /**
   * Format token status information for Alfred
   * 
   * @param status The token status information
   * @returns Formatted token status message for Alfred
   */
  formatTokenStatus(status: TokenStatus): string {
    const items = this.formatTokenStatusAsItems(status);
    return JSON.stringify({ items });
  }

  /**
   * Format token storage result for Alfred
   * 
   * @param success Whether the token was successfully stored
   * @returns Formatted token storage result message for Alfred
   */
  formatTokenStorageResult(success: boolean): string {
    const items: AlfredItem[] = [{
      title: success ? 'Token Stored Successfully' : 'Failed to Store Token',
      subtitle: success ? 'Token was saved to system keychain' : 'Could not save token to system keychain',
      icon: this.getIcon(success),
      arg: success ? 'token:stored' : 'token:store-failed'
    }];
    return JSON.stringify({ items });
  }

  /**
   * Format token reset result for Alfred
   * 
   * @param success Whether the token was successfully reset
   * @param hadToken Whether there was a token before reset
   * @returns Formatted token reset result message for Alfred
   */
  formatTokenResetResult(success: boolean, hadToken: boolean): string {
    const items: AlfredItem[] = [{
      title: success ? 'Token Reset Successfully' : 'Failed to Reset Token',
      subtitle: success 
        ? hadToken 
          ? 'Token was removed from system keychain' 
          : 'No token was present to reset'
        : 'Could not remove token from system keychain',
      icon: this.getIcon(success),
      arg: success ? 'token:reset' : 'token:reset-failed'
    }];
    return JSON.stringify({ items });
  }

  /**
   * Format token validation error for Alfred
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation error message for Alfred
   */
  formatTokenValidationError(validation: TokenValidationStatus): string {
    const items = this.formatTokenValidationStatusAsItems(validation);
    return JSON.stringify({ items });
  }

  /**
   * Format token validation status for Alfred
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation status message for Alfred
   */
  formatTokenValidationStatus(validation: TokenValidationStatus): string {
    const items = this.formatTokenValidationStatusAsItems(validation);
    return JSON.stringify({ items });
  }

  /**
   * Format error message(s) for Alfred
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred, or an array of errors
   * @returns Formatted error message(s) for Alfred
   */
  formatError(operation: string, error: unknown | unknown[]): string {
    const errors = Array.isArray(error) ? error : [error];
    const items: AlfredItem[] = errors.map(err => ({
      title: `Error during ${operation}`,
      subtitle: err instanceof Error ? err.message : String(err),
      icon: this.getIcon(false),
      arg: `error:${operation}`
    }));
    return JSON.stringify({ items });
  }

  /**
   * Format authentication error message(s) for Alfred
   * 
   * @param operation The authentication operation that failed (e.g., 'storing', 'validating')
   * @param error The authentication error that occurred, or an array of errors
   * @returns Formatted authentication error message(s) for Alfred
   */
  formatAuthErrors(operation: string, error: unknown | unknown[]): string {
    const errors = Array.isArray(error) ? error : [error];
    const items: AlfredItem[] = errors.map(err => ({
      title: `Authentication Error during ${operation}`,
      subtitle: err instanceof Error ? err.message : String(err),
      icon: this.getIcon(false),
      arg: `auth-error:${operation}`
    }));
    return JSON.stringify({ items });
  }

  private getIcon(isValid: boolean): string {
    return isValid ? '✅' : '❌';
  }

  private formatTokenStatusAsItems(status: TokenStatus): AlfredItem[] {
    const items: AlfredItem[] = [];
    
    const inAlfred = isRunningInAlfred();

    // Alfred-first UX: if no token, present actionable item to open config
    if (inAlfred && !status.hasToken) {
      items.push({
        title: 'Set Buildkite token',
        subtitle: 'Open Workflow Configuration to set BUILDKITE_API_TOKEN',
        icon: 'icons/info.png',
        arg: 'alfred:open-config'
      });
    }

    // Add token status item with context-aware subtitle
    items.push({
      title: `Token Status: ${status.hasToken ? 'Present' : 'Not Present'}`,
      subtitle: status.hasToken
        ? (inAlfred ? 'Token provided via Workflow Configuration' : 'Token is stored in system keychain')
        : (inAlfred ? 'No token set in Workflow Configuration' : 'No token found in system keychain'),
      icon: this.getIcon(status.hasToken),
      arg: status.hasToken ? 'token:present' : 'token:not-present'
    });

    if (status.hasToken) {
      // Add overall validity item
      items.push({
        title: `Valid: ${status.isValid ? 'Yes' : 'No'}`,
        subtitle: status.isValid ? 'Token is valid for all required APIs' : 'Token has limited access',
        icon: this.getIcon(status.isValid),
        arg: status.isValid ? 'token:valid' : 'token:invalid'
      });

      if (status.validation.canListOrganizations) {
        // Add organization status items
        Object.entries(status.validation.organizations).forEach(([org, orgStatus]) => {
          const isValid = orgStatus.graphql && orgStatus.builds && orgStatus.organizations;
          const invalidApis = [];
          if (!orgStatus.graphql) invalidApis.push('GraphQL');
          if (!orgStatus.builds) invalidApis.push('Builds');
          if (!orgStatus.organizations) invalidApis.push('Organizations');
          
          items.push({
            title: `Organization: ${org}`,
            subtitle: isValid 
              ? 'Full access to all APIs'
              : `Limited access: ${invalidApis.join(', ')}`,
            icon: this.getIcon(isValid),
            arg: isValid ? `org:${org}:valid` : `org:${org}:invalid`
          });
        });
      } else {
        items.push({
          title: 'Cannot list organizations',
          subtitle: 'Token may be invalid or lacks necessary permissions',
          icon: this.getIcon(false),
          arg: 'token:no-org-access'
        });
      }
    }

    return items;
  }

  private formatTokenValidationStatusAsItems(validation: TokenValidationStatus): AlfredItem[] {
    const items: AlfredItem[] = [];

    if (!validation.canListOrganizations) {
      items.push({
        title: 'Cannot list organizations',
        subtitle: 'Token may be invalid or lacks necessary permissions',
        icon: this.getIcon(false),
        arg: 'token:no-org-access'
      });
      return items;
    }

    // Add organization status items
    Object.entries(validation.organizations).forEach(([org, orgStatus]) => {
      const isValid = orgStatus.graphql && orgStatus.builds && orgStatus.organizations;
      const invalidApis = [];
      if (!orgStatus.graphql) invalidApis.push('GraphQL');
      if (!orgStatus.builds) invalidApis.push('Builds');
      if (!orgStatus.organizations) invalidApis.push('Organizations');
      
      items.push({
        title: `Organization: ${org}`,
        subtitle: isValid 
          ? 'Full access to all APIs'
          : `Limited access: ${invalidApis.join(', ')}`,
        icon: this.getIcon(isValid),
        arg: isValid ? `org:${org}:valid` : `org:${org}:invalid`
      });
    });

    return items;
  }
} 