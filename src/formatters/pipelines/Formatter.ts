import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Pipeline } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface PipelineFormatterOptions extends FormatterOptions {
  filterActive?: boolean;
  filterText?: string;
  truncated?: boolean;
  hasMoreAvailable?: boolean;  // Whether there are more pipelines on the server
  totalBeforeFilter?: number;
  requestedLimit?: number;  // The limit that was requested (via --count or default)
  organizationsCount?: number;
  orgSpecified?: boolean;
  hasError?: boolean;
  errorType?: 'access' | 'not_found' | 'api' | 'generic';
  errorMessage?: string;
}

export interface PipelineFormatter extends BaseFormatterInterface {
  formatPipelines(pipelines: Pipeline[], organizations: string[], options?: PipelineFormatterOptions): string;
}

export abstract class BaseFormatter implements PipelineFormatter {
  abstract name: string;
  
  abstract formatPipelines(pipelines: Pipeline[], organizations: string[], options?: PipelineFormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 