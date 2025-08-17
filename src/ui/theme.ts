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

export const COLORS = {
  error: (s: string) => (colorEnabled() ? chalk.red(s) : s),
  warn: (s: string) => (colorEnabled() ? chalk.yellow(s) : s),
  success: (s: string) => (colorEnabled() ? chalk.green(s) : s),
  info: (s: string) => (colorEnabled() ? chalk.cyan(s) : s),
  muted: (s: string) => (colorEnabled() ? chalk.gray(s) : s)
};

// Export symbols from the symbols module
export const SYMBOLS = getSymbols();

export function shouldDecorate(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f !== 'json' && f !== 'alfred' && colorEnabled();
}


