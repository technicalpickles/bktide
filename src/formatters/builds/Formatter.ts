import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Build } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface BuildFormatter extends BaseFormatterInterface {
  formatBuilds(builds: Build[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements BuildFormatter {
  abstract name: string;
  
  abstract formatBuilds(builds: Build[], options?: FormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 