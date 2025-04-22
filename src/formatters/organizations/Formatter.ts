import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Organization } from '../../types/index.js';
import { logger } from '../../services/logger.js';

export interface OrganizationFormatter extends BaseFormatterInterface {
  formatOrganizations(organizations: Organization[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements OrganizationFormatter {
  abstract name: string;
  
  abstract formatOrganizations(organizations: Organization[], options?: FormatterOptions): string;
  
  format<T>(data: T[], formatFn: (data: T[], options?: FormatterOptions) => string, options?: FormatterOptions): string {
    if (options?.debug) {
      logger.debug(`Formatting with ${this.name} formatter`);
    }
    return formatFn(data, options);
  }
} 