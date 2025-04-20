import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Pipeline } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  name = 'json';
  
  formatPipelines(pipelines: Pipeline[], organizations: string[], _options?: FormatterOptions): string {
    const result = {
      count: pipelines.length,
      organizations,
      pipelines
    };
    
    return JSON.stringify(result, null, 2);
  }
} 