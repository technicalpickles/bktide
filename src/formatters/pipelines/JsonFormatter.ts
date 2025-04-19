import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';

export class JsonFormatter extends BaseFormatter {
  formatPipelines(pipelines: any[], organizations: string[], options?: FormatterOptions): string {
    const result = {
      count: pipelines.length,
      organizations,
      pipelines
    };
    
    return JSON.stringify(result, null, 2);
  }
} 