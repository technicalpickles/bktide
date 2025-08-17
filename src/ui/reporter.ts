import { COLORS, SYMBOLS, shouldDecorate } from './theme.js';
import { termWidth, calculateColumnWidths, formatTableRow } from './width.js';

function isMachine(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f === 'json' || f === 'alfred';
}

function isInteractive(): boolean {
  // Only show decorative messages when stdout is a TTY (not piped/redirected)
  return Boolean(process.stdout.isTTY);
}

export class Reporter {
  private readonly format: string;
  private readonly quiet: boolean;

  constructor(format: string = 'plain', quiet = false) {
    this.format = format;
    this.quiet = quiet;
  }

  info(message: string): void {
    if (this.shouldSuppress()) return;
    this.writeStdout(this.decorate(COLORS.info, `${SYMBOLS.info} ${message}`));
  }

  success(message: string): void {
    if (this.shouldSuppress()) return;
    this.writeStdout(this.decorate(COLORS.success, `${SYMBOLS.success} ${message}`));
  }

  warn(message: string): void {
    // Warnings go to stderr, check stderr TTY status
    if (isMachine(this.format) || !process.stderr.isTTY) return;
    this.writeStderr(this.decorate(COLORS.warn, `${SYMBOLS.warn} ${message}`));
  }

  error(message: string): void {
    // Errors go to stderr, check stderr TTY status  
    if (isMachine(this.format) || !process.stderr.isTTY) return;
    this.writeStderr(this.decorate(COLORS.error, `${SYMBOLS.error} ${message}`));
  }

  table(rows: string[][], options?: { preserveWidths?: boolean }): void {
    // Tables are data output, not decorative - always show them
    if (!rows.length || isMachine(this.format)) return;
    
    // Get terminal width for responsive tables
    const width = termWidth();
    const numColumns = rows[0].length;
    
    if (options?.preserveWidths) {
      // Legacy behavior: preserve exact widths (may overflow)
      const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
      const lines = rows.map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ')).join('\n');
      this.writeStdout(lines);
    } else {
      // New behavior: responsive width-aware tables
      const columnWidths = calculateColumnWidths(numColumns, width);
      const lines = rows.map(row => formatTableRow(row, columnWidths));
      this.writeStdout(lines.join('\n'));
    }
  }

  private shouldSuppress(): boolean {
    // Suppress decorative messages when:
    // - quiet mode is enabled
    // - machine format (json/alfred)
    // - stdout is not a TTY (piped/redirected)
    return this.quiet || isMachine(this.format) || !isInteractive();
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


