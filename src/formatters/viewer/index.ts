import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { ViewerFormatter } from './Formatter.js';
import { logger } from '../../services/logger.js';

/**
 * Factory function to create the appropriate formatter for viewer data
 * @param format The format to use
 * @returns A ViewerFormatter instance
 */
export function getViewerFormatter(format: string = 'plain'): ViewerFormatter {
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

export { ViewerFormatter }; 