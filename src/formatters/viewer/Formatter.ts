import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { ViewerData } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface ViewerFormatter extends BaseFormatterInterface {
  formatViewer(viewerData: ViewerData, options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements ViewerFormatter {
  abstract name: string;
  
  abstract formatViewer(viewerData: ViewerData, options?: FormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Debug: Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 