import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';

/**
 * Alfred formatter for tokens
 */
export class AlfredFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'alfred';

  /**
   * Format token status information for Alfred
   * 
   * @param hasToken Whether a token exists
   * @param isValid Whether the token is valid
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token status message for Alfred
   */
  formatTokenStatus(
    hasToken: boolean,
    isValid: boolean,
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    const message = this.getStatusMessage(hasToken, isValid, graphqlValid, restValid);
    const icon = this.getStatusIcon(hasToken, isValid);
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: hasToken ? 'Token exists in keychain' : 'No token found',
          icon: {
            path: icon
          },
          arg: hasToken ? 'token:exists' : 'token:missing'
        }
      ]
    });
  }

  /**
   * Format token storage result for Alfred
   * 
   * @param success Whether the token was successfully stored
   * @returns Formatted token storage result message for Alfred
   */
  formatTokenStorageResult(success: boolean): string {
    const message = success 
      ? 'Token successfully stored in system keychain' 
      : 'Failed to store token';
    
    const icon = success ? 'checkmark' : 'xmark';
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: success ? 'Token is now available for use' : 'Please try again',
          icon: {
            path: icon
          },
          arg: success ? 'token:stored' : 'token:store-failed'
        }
      ]
    });
  }

  /**
   * Format token reset result for Alfred
   * 
   * @param success Whether the token was successfully reset
   * @param hadToken Whether there was a token before reset
   * @returns Formatted token reset result message for Alfred
   */
  formatTokenResetResult(success: boolean, hadToken: boolean): string {
    const message = this.getResetMessage(success, hadToken);
    const icon = success ? 'checkmark' : 'xmark';
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: hadToken 
            ? (success ? 'Token has been removed' : 'Token could not be removed') 
            : 'No token was found',
          icon: {
            path: icon
          },
          arg: success ? 'token:reset' : 'token:reset-failed'
        }
      ]
    });
  }

  /**
   * Format token validation error for Alfred
   * 
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token validation error message for Alfred
   */
  formatTokenValidationError(
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    const message = this.getValidationErrorMessage(graphqlValid, restValid);
    const icon = 'xmark';
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: 'Please ensure your token has the necessary permissions for both APIs',
          icon: {
            path: icon
          },
          arg: 'token:invalid'
        }
      ]
    });
  }

  /**
   * Format token validation status for Alfred
   * 
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @returns Formatted token validation status message for Alfred
   */
  formatTokenValidationStatus(
    graphqlValid: boolean,
    restValid: boolean
  ): string {
    const message = this.getValidationStatusMessage(graphqlValid, restValid);
    const icon = graphqlValid && restValid ? 'checkmark' : 'exclamation';
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: graphqlValid && restValid 
            ? 'Token is valid for all operations' 
            : 'Token has limited functionality',
          icon: {
            path: icon
          },
          arg: graphqlValid && restValid ? 'token:valid' : 'token:partially-valid'
        }
      ]
    });
  }

  /**
   * Format general error message for Alfred
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred
   * @returns Formatted error message for Alfred
   */
  formatError(
    operation: string,
    error: unknown
  ): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const message = `Error ${operation} token: ${errorMessage}`;
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: 'An error occurred while managing your token',
          icon: {
            path: 'xmark'
          },
          arg: `token:error:${operation}`
        }
      ]
    });
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

  /**
   * Get the appropriate icon for the token status
   */
  private getStatusIcon(hasToken: boolean, isValid: boolean): string {
    if (!hasToken) {
      return 'xmark';
    }
    
    if (isValid) {
      return 'checkmark';
    }
    
    return 'exclamation';
  }
} 