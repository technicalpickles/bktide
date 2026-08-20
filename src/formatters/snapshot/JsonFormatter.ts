import { BaseSnapshotFormatter, SnapshotFormatterInput } from './Formatter.js';

export class JsonFormatter extends BaseSnapshotFormatter {
  name = 'json';

  format(input: SnapshotFormatterInput): string {
    return JSON.stringify(input.manifest, null, 2);
  }
}
