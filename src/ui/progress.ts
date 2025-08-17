/**
 * Unified progress indicator system
 * Provides both determinate (bar) and indeterminate (spinner) progress indicators
 */

import { COLORS, SYMBOLS } from './theme.js';
import { termWidth, truncate } from './width.js';

/**
 * Check if output format is machine-readable
 */
function isMachineFormat(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f === 'json' || f === 'alfred';
}

/**
 * Check if we should show progress indicators
 */
function shouldShowProgress(format?: string): boolean {
  // Don't show in non-TTY environments
  if (!process.stderr.isTTY) return false;
  
  // Don't show for machine formats
  if (format && isMachineFormat(format)) return false;
  
  // Don't show in CI environments
  if (process.env.CI) return false;
  
  // Don't show if NO_COLOR is set (indicates non-interactive)
  if (process.env.NO_COLOR) return false;
  
  return true;
}

/**
 * Base interface for all progress indicators
 */
export interface IProgress {
  /** Update the progress indicator */
  update(value: number | string, label?: string): void;
  
  /** Stop the progress indicator */
  stop(): void;
  
  /** Complete with a success message */
  complete(message?: string): void;
  
  /** Fail with an error message */
  fail(message?: string): void;
}

/**
 * Spinner for indeterminate progress
 * Shows animated spinner with updating label
 */
class Spinner implements IProgress {
  private interval?: NodeJS.Timeout;
  private frame = 0;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private label: string = '';
  private lastLineLength = 0;
  private isActive = false;
  private stream: NodeJS.WriteStream = process.stderr;
  
  constructor(
    label?: string,
    private format?: string
  ) {
    if (label) this.label = label;
  }

  private shouldShow(): boolean {
    return shouldShowProgress(this.format);
  }

  start(): void {
    if (!this.shouldShow() || this.isActive) return;
    
    this.isActive = true;
    this.interval = setInterval(() => {
      this.render();
      this.frame = (this.frame + 1) % this.frames.length;
    }, 80);
  }

  update(_value: number | string, label?: string): void {
    // For spinner, we only care about label updates
    if (label !== undefined) {
      this.label = label;
    }
    if (!this.isActive) {
      this.start();
    }
  }

  stop(): void {
    if (!this.isActive) return;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.clear();
    this.isActive = false;
  }

  complete(message?: string): void {
    this.stop();
    if (message && this.shouldShow()) {
      this.stream.write(COLORS.success(`${SYMBOLS.success} ${message}\n`));
    }
  }

  fail(message?: string): void {
    this.stop();
    if (message && this.shouldShow()) {
      this.stream.write(COLORS.error(`${SYMBOLS.error} ${message}\n`));
    }
  }

  private clear(): void {
    if (!this.stream.isTTY) return;
    this.stream.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
  }

  private render(): void {
    if (!this.shouldShow() || !this.isActive) return;
    
    const spinner = COLORS.info(this.frames[this.frame]);
    const line = this.label ? `${spinner} ${this.label}` : spinner;
    
    this.clear();
    this.stream.write(line);
    this.lastLineLength = line.length;
  }
}

/**
 * Progress bar for determinate progress
 * Shows percentage and optional counts
 */
class Bar implements IProgress {
  private current = 0;
  private total: number;
  private barWidth = 30;
  private label?: string;
  private lastLineLength = 0;
  private isActive = false;
  private stream: NodeJS.WriteStream = process.stderr;
  private format?: string;
  
  constructor(
    options: {
      total: number;
      label?: string;
      barWidth?: number;
      format?: string;
    }
  ) {
    this.total = options.total || 100;
    this.label = options.label;
    this.barWidth = options.barWidth || 30;
    this.format = options.format;
  }

  private shouldShow(): boolean {
    return shouldShowProgress(this.format);
  }

  start(): void {
    if (!this.shouldShow() || this.isActive) return;
    this.isActive = true;
    this.render();
  }

  update(value: number | string, label?: string): void {
    if (!this.isActive) {
      this.start();
    }
    
    // For bar, value should be a number
    if (typeof value === 'number') {
      this.current = Math.min(value, this.total);
    }
    
    if (label !== undefined) {
      this.label = label;
    }
    
    if (this.shouldShow() && this.isActive) {
      this.render();
    }
  }

  stop(): void {
    if (!this.isActive) return;
    this.clear();
    this.isActive = false;
  }

  complete(message?: string): void {
    if (!this.shouldShow()) return;
    
    this.current = this.total;
    this.render();
    this.clear();
    
    if (message) {
      this.stream.write(COLORS.success(`${SYMBOLS.success} ${message}\n`));
    }
    
    this.isActive = false;
  }

  fail(message?: string): void {
    this.stop();
    if (message && this.shouldShow()) {
      this.stream.write(COLORS.error(`${SYMBOLS.error} ${message}\n`));
    }
  }

  private clear(): void {
    if (!this.stream.isTTY) return;
    this.stream.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
  }

