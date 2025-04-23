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
    
    items.push({
      title: "Keychain",
      subtitle: status.hasToken ? 'Token exists in keychain' : 'No token found',
      icon: {
        path: this.getIcon(status.hasToken)
      },
      valid: false,
      arg: status.hasToken ? 'token:exists' : 'token:missing'
    });
    
    // Add GraphQL API status item
    if (status.hasToken) {
      const graphqlIcon = this.getIcon(status.validation.graphqlValid);
      const graphqlTitle = 'GraphQL API';
      const graphqlSubtitle = status.validation.graphqlValid 
        ? 'Token has GraphQL API access' 
        : 'Token lacks GraphQL API access';
      
      items.push({
        title: graphqlTitle,
        subtitle: graphqlSubtitle,
        icon: {
          path: graphqlIcon
        },
        valid: false, // to indicate if you can select it
        arg: status.validation.graphqlValid ? 'token:graphql:valid' : 'token:graphql:invalid'
      });
      
      // Add Builds REST API status item
      const buildsIcon = this.getIcon(status.validation.buildAccessValid);
      const buildsTitle = 'Builds REST API';
      const buildsSubtitle = status.validation.buildAccessValid 
        ? 'Token has Builds REST API access' 
        : 'Token lacks Builds REST API access';
      
      items.push({
        title: buildsTitle,
        subtitle: buildsSubtitle,
        icon: {
          path: buildsIcon
        },
        valid: false, // to indicate if you can select it
        arg: status.validation.buildAccessValid ? 'token:rest:builds:valid' : 'token:rest:builds:invalid'
      });

      // Add Organization REST API status item
      const orgIcon = this.getIcon(status.validation.orgAccessValid);
      const orgTitle = 'Organization REST API';
      const orgSubtitle = status.validation.orgAccessValid 
        ? 'Token has Organization REST API access' 
        : 'Token lacks Organization REST API access';
      
      items.push({
        title: orgTitle,
        subtitle: orgSubtitle,
        icon: {
          path: orgIcon
        },
        valid: false, // not selectable
      });

      items.push(this.buildStoreItem());
      items.push(this.buildResetItem());
    } else {
      items.push(this.buildStoreItem());
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
    const icon = this.getIcon(success && hadToken);
    
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
    const icon = this.getIcon(false);
    
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
    const icon = this.getIcon(isValid);
    
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
            path: this.getIcon(false)
          },
          arg: `token:error:${operation}`
        }
      ]
    });
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

  private getIcon(valid: boolean): string {
    return valid ? 'icons/passed.png' : 'icons/failed.png';
  }

  private buildStoreItem(): any {
    return {
      title: 'Update Token',
      subtitle: 'Update the token in the keychain',
      icon: {
        path: 'icons/update.png'
      },
      arg: 'token:store'
    };
  }

  private buildResetItem(): any {
    return {
      title: 'Delete Token',
      subtitle: 'Delete the token from the keychain',
      icon: {
        path: 'icons/delete.png'
      },
      arg: 'token:reset'
    };
  }
} 