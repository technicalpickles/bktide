export * from './Formatter.js';
export * from './PlainTextFormatter.js';
export * from './JsonFormatter.js';

import { PipelineFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';

export function getPipelineFormatter(format: string = 'plain'): PipelineFormatter {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonFormatter();
    case 'plain':
    default:
      return new PlainTextFormatter();
  }
} 