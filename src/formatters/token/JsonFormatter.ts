import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';
import { TokenStatus, TokenValidationStatus } from '../../types/credentials.js';

/**
 * JSON formatter for tokens
 */
export class JsonFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'json';

  /**
   * Format token status information as JSON
   * 
   * @param status The token status information
   * @returns Formatted token status message as JSON string
   */
  formatTokenStatus(status: TokenStatus): string {
    const result = {
      ...status,
      message: this.getStatusMessage(status)
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Format token storage result as JSON
   * 
   * @param success Whether the token was successfully stored
   * @returns Formatted token storage result message as JSON string
   */
  formatTokenStorageResult(success: boolean): string {
    const result = {
      success,
      message: success 
        ? 'Token successfully stored in system keychain' 
        : 'Failed to store token'
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Format token reset result as JSON
   * 
   * @param success Whether the token was successfully reset
   * @param hadToken Whether there was a token before reset
   * @returns Formatted token reset result message as JSON string
   */
  formatTokenResetResult(success: boolean, hadToken: boolean): string {
    const result = {
      success,
      hadToken,
      message: this.getResetMessage(success, hadToken)
    };

    return JSON.stringify(result, null, 2);
  }

  /**
   * Format token validation error as JSON
   * 
   * @param validation The validation status for each API
   * @param options Formatting options
   * @returns Formatted token validation error message as JSON string
   */
  formatTokenValidationError(
    validation: TokenValidationStatus
  ): string {
    const error = {
      ...validation,
      message: this.getValidationErrorMessage(validation)
    };

    return JSON.stringify(error, null, 2);
  }

  /**
   * Format token validation status as JSON
   * 
   * @param validation The validation status for each API
   * @param options Formatting options
   * @returns Formatted token validation status message as JSON string
   */
  formatTokenValidationStatus(
    validation: TokenValidationStatus
  ): string {
    const status = {
      ...validation,
      isValid: validation.graphqlValid && validation.restValid,
      message: this.getValidationStatusMessage(validation)
    };

    return JSON.stringify(status, null, 2);
  }

  /**
   * Format general error message as JSON
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred
   * @returns Formatted error message as JSON string
   */
  formatError(
    operation: string,
    error: unknown
  ): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorObject = {
      operation,
      error: errorMessage,
      message: `Error ${operation} token: ${errorMessage}`
    };

    return JSON.stringify(errorObject, null, 2);
  }

  /**
   * Get a human-readable status message based on token status
   */
  private getStatusMessage(status: TokenStatus): string {
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
   * Get a human-readable reset message based on reset result
   */
  private getResetMessage(success: boolean, hadToken: boolean): string {
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
   * Get a human-readable validation error message
   */
  private getValidationErrorMessage(validation: TokenValidationStatus): string {
    if (!validation.graphqlValid && !validation.restValid) {
      return 'Token is invalid for both GraphQL and REST APIs';
    } else if (!validation.graphqlValid) {
      return 'Token is valid for REST API but not for GraphQL API';
    } else {
      return 'Token is valid for GraphQL API but not for REST API';
    }
  }

  /**
   * Get a human-readable validation status message
   */
  private getValidationStatusMessage(validation: TokenValidationStatus): string {
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
} 