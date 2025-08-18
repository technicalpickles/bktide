import { BaseBuildDetailFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';
import { AlfredFormatter } from './AlfredFormatter.js';

export function getBuildDetailFormatter(format: string): BaseBuildDetailFormatter {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonFormatter();
    case 'alfred':
      return new AlfredFormatter();
    case 'plain':
    case 'text':
    case 'plain-text':
    default:
      return new PlainTextFormatter();
  }
}

export { BaseBuildDetailFormatter } from './Formatter.js';
export { PlainTextFormatter } from './PlainTextFormatter.js';
export { JsonFormatter } from './JsonFormatter.js';
export { AlfredFormatter } from './AlfredFormatter.js';
