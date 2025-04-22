import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';
    
/**
 * Plain text formatter for tokens
 */
export class PlainTextFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'plain';

  /**
   * Format token status information in plain text
   * 
   * @param hasToken Whether a token exists
   * @param isValid Whether the token is valid
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token status message
   */
  formatTokenStatus(
    hasToken: boolean,
    isValid: boolean,
    graphqlValid: boolean,
    restValid: boolean,
  ): string {
    if (!hasToken) {
      return 'No token found in system keychain';
    }

    if (isValid) {
      return 'Token is valid for both GraphQL and REST APIs';
    }

    if (graphqlValid && !restValid) {
      return 'Token is valid for GraphQL API but not for REST API';
    }

    if (!graphqlValid && restValid) {
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
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token validation error message
   */
  formatTokenValidationError(
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    if (!graphqlValid && !restValid) {
      return 'Token is invalid for both GraphQL and REST APIs';
    } else if (!graphqlValid) {
      return 'Token is valid for REST API but not for GraphQL API';
    } else {
      return 'Token is valid for GraphQL API but not for REST API';
    }
  }

  /**
   * Format token validation status in plain text
   * 
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token validation status message
   */
  formatTokenValidationStatus(
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    if (graphqlValid && restValid) {
      return 'Token is valid for both GraphQL and REST APIs';
    } else if (graphqlValid) {
      return 'Token is valid for GraphQL API but not for REST API';
    } else if (restValid) {
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