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
   * @param options Formatting options
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
} 