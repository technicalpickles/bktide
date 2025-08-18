import { BaseFormatter, PipelineFormatterOptions } from './Formatter.js';
import { Pipeline } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  name = 'json';
  
  formatPipelines(pipelines: Pipeline[], organizations: string[], _options?: PipelineFormatterOptions): string {
    const result = {
      count: pipelines.length,
      organizations,
      pipelines
    };
    
    return JSON.stringify(result, null, 2);
  }
} 