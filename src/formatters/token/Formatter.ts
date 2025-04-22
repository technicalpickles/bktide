import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { logger } from '../../services/logger.js';
import { TokenStatus, TokenValidationStatus } from '../../types/credentials.js';

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
   * @param status The token status information
   * @param options Formatting options
   * @returns Formatted token status message
   */
  formatTokenStatus(status: TokenStatus): string;

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
   * @param validation The validation status for each API
   * @param options Formatting options
   * @returns Formatted token validation error message
   */
  formatTokenValidationError(
    validation: TokenValidationStatus,
    options?: TokenFormatterOptions
  ): string;

  /**
   * Format token validation status
   * @param validation The validation status for each API
   * @param options Formatting options
   * @returns Formatted token validation status message
   */
  formatTokenValidationStatus(
    validation: TokenValidationStatus,
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
    status: TokenStatus,
    options?: TokenFormatterOptions
  ): string;

  abstract formatTokenStorageResult(success: boolean, options?: TokenFormatterOptions): string;

  abstract formatTokenResetResult(success: boolean, hadToken: boolean, options?: TokenFormatterOptions): string;

  abstract formatTokenValidationError(
    validation: TokenValidationStatus,
    options?: TokenFormatterOptions
  ): string;

  abstract formatTokenValidationStatus(
    validation: TokenValidationStatus,
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