  private render(): void {
    if (!this.shouldShow() || !this.isActive) return;
    
    const percentage = Math.round((this.current / this.total) * 100);
    const filledLength = Math.round((this.current / this.total) * this.barWidth);
    const emptyLength = this.barWidth - filledLength;
    
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    const bar = `[${filled}${empty}]`;
    
    const parts: string[] = [];
    
    if (this.label) {
      const maxLabelWidth = Math.max(20, termWidth() - this.barWidth - 20);
      parts.push(truncate(this.label, maxLabelWidth));
    }
    
    parts.push(bar);
    parts.push(`${percentage}%`);
    parts.push(`(${this.current}/${this.total})`);
    
    const line = parts.join(' ');
    
    this.clear();
    this.stream.write(line);
    this.lastLineLength = line.length;
  }
}

/**
 * No-op progress for non-interactive environments
 */
class NoOpProgress implements IProgress {
  update(): void {}
  stop(): void {}
  complete(): void {}
  fail(): void {}
}

/**
 * Main Progress API - factory methods for creating progress indicators
 */
export class Progress {
  /**
   * Create a spinner (indeterminate progress)
   * Use for operations of unknown duration
   */
  static spinner(label?: string, options?: { format?: string }): IProgress {
    if (!shouldShowProgress(options?.format)) {
      return new NoOpProgress();
    }
    
    const spinner = new Spinner(label, options?.format);
    if (label) {
      spinner.start();
    }
    return spinner;
  }

  /**
   * Create a progress bar (determinate progress)
   * Use when you know the total number of items
   */
  static bar(options: {
    total: number;
    label?: string;
    format?: string;
  }): IProgress {
    if (!shouldShowProgress(options.format)) {
      return new NoOpProgress();
    }
    
    const bar = new Bar(options);
    bar.start();
    return bar;
  }

  /**
   * Smart factory that creates appropriate progress type
   * Creates bar if total is provided, spinner otherwise
   */
  static create(options?: {
    total?: number;
    label?: string;
    format?: string;
  }): IProgress {
    if (!options) {
      return Progress.spinner();
    }
    
    if (options.total !== undefined && options.total > 0) {
      return Progress.bar(options as { total: number; label?: string; format?: string });
    }
    
    return Progress.spinner(options.label, options);
  }
}

/**
 * Helper for async operations with progress tracking
 */
export async function withProgress<T>(
  operation: (progress: IProgress) => Promise<T>,
  options?: {
    total?: number;
    label?: string;
    format?: string;
    successMessage?: string;
  }
): Promise<T> {
  const progress = Progress.create(options);
  
  try {
    const result = await operation(progress);
    progress.complete(options?.successMessage);
    return result;
  } catch (error) {
    progress.fail(error instanceof Error ? error.message : 'Operation failed');
    throw error;
  }
}

// ============================================================================
// Legacy API - for backward compatibility during migration
// ============================================================================

/**
 * @deprecated Use Progress.bar() instead
 */
export class ProgressBar {
  private progress: IProgress;
  
  constructor(options: any) {
    this.progress = Progress.bar({
      total: options.total,
      label: options.label,
      format: options.format
    });
  }
  
  start(): void {
    // Already started in constructor
  }
  
  update(value: number, label?: string): void {
    this.progress.update(value, label);
  }
  
  stop(): void {
    this.progress.stop();
  }
  
  complete(message?: string): void {
    this.progress.complete(message);
  }
}

/**
 * @deprecated Use Progress.spinner() instead
 */
export class IndeterminateProgress {
  private progress: IProgress;
  
  constructor(label?: string, format?: string) {
    this.progress = Progress.spinner(label, { format });
  }
  
  start(): void {
    // Already started if label provided
  }
  
  updateLabel(label: string): void {
    this.progress.update(label, label);
  }
  
  stop(): void {
    this.progress.stop();
  }
  
  complete(message?: string): void {
    this.progress.complete(message);
  }
}

/**
 * @deprecated Use withProgress() instead
 */
export async function withCountedProgress<T>(
  items: T[],
  operation: (item: T, index: number) => Promise<void>,
  options: {
    label?: string;
    format?: string;
    itemLabel?: (item: T, index: number) => string;
    showPercentage?: boolean;
    showCounts?: boolean;
    onComplete?: (count: number) => string;
  } = {}
): Promise<void> {
  if (!items || items.length === 0) {
    return;
  }
  
  const progress = Progress.bar({
    total: items.length,
    label: options.label || 'Processing',
    format: options.format
  });
  
  try {
    for (let i = 0; i < items.length; i++) {
      const label = options.itemLabel ? 
        options.itemLabel(items[i], i) : 
        `Processing item ${i + 1}/${items.length}`;
      
      progress.update(i, label);
      await operation(items[i], i);
    }
    
    progress.update(items.length, 'Complete');
    
    const completeMessage = options.onComplete ?
      options.onComplete(items.length) :
      `Processed ${items.length} items`;
    
    progress.complete(completeMessage);
  } catch (error) {
    progress.stop();
    throw error;
  }
}

/**
 * @deprecated Use withProgress() instead
 */
export async function withIndeterminateProgress<T>(
  operation: () => Promise<T>,
  label?: string,
  format?: string,
  successMessage?: string
): Promise<T> {
  return withProgress(
    operation,
    { label, format, successMessage }
  );
}