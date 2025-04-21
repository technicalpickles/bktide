import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Organization } from '../../types/index.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatOrganizations(organizations: Organization[], _options?: FormatterOptions): string {
    if (!organizations || organizations.length === 0) {
      return 'No organizations found.';
    }

    let output = 'Your organizations:\n';
    organizations.forEach(org => {
      output += `- ${org.name} (${org.slug})\n`;
    });
    
    return output.trim();
  }
} 