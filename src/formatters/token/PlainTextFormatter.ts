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
      return 'Token is valid for both GraphQL and REST APIs';
    }

    if (status.validation.graphqlValid && !status.validation.restValid) {
      return 'Token is valid for GraphQL API but not for REST API';
    }

    if (!status.validation.graphqlValid && status.validation.restValid) {
      return 'Token is valid for REST API but not for GraphQL API';
    }

    return 'Token is invalid for both GraphQL and REST APIs';
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
    if (!validation.graphqlValid && !validation.restValid) {
      return 'Token is invalid for both GraphQL and REST APIs';
    } else if (!validation.graphqlValid) {
      return 'Token is valid for REST API but not for GraphQL API';
    } else {
      return 'Token is valid for GraphQL API but not for REST API';
    }
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
    if (validation.graphqlValid && validation.restValid) {
      return 'Token is valid for both GraphQL and REST APIs';
    } else if (validation.graphqlValid) {
      return 'Token is valid for GraphQL API but not for REST API';
    } else if (validation.restValid) {
      return 'Token is valid for REST API but not for GraphQL API';
    } else {
      return 'Token is invalid for both GraphQL and REST APIs';
    }
  }

  /**
   * Format general error message in plain text
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred
   * @returns Formatted error message
   */
  formatError(
    operation: string,
    error: unknown
  ): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error ${operation} token: ${errorMessage}`;
  }
} 