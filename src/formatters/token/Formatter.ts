import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Additional options specific to token formatting
 */
export interface TokenFormatterOptions extends FormatterOptions {
  // Add any token-specific options here
}

/**
 * Interface for token formatters
 */
export interface TokenFormatter extends BaseFormatterInterface {
  /**
   * Format token status information
   * @param hasToken Whether a token exists
   * @param isValid Whether the token is valid
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @param options Formatting options
   * @returns Formatted token status message
   */
  formatTokenStatus(
    hasToken: boolean,
    isValid: boolean,
    graphqlValid: boolean,
    restValid: boolean
  ): string;

  /**
   * Format token storage result
   * @param success Whether the token was successfully stored
   * @param options Formatting options
   * @returns Formatted token storage result message
   */
  formatTokenStorageResult(success: boolean): string;

  /**
   * Format token reset result
   * @param success Whether the token was successfully reset
   * @param hadToken Whether there was a token before reset
   * @param options Formatting options
   * @returns Formatted token reset result message
   */
  formatTokenResetResult(success: boolean, hadToken: boolean): string;

  /**
   * Format token validation error
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @param options Formatting options
   * @returns Formatted token validation error message
   */
  formatTokenValidationError(
    graphqlValid: boolean,
    restValid: boolean,
    options?: TokenFormatterOptions
  ): string;

  /**
   * Format token validation status
   * @param graphqlValid Whether the token is valid for GraphQL API
   * @param restValid Whether the token is valid for REST API
   * @param options Formatting options
   * @returns Formatted token validation status message
   */
  formatTokenValidationStatus(
    graphqlValid: boolean,
    restValid: boolean,
    options?: TokenFormatterOptions
  ): string;

  /**
   * Format general error message
   * @param operation The operation that failed (e.g., 'storing', 'resetting', 'validating')
   * @param error The error that occurred
   * @param options Formatting options
   * @returns Formatted error message
   */
  formatError(
    operation: string,
    error: unknown,
    options?: TokenFormatterOptions
  ): string;
}

/**
 * Base class for token formatters
 */
export abstract class BaseTokenFormatter implements TokenFormatter {
  abstract name: string;
  
  abstract formatTokenStatus(
    hasToken: boolean,
    isValid: boolean,
    graphqlValid: boolean,
    restValid: boolean,
    options?: TokenFormatterOptions
  ): string;

  abstract formatTokenStorageResult(success: boolean, options?: TokenFormatterOptions): string;

  abstract formatTokenResetResult(success: boolean, hadToken: boolean, options?: TokenFormatterOptions): string;

  abstract formatTokenValidationError(
    graphqlValid: boolean,
    restValid: boolean,
    options?: TokenFormatterOptions
  ): string;

  abstract formatTokenValidationStatus(
    graphqlValid: boolean,
    restValid: boolean,
    options?: TokenFormatterOptions
  ): string;

  abstract formatError(
    operation: string,
    error: unknown,
    options?: TokenFormatterOptions
  ): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 