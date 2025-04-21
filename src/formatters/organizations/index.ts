import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { OrganizationFormatter } from './Formatter.js';
import { logger } from '../../services/logger.js';

/**
 * Factory function to create the appropriate formatter for organization data
 * @param format The format to use
 * @returns An OrganizationFormatter instance
 */
export function getOrganizationFormatter(format: string = 'plain'): OrganizationFormatter {
  switch (format.toLowerCase()) {
    case 'plain':
    case 'text':
      return new PlainTextFormatter();
    case 'json':
      return new JsonFormatter();
    default:
      logger.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
}

export { OrganizationFormatter }; 