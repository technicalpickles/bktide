import { FormatterOptions, AbstractFormatter } from '../BaseFormatter.js';
import { PipelineFormatter } from './Formatter.js';
import { Pipeline } from '../../types/index.js';

export class PlainTextFormatter extends AbstractFormatter implements PipelineFormatter {
  constructor() {
    super('plain-text');
  }

  formatPipelines(pipelines: Pipeline[], organizations: string[], options?: FormatterOptions): string {
    // If no organizations are found, handle that case
    if (organizations.length === 0) {
      return 'No organizations found.';
    }
    
    return this.format(pipelines, this.formatPipelinesImpl.bind(this, organizations), options);
  }

  private formatPipelinesImpl(organizations: string[], pipelines: Pipeline[], _options?: FormatterOptions): string {
    const output: string[] = [];
    
    if (pipelines.length === 0) {
      output.push('No pipelines found.');
      if (organizations.length === 1) {
        output.push(`No pipelines found in organization ${organizations[0]}.`);
      } else {
        output.push(`No pipelines found across ${organizations.length} organizations.`);
      }
      return output.join('\n');
    }
    
    if (organizations.length === 1) {
      output.push(`Pipelines for ${organizations[0]} (${pipelines.length} total):`);
    } else {
      output.push(`Pipelines across your organizations (${pipelines.length} total):`);
    }

    // Build table rows
    const rows: string[][] = [];
    if (organizations.length > 1) {
      rows.push(['ORGANIZATION', 'NAME', 'SLUG']);
      pipelines.forEach((p: Pipeline) => {
        rows.push([p.organization || '-', p.name || '-', p.slug || '-']);
      });
    } else {
      rows.push(['NAME', 'SLUG']);
      pipelines.forEach((p: Pipeline) => {
        rows.push([p.name || '-', p.slug || '-']);
      });
    }

    // Compute column widths and render table
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
    const lines = rows.map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join('  '));
    output.push(lines.join('\n'));
    
    // Summary line showing total pipelines listed
    output.push(`Showing ${pipelines.length} pipelines.`);
    
    if (organizations.length > 1) {
      output.push(`\nSearched across ${organizations.length} organizations. Use --org to filter to a specific organization.`);
    }
    
    return output.join('\n');
  }
} 