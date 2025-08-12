import { AnnotationFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Get the appropriate annotation formatter based on the format string
 * @param format The format to use ('plain', 'json', or 'alfred')
 * @returns An AnnotationFormatter instance
 */
export function getAnnotationFormatter(format: string = 'plain'): AnnotationFormatter {
  // Normalize the format string
  const normalizedFormat = format.toLowerCase().trim();
  
  switch (normalizedFormat) {
    case 'json':
      return new JsonFormatter();
    case 'plain':
    case 'text':
      return new PlainTextFormatter();
    default:
      logger.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
}

export { AnnotationFormatter };
