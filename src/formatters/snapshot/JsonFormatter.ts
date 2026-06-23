// src/formatters/snapshot/JsonFormatter.ts
import { SnapshotFormatter, SnapshotData, SnapshotFormatterOptions } from './Formatter.js';

export class JsonFormatter implements SnapshotFormatter {
  name = 'json';

  formatSnapshot(data: SnapshotData, _options?: SnapshotFormatterOptions): string {
    return JSON.stringify(data.manifest, null, 2);
  }
}
