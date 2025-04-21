export * from './Formatter.js';
export * from './PlainTextFormatter.js';
export * from './JsonFormatter.js';
export * from './AlfredFormatter.js';

import { PipelineFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';
import { logger } from '../../services/logger.js';

/**
 * Factory function to create the appropriate formatter for pipelines
 * @param format The format to use
 * @returns A PipelineFormatter instance
 */
export function getPipelineFormatter(format: string = 'plain'): PipelineFormatter {
  switch (format.toLowerCase()) {
    case 'plain':
    case 'text':
      return new PlainTextFormatter();
    case 'json':
      return new JsonFormatter();
    case 'alfred':
      return new AlfredFormatter();
    default:
      logger.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
} 