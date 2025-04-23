import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Additional options specific to error formatting
 */
export interface ErrorFormatterOptions extends FormatterOptions {
  exitOnError?: boolean;
}

interface ApiErrorResponse {
  errors?: Array<{
    message?: string;
    path?: string[];
    locations?: Array<{ line: number; column: number }>;
  }>;
}

interface ApiRequest {
  url?: string;
  method?: string;
}

/**
 * Interface for error formatters
 */
export interface ErrorFormatter extends BaseFormatterInterface {
  /**
   * Format one or more errors for display
   * @param errors The error(s) to format
   * @param options Formatting options
   * @returns Formatted error message
   */
  formatError(errors: unknown | unknown[], options?: ErrorFormatterOptions): string;
}

/**
 * Base class for error formatters
 */
export abstract class BaseErrorFormatter implements ErrorFormatter {
  abstract name: string;
  
  abstract formatError(errors: unknown | unknown[], options?: ErrorFormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }

  /**
   * Extract error message from an error object
   * @param error The error object
   * @returns The error message
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.message && typeof errorObj.message === 'string') {
        return errorObj.message;
      }
      return 'Unknown object error';
    }
    return String(error);
  }

  /**
   * Extract error name from an error object
   * @param error The error object
   * @returns The error name
   */
  protected getErrorName(error: unknown): string {
    if (error instanceof Error) {
      return error.name;
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.name && typeof errorObj.name === 'string') {
        return errorObj.name;
      }
    }
    return 'Error';
  }

  /**
   * Extract stack trace from an error object
   * @param error The error object
   * @returns The stack trace or undefined
   */
  protected getStackTrace(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    } else if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      if (errorObj.stack && typeof errorObj.stack === 'string') {
        return errorObj.stack;
      }
    }
    return undefined;
  }

  /**
   * Extract API errors from an error object
   * @param error The error object
   * @returns Array of API errors or undefined
   */
  protected getApiErrors(error: unknown): ApiErrorResponse['errors'] | undefined {
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      const response = errorObj.response as ApiErrorResponse | undefined;
      if (response?.errors && Array.isArray(response.errors)) {
        return response.errors;
      }
    }
    return undefined;
  }

  /**
   * Extract request details from an error object
   * @param error The error object
   * @returns Request details or undefined
   */
  protected getRequestDetails(error: unknown): ApiRequest | undefined {
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      const request = errorObj.request as ApiRequest | undefined;
      if (request) {
        return {
          url: request.url,
          method: request.method
        };
      }
    }
    return undefined;
  }
} 