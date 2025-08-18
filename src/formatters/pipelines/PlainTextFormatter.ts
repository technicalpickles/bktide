import { FormatterOptions, AbstractFormatter } from '../BaseFormatter.js';
import { PipelineFormatter } from './Formatter.js';
import { Pipeline } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';
import { renderResponsiveTable, isNarrowTerminal, isMobileTerminal } from '../../ui/responsive-table.js';
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
    // Check if we're on a mobile terminal
    if (isMobileTerminal()) {
      // Use a vertical list format for very narrow terminals
      const items = pipelines.map(p => ({
        name: p.name || 'Unknown',
        slug: p.slug || '-',
        org: p.organization || '-'
      }));
      
      items.forEach((item, i) => {
        if (i > 0) output.push(''); // Separator between items
        output.push(SEMANTIC_COLORS.heading(item.name));
        output.push(`  ${SEMANTIC_COLORS.label('Slug:')} ${item.slug}`);
        if (organizations.length > 1) {
          output.push(`  ${SEMANTIC_COLORS.label('Org:')} ${item.org}`);
        }
      });
    } else if (isNarrowTerminal()) {
      // Use responsive table for narrow terminals
      if (organizations.length > 1) {
        const headers = ['ORGANIZATION', 'NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        const dataRows: string[][] = pipelines.map((p: Pipeline) => [
          p.organization || SEMANTIC_COLORS.muted('-'),
          p.name || SEMANTIC_COLORS.muted('-'),
          p.slug || SEMANTIC_COLORS.muted('-')
        ]);
        
        const columns = [
          { header: 'ORGANIZATION', priority: 2, minWidth: 8, truncate: true },
          { header: 'NAME', priority: 10, minWidth: 10, truncate: true },
          { header: 'SLUG', priority: 5, minWidth: 8, truncate: true }
        ];
        
        output.push(renderResponsiveTable(headers, dataRows, { columns }));
      } else {
        const headers = ['NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        const dataRows: string[][] = pipelines.map((p: Pipeline) => [
          p.name || SEMANTIC_COLORS.muted('-'),
          p.slug || SEMANTIC_COLORS.muted('-')
        ]);
        
        const columns = [
          { header: 'NAME', priority: 10, minWidth: 15, truncate: true },
          { header: 'SLUG', priority: 5, minWidth: 10, truncate: true }
        ];
        
        output.push(renderResponsiveTable(headers, dataRows, { columns }));
      }
    } else {
      // Use standard table for wide terminals
      const rows: string[][] = [];
      if (organizations.length > 1) {
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
        const headers = ['NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        rows.push(headers);
        pipelines.forEach((p: Pipeline) => {
          rows.push([
            p.name || SEMANTIC_COLORS.muted('-'),
            p.slug || SEMANTIC_COLORS.muted('-')
          ]);
        });
      }
      output.push(renderTable(rows, { preserveWidths: true }));
    }
    
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