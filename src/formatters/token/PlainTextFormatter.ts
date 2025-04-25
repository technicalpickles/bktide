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
    if (!status.hasToken) {
      return 'No token found in system keychain';
    }

    if (status.isValid) {
      return 'Token is valid for GraphQL and both REST APIs';
    }

    const validApis = [];
    if (status.validation.graphqlValid) validApis.push('GraphQL');
    if (status.validation.buildAccessValid) validApis.push('Builds REST');
    if (status.validation.orgAccessValid) validApis.push('Organization REST');

    if (validApis.length === 0) {
      return 'Token is invalid for all APIs';
    }

    return `Token is valid for ${validApis.join(', ')} API${validApis.length > 1 ? 's' : ''}`;
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
    const invalidApis = [];
    if (!validation.graphqlValid) invalidApis.push('GraphQL');
    if (!validation.buildAccessValid) invalidApis.push('Builds REST');
    if (!validation.orgAccessValid) invalidApis.push('Organization REST');

    if (invalidApis.length === 0) {
      return 'Token is valid for all APIs';
    }

    return `Token is invalid for ${invalidApis.join(', ')} API${invalidApis.length > 1 ? 's' : ''}`;
  }

  /**
   * Format token validation status in plain text
   * 
   * @param validation The validation status for each API
   * @returns Formatted token validation status message
   */
  formatTokenValidationStatus(
    validation: TokenValidationStatus
  ): string {
    const validApis = [];
    if (validation.graphqlValid) validApis.push('GraphQL');
    if (validation.buildAccessValid) validApis.push('Builds REST');
    if (validation.orgAccessValid) validApis.push('Organization REST');

    if (validApis.length === 0) {
      return 'Token is invalid for all APIs';
    }

    if (validApis.length === 3) {
      return 'Token is valid for all APIs';
    }

    return `Token is valid for ${validApis.join(', ')} API${validApis.length > 1 ? 's' : ''}`;
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