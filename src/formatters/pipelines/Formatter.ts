import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';

export interface PipelineFormatter extends BaseFormatterInterface {
  formatPipelines(pipelines: any[], organizations: string[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements PipelineFormatter {
  abstract formatPipelines(pipelines: any[], organizations: string[], options?: FormatterOptions): string;
} 