import { FormatterOptions, AbstractFormatter } from '../BaseFormatter.js';
import { PipelineFormatter } from './Formatter.js';
import { Pipeline } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';
import { SEMANTIC_COLORS, formatEmptyState } from '../../ui/theme.js';

export class PlainTextFormatter extends AbstractFormatter implements PipelineFormatter {
  constructor() {
    super('plain-text');
  }

  formatPipelines(pipelines: Pipeline[], organizations: string[], options?: FormatterOptions): string {
    // If no organizations are found, handle that case
    if (organizations.length === 0) {
      return formatEmptyState(
        'No organizations found',
        ['Check your API token has the correct permissions']
      );
    }
    
    return this.format(pipelines, this.formatPipelinesImpl.bind(this, organizations), options);
  }

  private formatPipelinesImpl(organizations: string[], pipelines: Pipeline[], _options?: FormatterOptions): string {
    const output: string[] = [];
    
    if (pipelines.length === 0) {
      const message = organizations.length === 1
        ? `No pipelines found in organization ${SEMANTIC_COLORS.label(organizations[0])}`
        : `No pipelines found across ${organizations.length} organizations`;
      
      return formatEmptyState(message, [
        'Check the organization name is correct',
        'Verify you have access to pipelines in this organization'
      ]);
    }

    // Build table rows
    const rows: string[][] = [];
    if (organizations.length > 1) {
      // Bold + underlined headers
      const headers = ['ORGANIZATION', 'NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
      rows.push(headers);
      pipelines.forEach((p: Pipeline) => {
        rows.push([
          p.organization || SEMANTIC_COLORS.muted('-'),
          p.name || SEMANTIC_COLORS.muted('-'),
          p.slug || SEMANTIC_COLORS.muted('-')
        ]);
      });
    } else {
      // Bold + underlined headers
      const headers = ['NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
      rows.push(headers);
      pipelines.forEach((p: Pipeline) => {
        rows.push([
          p.name || SEMANTIC_COLORS.muted('-'),
          p.slug || SEMANTIC_COLORS.muted('-')
        ]);
      });
    }

    // Render table with preserved widths
    output.push(renderTable(rows, { preserveWidths: true }));
    
    // Summary line (dimmed)
    output.push('');
    if (organizations.length === 1) {
      output.push(SEMANTIC_COLORS.dim(
        `${SEMANTIC_COLORS.count(pipelines.length.toString())} pipelines in ${organizations[0]}`
      ));
    } else {
      output.push(SEMANTIC_COLORS.dim(
        `${SEMANTIC_COLORS.count(pipelines.length.toString())} pipelines across ${organizations.length} organizations`
      ));
      output.push(SEMANTIC_COLORS.dim('Use --org to filter to a specific organization'));
    }
    
    return output.join('\n');
  }
} 