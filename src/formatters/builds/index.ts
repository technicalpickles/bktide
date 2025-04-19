import { BuildFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';

/**
 * Get the appropriate build formatter based on the format string
 * @param format The format to use ('plain', 'json', or 'alfred')
 * @returns A BuildFormatter instance
 */
export function getBuildFormatter(format: string = 'plain'): BuildFormatter {
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
      console.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
}

export { BuildFormatter }; 