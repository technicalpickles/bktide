import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';

export class PlainTextFormatter extends BaseFormatter {
  formatPipelines(pipelines: any[], organizations: string[], options?: FormatterOptions): string {
    const output: string[] = [];
    
    if (pipelines.length === 0) {
      output.push('No pipelines found.');
      if (organizations.length > 1) {
        output.push('Try specifying an organization with --org to narrow your search.');
      }
      return output.join('\n');
    }
    
    if (organizations.length === 1) {
      output.push(`Pipelines for ${organizations[0]} (${pipelines.length} total):`);
    } else {
      output.push(`Pipelines across your organizations (${pipelines.length} total):`);
    }
    
    pipelines.forEach((pipeline: any) => {
      if (organizations.length > 1) {
        output.push(`- [${pipeline.organization}] ${pipeline.name} (${pipeline.slug})`);
      } else {
        output.push(`- ${pipeline.name} (${pipeline.slug})`);
      }
    });
    
    if (organizations.length > 1) {
      output.push(`\nSearched across ${organizations.length} organizations. Use --org to filter to a specific organization.`);
    }
    
    return output.join('\n');
  }
} 