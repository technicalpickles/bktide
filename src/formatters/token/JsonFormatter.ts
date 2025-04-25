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
      isValid: validation.valid,
      message: this.getValidationStatusMessage(validation)
    };

    return JSON.stringify(status, null, 2);
  }

  /**
   * Format error message(s) as JSON
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred, or an array of errors
   * @returns Formatted error message(s) as JSON string
   */
  formatError(
    operation: string,
    error: unknown | unknown[]
  ): string {
    const errors = Array.isArray(error) ? error : [error];
    const errorObjects = errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        operation,
        error: errorMessage,
        message: `Error ${operation} token: ${errorMessage}`
      };
    });

    return JSON.stringify(errorObjects, null, 2);
  }

  /**
   * Format authentication error message(s) as JSON
   * 
   * @param operation The authentication operation that failed (e.g., 'storing', 'validating')
   * @param error The authentication error that occurred, or an array of errors
   * @returns Formatted authentication error message(s) as JSON string
   */
  formatAuthErrors(
    operation: string,
    error: unknown | unknown[]
  ): string {
    const errors = Array.isArray(error) ? error : [error];
    const errorObjects = errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        operation,
        error: errorMessage,
        message: `Authentication error ${operation} token: ${errorMessage}`,
        suggestion: 'Please check your token permissions and try again'
      };
    });

    return JSON.stringify(errorObjects, null, 2);
  }

  /**
   * Format multiple error messages as JSON
   * 
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param errors Array of errors that occurred
   * @returns Formatted error messages as JSON string
   */
  formatErrors(
    operation: string,
    errors: unknown[]
  ): string {
    const errorObjects = errors.map(error => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        operation,
        error: errorMessage,
        message: `Error ${operation} token: ${errorMessage}`
      };
    });

    return JSON.stringify(errorObjects, null, 2);
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
} 