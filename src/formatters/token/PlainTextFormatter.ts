import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';
import { TokenStatus, TokenValidationStatus } from '../../types/credentials.js';
    
/**
 * Plain text formatter for tokens
 */
export class PlainTextFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'plain';

  /**
   * Format token status information in plain text
   * 
   * @param status The token status information
   * @returns Formatted token status message
   */
  formatTokenStatus(status: TokenStatus): string {
    const lines: string[] = [];
    lines.push(`Token Status: ${status.hasToken ? 'Present' : 'Not Present'}`);
    
    if (status.hasToken) {
      lines.push(`Valid: ${status.isValid ? 'Yes' : 'No'}`);
      
      if (status.validation.canListOrganizations) {
        const validOrgs = Object.entries(status.validation.organizations)
          .filter(([_, status]) => status.graphql && status.builds && status.organizations)
          .map(([org]) => org);
        
        if (validOrgs.length > 0) {
          lines.push('Valid Organizations:');
          validOrgs.forEach(org => lines.push(`  - ${org}`));
        }

        const invalidOrgs = Object.entries(status.validation.organizations)
          .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations);
        
        if (invalidOrgs.length > 0) {
          lines.push('Organizations with Limited Access:');
          invalidOrgs.forEach(([org, status]) => {
            const invalidApis = [];
            if (!status.graphql) invalidApis.push('GraphQL');
            if (!status.builds) invalidApis.push('Builds');
            if (!status.organizations) invalidApis.push('Organizations');
            lines.push(`  - ${org} (${invalidApis.join(', ')})`);
          });
        }
      } else {
        lines.push('Cannot list organizations - token may be invalid');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Format token storage result in plain text
   * 
   * @param success Whether the token was successfully stored
   * @returns Formatted token storage result message
   */
  formatTokenStorageResult(success: boolean): string {
    if (success) {
      return 'Token successfully stored in system keychain';
    } else {
      return 'Failed to store token';
    }
  }

  /**
   * Format token reset result in plain text
   * 
   * @param success Whether the token was successfully reset
   * @param hadToken Whether there was a token before reset
   * @returns Formatted token reset result message
   */
  formatTokenResetResult(success: boolean, hadToken: boolean): string {
    if (!hadToken) {
      return 'No token found in system keychain';
    }

    if (success) {
      return 'Token successfully deleted from system keychain';
    } else {
      return 'Failed to delete token';
    }
  }

  /**
   * Format token validation error in plain text
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation error message
   */
  formatTokenValidationError(
    validation: TokenValidationStatus
  ): string {
    if (!validation.canListOrganizations) {
      return 'Token is invalid or does not have access to list organizations';
    }

    const invalidOrgs = Object.entries(validation.organizations)
      .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations)
      .map(([org, status]) => {
        const invalidApis = [];
        if (!status.graphql) invalidApis.push('GraphQL');
        if (!status.builds) invalidApis.push('Builds');
        if (!status.organizations) invalidApis.push('Organizations');
        return `${org} (${invalidApis.join(', ')})`;
      });

    if (invalidOrgs.length === 0) {
      return 'Token is valid for all organizations';
    }

    return `Token has limited access in some organizations: ${invalidOrgs.join(', ')}`;
  }

  /**
   * Format token validation status in plain text
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation status message
   */
  formatTokenValidationStatus(validation: TokenValidationStatus): string {
    if (!validation.canListOrganizations) {
      return 'Token is invalid or does not have access to list organizations';
    }

    const lines: string[] = [];
    const validOrgs = Object.entries(validation.organizations)
      .filter(([_, status]) => status.graphql && status.builds && status.organizations)
      .map(([org]) => org);
    
    if (validOrgs.length > 0) {
      lines.push('Valid Organizations:');
      validOrgs.forEach(org => lines.push(`  - ${org}`));
    }

    const invalidOrgs = Object.entries(validation.organizations)
      .filter(([_, status]) => !status.graphql || !status.builds || !status.organizations);
    
    if (invalidOrgs.length > 0) {
      lines.push('Organizations with Limited Access:');
      invalidOrgs.forEach(([org, status]) => {
        const invalidApis = [];
        if (!status.graphql) invalidApis.push('GraphQL');
        if (!status.builds) invalidApis.push('Builds');
        if (!status.organizations) invalidApis.push('Organizations');
        lines.push(`  - ${org} (${invalidApis.join(', ')})`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Format error message(s) in plain text
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred, or an array of errors
   * @returns Formatted error message(s)
   */
  formatError(
    operation: string,
    error: unknown | unknown[]
  ): string {
    const errors = Array.isArray(error) ? error : [error];
    return errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error ${operation} token: ${errorMessage}`;
    }).join('\n');
  }

  /**
   * Format authentication error message(s) in plain text
   * 
   * @param operation The authentication operation that failed (e.g., 'storing', 'validating')
   * @param error The authentication error that occurred, or an array of errors
   * @returns Formatted authentication error message(s)
   */
  formatAuthErrors(
    operation: string,
    error: unknown | unknown[]
  ): string {
    const errors = Array.isArray(error) ? error : [error];
    return errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Authentication error ${operation} token: ${errorMessage}\nPlease check your token permissions and try again`;
    }).join('\n\n');
  }

  /**
   * Format multiple error messages in plain text
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param errors Array of errors that occurred
   * @returns Formatted error messages
   */
  formatErrors(
    operation: string,
    errors: unknown[]
  ): string {
    return errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Error ${operation} token: ${errorMessage}`;
    }).join('\n');
  }
} 