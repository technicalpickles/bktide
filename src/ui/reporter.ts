import { COLORS, SYMBOLS, shouldDecorate } from './theme.js';

function isMachine(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f === 'json' || f === 'alfred';
}

export class Reporter {
  private readonly format: string;

  constructor(format: string = 'plain') {
    this.format = format;
  }

  info(message: string): void {
    this.writeStdout(this.decorate(COLORS.info, `${SYMBOLS.info} ${message}`));
  }

  success(message: string): void {
    this.writeStdout(this.decorate(COLORS.success, `${SYMBOLS.success} ${message}`));
  }

  warn(message: string): void {
    this.writeStderr(this.decorate(COLORS.warn, `${SYMBOLS.warn} ${message}`));
  }

  error(message: string): void {
    this.writeStderr(this.decorate(COLORS.error, `${SYMBOLS.error} ${message}`));
  }

  table(rows: string[][]): void {
    if (!rows.length) return;
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
    const lines = rows.map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ')).join('\n');
    this.writeStdout(lines);
  }

  private decorate(fn: (s: string) => string, s: string): string {
    return shouldDecorate(this.format) ? fn(s) : s;
  }

  private writeStdout(s: string): void {
    if (isMachine(this.format)) return; // keep machine outputs pristine
    process.stdout.write(s + '\n');
  }

  private writeStderr(s: string): void {
    if (isMachine(this.format)) return; // keep machine outputs pristine
    process.stderr.write(s + '\n');
  }
}


