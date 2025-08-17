/**
 * Progress bar implementation for CLI
 * Provides both determinate (percentage) and indeterminate (activity) progress indicators
 */

import { COLORS, SYMBOLS } from './theme.js';
import { termWidth, truncate } from './width.js';

/**
 * Check if output format is machine-readable (JSON or Alfred)
 */
function isMachineFormat(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f === 'json' || f === 'alfred';
}

export interface ProgressOptions {
  /** Total number of items to process (for determinate progress) */
  total?: number;
  /** Initial progress value */
  initial?: number;
  /** Width of the progress bar (defaults to 30) */
  barWidth?: number;
  /** Whether to show percentage */
  showPercentage?: boolean;
  /** Whether to show current/total counts */
  showCounts?: boolean;
  /** Label to display */
  label?: string;
  /** Format (for machine format detection) */
  format?: string;
}

export class ProgressBar {
  private current = 0;
  private total: number;
  private barWidth: number;
  private showPercentage: boolean;
  private showCounts: boolean;
  private label?: string;
  private lastLineLength = 0;
  private isActive = false;
  private format?: string;
  private stream: NodeJS.WriteStream;
  
  constructor(options: ProgressOptions = {}) {
    this.total = options.total || 100;
    this.current = options.initial || 0;
    this.barWidth = options.barWidth || 30;
    this.showPercentage = options.showPercentage !== false;
    this.showCounts = options.showCounts === true;
    this.label = options.label;
    this.format = options.format;
    this.stream = process.stderr;
  }

  /**
   * Check if progress bar should be shown
   */
  private shouldShow(): boolean {
    // Don't show in non-TTY environments
    if (!this.stream.isTTY) return false;
    
    // Don't show for machine formats
    if (this.format && isMachineFormat(this.format)) return false;
    
    // Don't show in CI environments
    if (process.env.CI) return false;
    
    // Don't show if NO_COLOR is set (indicates non-interactive)
    if (process.env.NO_COLOR) return false;
    
    return true;
  }

  /**
   * Start showing the progress bar
   */
  start(): void {
    if (!this.shouldShow()) return;
    this.isActive = true;
    this.render();
  }

  /**
   * Update progress
   */
  update(value: number, label?: string): void {
    if (!this.shouldShow() || !this.isActive) return;
    
    this.current = Math.min(value, this.total);
    if (label !== undefined) {
      this.label = label;
    }
    this.render();
  }

  /**
   * Increment progress by a delta
   */
  increment(delta = 1): void {
    this.update(this.current + delta);
  }

  /**
   * Set progress to a specific percentage (0-100)
   */
  setPercentage(percentage: number): void {
    const value = Math.round((percentage / 100) * this.total);
    this.update(value);
  }

  /**
   * Stop and clear the progress bar
   */
  stop(): void {
    if (!this.shouldShow() || !this.isActive) return;
    
    this.clear();
    this.isActive = false;
  }

  /**
   * Complete the progress bar (sets to 100% and stops)
   */
  complete(message?: string): void {
    if (!this.shouldShow()) return;
    
    this.current = this.total;
    this.render();
    
    // Clear the progress bar line
    this.clear();
    
    // Print completion message if provided
    if (message) {
      this.stream.write(COLORS.success(`${SYMBOLS.success} ${message}\n`));
    }
    
    this.isActive = false;
  }

  /**
   * Clear the current line
   */
  private clear(): void {
    if (!this.stream.isTTY) return;
    
    // Move cursor to beginning of line and clear
    this.stream.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
  }

  /**
   * Render the progress bar
   */
  private render(): void {
    if (!this.shouldShow() || !this.isActive) return;
    
    const percentage = Math.round((this.current / this.total) * 100);
    const filledLength = Math.round((this.current / this.total) * this.barWidth);
    const emptyLength = this.barWidth - filledLength;
    
    // Build progress bar
    const filled = '█'.repeat(filledLength);
    const empty = '░'.repeat(emptyLength);
    const bar = `[${filled}${empty}]`;
    
    // Build progress line
    const parts: string[] = [];
    
    if (this.label) {
      const maxLabelWidth = Math.max(20, termWidth() - this.barWidth - 20);
      parts.push(truncate(this.label, maxLabelWidth));
    }
    
    parts.push(bar);
    
    if (this.showPercentage) {
      parts.push(`${percentage}%`);
    }
    
    if (this.showCounts) {
      parts.push(`(${this.current}/${this.total})`);
    }
    
    const line = parts.join(' ');
    
    // Clear previous line and write new one
    this.clear();
    this.stream.write(line);
    this.lastLineLength = line.length;
  }
}

/**
 * Indeterminate progress indicator (spinner-like dots)
 */
export class IndeterminateProgress {
  private interval?: NodeJS.Timeout;
  private frame = 0;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private label?: string;
  private lastLineLength = 0;
  private format?: string;
  private stream: NodeJS.WriteStream;
  
  constructor(label?: string, format?: string) {
    this.label = label;
    this.format = format;
    this.stream = process.stderr;
  }

  /**
   * Check if indicator should be shown
   */
  private shouldShow(): boolean {
    if (!this.stream.isTTY) return false;
    if (this.format && isMachineFormat(this.format)) return false;
    if (process.env.CI) return false;
    if (process.env.NO_COLOR) return false;
    return true;
  }

  /**
   * Start the indeterminate progress indicator
   */
  start(): void {
    if (!this.shouldShow()) return;
    
    this.interval = setInterval(() => {
      this.render();
      this.frame = (this.frame + 1) % this.frames.length;
    }, 80);
  }

  /**
   * Update the label
   */
  updateLabel(label: string): void {
    this.label = label;
    if (this.shouldShow()) {
      this.render();
    }
  }

  /**
   * Stop the indicator
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.clear();
  }

  /**
   * Stop with a completion message
   */
  complete(message?: string): void {
    this.stop();
    if (message && this.shouldShow()) {
      this.stream.write(COLORS.success(`${SYMBOLS.success} ${message}\n`));
    }
  }

  /**
   * Clear the current line
   */
  private clear(): void {
    if (!this.stream.isTTY) return;
    this.stream.write('\r' + ' '.repeat(this.lastLineLength) + '\r');
  }

  /**
   * Render the current frame
   */
  private render(): void {
    const spinner = COLORS.info(this.frames[this.frame]);
    const line = this.label ? `${spinner} ${this.label}` : spinner;
    
    this.clear();
    this.stream.write(line);
    this.lastLineLength = line.length;
  }
}

/**
 * Helper function to track async operation progress
 */
export async function withProgress<T>(
  operation: (progress: ProgressBar) => Promise<T>,
  options: ProgressOptions = {}
): Promise<T> {
  const progress = new ProgressBar(options);
  progress.start();
  
  try {
    const result = await operation(progress);
    progress.complete();
    return result;
  } catch (error) {
    progress.stop();
    throw error;
  }
}

/**
 * Helper for indeterminate async operations
 */
export async function withIndeterminateProgress<T>(
  operation: () => Promise<T>,
  label?: string,
  format?: string,
  successMessage?: string
): Promise<T> {
  const progress = new IndeterminateProgress(label, format);
  progress.start();
  
  try {
    const result = await operation();
    progress.complete(successMessage);
    return result;
  } catch (error) {
    progress.stop();
    throw error;
  }
}
