import { BaseSnapshotFormatter, SnapshotFormatterInput } from './Formatter.js';

export class AlfredFormatter extends BaseSnapshotFormatter {
  name = 'alfred';

  format(input: SnapshotFormatterInput): string {
    const { manifest, outputDir, alreadyUpToDate } = input;
    const title = alreadyUpToDate
      ? `Snapshot up to date: ${manifest.buildRef}`
      : `Snapshot saved: ${manifest.buildRef}`;

    return JSON.stringify({
      items: [
        {
          uid: `snapshot-${manifest.buildRef}`,
          title,
          subtitle: outputDir,
          arg: outputDir,
        },
      ],
    });
  }
}
