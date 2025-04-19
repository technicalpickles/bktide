export * from './Formatter.js';
export * from './PlainTextFormatter.js';
export * from './JsonFormatter.js';

import { PipelineFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';

/**
 * Get the appropriate pipeline formatter based on the format string
 * @param format The format to use ('plain' or 'json')
 * @returns A PipelineFormatter instance
 */
export function getPipelineFormatter(format: string = 'plain'): PipelineFormatter {
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