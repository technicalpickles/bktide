import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Organization } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatOrganizations(organizations: Organization[], _options?: FormatterOptions): string {
    if (!organizations || organizations.length === 0) {
      return 'No organizations found.';
    }

    const lines: string[] = [];
    lines.push('Your organizations:');

    const rows: string[][] = [];
    rows.push(['NAME', 'SLUG']);
    organizations.forEach((org) => {
      rows.push([org.name || '-', org.slug || '-']);
    });

    lines.push(renderTable(rows));
    
    return lines.join('\n');
  }
} 