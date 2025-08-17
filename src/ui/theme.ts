import chalk from 'chalk';
import { getSymbols } from './symbols.js';

function isTTY(): boolean {
  return Boolean(process.stdout.isTTY);
}

function colorEnabled(): boolean {
  if (process.env.NO_COLOR) return false;
  const mode = process.env.BKTIDE_COLOR_MODE || 'auto';
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return isTTY();
}

/**
 * Color-blind safe palette
 * Avoids red-green combinations that affect ~8% of users
 * Uses semantic labels alongside colors for clarity
 */
export const COLORS = {
  // Orange instead of red for errors (better for red-green colorblind)
  error: (s: string) => (colorEnabled() ? chalk.rgb(255, 140, 0)(s) : s),
  
  // Keep yellow for warnings (universally visible)
  warn: (s: string) => (colorEnabled() ? chalk.yellow(s) : s),
  
  // Blue instead of green for success (better for red-green colorblind)
  success: (s: string) => (colorEnabled() ? chalk.blue(s) : s),
  
  // Cyan for info (good contrast)
  info: (s: string) => (colorEnabled() ? chalk.cyan(s) : s),
  
  // Gray for muted text
  muted: (s: string) => (colorEnabled() ? chalk.gray(s) : s),
  
  // Additional semantic colors
  highlight: (s: string) => (colorEnabled() ? chalk.magenta(s) : s),
  dim: (s: string) => (colorEnabled() ? chalk.dim(s) : s)
};

// Export symbols from the symbols module
export const SYMBOLS = getSymbols();

export function shouldDecorate(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f !== 'json' && f !== 'alfred' && colorEnabled();
}


