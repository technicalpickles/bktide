import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';

/**
 * JSON formatter for tokens
 */
export class JsonFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'json';

  /**
   * Format token status information as JSON
   * 
   * @param hasToken Whether a token exists
   * @param isValid Whether the token is valid
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token status message as JSON string
   */
  formatTokenStatus(
    hasToken: boolean,
    isValid: boolean,
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    const status = {
      hasToken,
      isValid,
      graphqlValid,
      restValid,
      message: this.getStatusMessage(hasToken, isValid, graphqlValid, restValid)
    };

    return JSON.stringify(status, null, 2);
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
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @param options Formatting options
   * @returns Formatted token validation error message as JSON string
   */
  formatTokenValidationError(
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    const error = {
      graphqlValid,
      restValid,
      message: this.getValidationErrorMessage(graphqlValid, restValid)
    };

    return JSON.stringify(error, null, 2);
  }

  /**
   * Format token validation status as JSON
   * 
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @param options Formatting options
   * @returns Formatted token validation status message as JSON string
   */
  formatTokenValidationStatus(
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    const status = {
      graphqlValid,
      restValid,
      isValid: graphqlValid && restValid,
      message: this.getValidationStatusMessage(graphqlValid, restValid)
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
  private getStatusMessage(
    hasToken: boolean,
    isValid: boolean,
    graphqlValid: boolean,
    restValid: boolean
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
  private getValidationErrorMessage(graphqlValid: boolean, restValid: boolean): string {
    if (!graphqlValid && !restValid) {
      return 'Token is invalid for both GraphQL and REST APIs';
    } else if (!graphqlValid) {
      return 'Token is valid for REST API but not for GraphQL API';
    } else {
      return 'Token is valid for GraphQL API but not for REST API';
    }
  }

  /**
   * Get a human-readable validation status message
   */
  private getValidationStatusMessage(graphqlValid: boolean, restValid: boolean): string {
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
} 