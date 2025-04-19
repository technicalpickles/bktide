import { ViewerFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';

/**
 * Get the appropriate viewer formatter based on the format string
 * @param format The format to use ('plain', 'json')
 * @returns A ViewerFormatter instance
 */
export function getViewerFormatter(format: string = 'plain'): ViewerFormatter {
  // Normalize the format string
  const normalizedFormat = format.toLowerCase().trim();
  
  switch (normalizedFormat) {
    case 'json':
      return new JsonFormatter();
    case 'plain':
    case 'text':
      return new PlainTextFormatter();
    default:
      console.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
}

export { ViewerFormatter }; 