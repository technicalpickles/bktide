import { BaseTokenFormatter, TokenFormatter } from './Formatter.js';
import { TokenStatus, TokenValidationStatus } from '../../types/credentials.js';

/**
 * Alfred formatter for tokens
 */
export class AlfredFormatter extends BaseTokenFormatter implements TokenFormatter {
  name = 'alfred';

  /**
   * Format token status information for Alfred
   * 
   * @param status The token status information
   * @returns Formatted token status message for Alfred
   */
  formatTokenStatus(status: TokenStatus): string {
    const items = [];
    
    // Add a summary item
    const summaryMessage = this.getStatusMessage(status);
    const summaryIcon = this.getStatusIcon(status.hasToken, status.isValid);
    
    items.push({
      title: summaryMessage,
      subtitle: status.hasToken ? 'Token exists in keychain' : 'No token found',
      icon: {
        path: summaryIcon
      },
      arg: status.hasToken ? 'token:exists' : 'token:missing'
    });
    
    // Add GraphQL API status item
    if (status.hasToken) {
      const graphqlIcon = status.validation.graphqlValid ? 'checkmark' : 'xmark';
      const graphqlTitle = status.validation.graphqlValid 
        ? 'GraphQL API: Valid' 
        : 'GraphQL API: Invalid';
      const graphqlSubtitle = status.validation.graphqlValid 
        ? 'Token has GraphQL API access' 
        : 'Token lacks GraphQL API access';
      
      items.push({
        title: graphqlTitle,
        subtitle: graphqlSubtitle,
        icon: {
          path: graphqlIcon
        },
        arg: status.validation.graphqlValid ? 'token:graphql:valid' : 'token:graphql:invalid'
      });
      
      // Add Builds REST API status item
      const buildsIcon = status.validation.buildAccessValid ? 'checkmark' : 'xmark';
      const buildsTitle = status.validation.buildAccessValid 
        ? 'Builds REST API: Valid' 
        : 'Builds REST API: Invalid';
      const buildsSubtitle = status.validation.buildAccessValid 
        ? 'Token has Builds REST API access' 
        : 'Token lacks Builds REST API access';
      
      items.push({
        title: buildsTitle,
        subtitle: buildsSubtitle,
        icon: {
          path: buildsIcon
        },
        arg: status.validation.buildAccessValid ? 'token:rest:builds:valid' : 'token:rest:builds:invalid'
      });

      // Add Organization REST API status item
      const orgIcon = status.validation.orgAccessValid ? 'checkmark' : 'xmark';
      const orgTitle = status.validation.orgAccessValid 
        ? 'Organization REST API: Valid' 
        : 'Organization REST API: Invalid';
      const orgSubtitle = status.validation.orgAccessValid 
        ? 'Token has Organization REST API access' 
        : 'Token lacks Organization REST API access';
      
      items.push({
        title: orgTitle,
        subtitle: orgSubtitle,
        icon: {
          path: orgIcon
        },
        arg: status.validation.orgAccessValid ? 'token:rest:org:valid' : 'token:rest:org:invalid'
      });
    }
    
    return JSON.stringify({ items });
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
   * @param validation The validation status for each API
   * @returns Formatted token validation error message for Alfred
   */
  formatTokenValidationError(
    validation: TokenValidationStatus
  ): string {
    const message = this.getValidationErrorMessage(validation);
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
   * @param validation The validation status for each API
   * @returns Formatted token validation status message for Alfred
   */
  formatTokenValidationStatus(
    validation: TokenValidationStatus
  ): string {
    const message = this.getValidationStatusMessage(validation);
    const isValid = validation.valid;
    const icon = isValid ? 'checkmark' : 'exclamation';
    
    return JSON.stringify({
      items: [
        {
          title: message,
          subtitle: isValid 
            ? 'Token is valid for all operations' 
            : 'Token has limited functionality',
          icon: {
            path: icon
          },
          arg: isValid ? 'token:valid' : 'token:partially-valid'
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
  private getStatusMessage(status: TokenStatus): string {
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
   * Get a human-readable validation status message
   */
  private getValidationStatusMessage(validation: TokenValidationStatus): string {
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