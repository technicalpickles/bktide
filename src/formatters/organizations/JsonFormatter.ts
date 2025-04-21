import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Organization } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  name = 'json';
  
  formatOrganizations(organizations: Organization[], _options?: FormatterOptions): string {
    if (!organizations || organizations.length === 0) {
      return JSON.stringify({ organizations: [] });
    }

    return JSON.stringify({
      organizations: organizations.map(org => ({
        name: org.name,
        slug: org.slug
      }))
    }, null, 2);
  }
} 