import { TokenFormatter, TokenFormatterOptions } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Get the appropriate token formatter based on the format string
 * @param format The format to use ('plain', 'json', or 'alfred')
 * @returns A TokenFormatter instance
 */
export function getTokenFormatter(format: string = 'plain'): TokenFormatter {
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
      logger.warn(`Unknown format '${format}', defaulting to plain text for token output`);
      return new PlainTextFormatter();
  }
}

export { TokenFormatter, TokenFormatterOptions }; 