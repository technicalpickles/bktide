import { ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Get the appropriate error formatter based on the format string
 * @param format The format to use ('plain', 'json', or 'alfred')
 * @returns An ErrorFormatter instance
 */
export function getErrorFormatter(format: string = 'plain'): ErrorFormatter {
  // Normalize the format string
  const normalizedFormat = format.toLowerCase().trim();
  
  switch (normalizedFormat) {
    case 'json':
      return new JsonFormatter();
    case 'alfred':
      return new AlfredFormatter();
    case 'plain':
    case 'text':
      return new PlainTextFormatter();
    default:
      logger.warn(`Unknown format '${format}', defaulting to plain text for error output`);
      return new PlainTextFormatter();
  }
}

export { ErrorFormatter, ErrorFormatterOptions }; 