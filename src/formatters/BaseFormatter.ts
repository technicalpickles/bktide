import { logger } from '../services/logger.js';

export interface FormatterOptions {
  debug?: boolean;
  organizationsCount?: number;
  orgSpecified?: boolean;
  // User information for more specific no-results messages
  userName?: string;
  userEmail?: string;
  userId?: string;
}

export interface FormatFunction<T> {
  (data: T[], options?: FormatterOptions): string;
}

export interface BaseFormatter {
  name: string;
  format<T>(data: T[], formatFn: FormatFunction<T>, options?: FormatterOptions): string;
}

export abstract class AbstractFormatter implements BaseFormatter {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  format<T>(data: T[], formatFn: FormatFunction<T>, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 