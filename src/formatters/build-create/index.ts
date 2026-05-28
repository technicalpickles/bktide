import { BuildCreateFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';
import { logger } from '../../services/logger.js';

export function getBuildCreateFormatter(format: string = 'plain'): BuildCreateFormatter {
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
      logger.warn(`Unknown format '${format}', defaulting to plain text`);
      return new PlainTextFormatter();
  }
}

export type { BuildCreateFormatter };
