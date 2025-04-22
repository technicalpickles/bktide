import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Pipeline } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface PipelineFormatter extends BaseFormatterInterface {
  formatPipelines(pipelines: Pipeline[], organizations: string[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements PipelineFormatter {
  abstract name: string;
  
  abstract formatPipelines(pipelines: Pipeline[], organizations: string[], options?: FormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 