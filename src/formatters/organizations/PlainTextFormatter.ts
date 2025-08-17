import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Organization } from '../../types/index.js';

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

    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
    const table = rows.map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ')).join('\n');
    lines.push(table);
    
    return lines.join('\n');
  }
} 