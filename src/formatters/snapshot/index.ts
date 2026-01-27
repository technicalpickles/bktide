// src/formatters/snapshot/index.ts
export { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions, Manifest, StepResult } from './Formatter.js';
export { PlainTextFormatter } from './PlainTextFormatter.js';
export { JsonFormatter } from './JsonFormatter.js';

import { SnapshotFormatter } from './Formatter.js';
import { PlainTextFormatter } from './PlainTextFormatter.js';
import { JsonFormatter } from './JsonFormatter.js';

export function getSnapshotFormatter(format: string = 'plain'): SnapshotFormatter {
  switch (format.toLowerCase()) {
    case 'json':
      return new JsonFormatter();
    default:
      return new PlainTextFormatter();
  }
}
