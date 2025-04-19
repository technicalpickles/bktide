import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Pipeline } from '../../types/index.js';

export interface PipelineFormatter extends BaseFormatterInterface {
  formatPipelines(pipelines: Pipeline[], organizations: string[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements PipelineFormatter {
  abstract formatPipelines(pipelines: Pipeline[], organizations: string[], options?: FormatterOptions): string;
} 