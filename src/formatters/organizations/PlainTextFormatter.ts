import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Organization } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';
import { SEMANTIC_COLORS, formatEmptyState } from '../../ui/theme.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatOrganizations(organizations: Organization[], _options?: FormatterOptions): string {
    if (!organizations || organizations.length === 0) {
      return formatEmptyState(
        'No organizations found',
        [
          'Check your API token has the correct permissions',
          'Run "bktide token --check" to verify your access'
        ]
      );
    }

    const lines: string[] = [];

    // Build table with enhanced headers
    const rows: string[][] = [];
    
    // Bold + underlined headers for emphasis
    const headers = ['NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
    rows.push(headers);
    
    organizations.forEach((org) => {
      rows.push([
        org.name || SEMANTIC_COLORS.muted('-'),
        org.slug || SEMANTIC_COLORS.muted('-')
      ]);
    });

    lines.push(renderTable(rows, { preserveWidths: true }));
    
    // Add summary line (dimmed)
    lines.push('');
    lines.push(SEMANTIC_COLORS.dim(
      organizations.length === 1 
        ? '1 organization accessible'
        : `${SEMANTIC_COLORS.count(organizations.length.toString())} organizations accessible`
    ));
    
    return lines.join('\n');
  }
} 