/**
 * Visual Design System for bktide CLI
 * 
 * This module implements a comprehensive color and typography system
 * that enhances information hierarchy and accessibility.
 */
import chalk from 'chalk';
import { getSymbols } from './symbols.js';

/**
 * Check if colors should be enabled
 */
function colorEnabled(): boolean {
  if (process.env.NO_COLOR) return false;
  const mode = process.env.BKTIDE_COLOR_MODE || 'auto';
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  return Boolean(process.stdout.isTTY);
}

/**
 * Semantic color system for different information types
 * Using colorblind-safe palette
 */
export const SEMANTIC_COLORS = {
  // Status colors (colorblind-safe)
  success: (s: string) => colorEnabled() ? chalk.blue(s) : s,
  error: (s: string) => colorEnabled() ? chalk.rgb(255, 140, 0)(s) : s,
  warning: (s: string) => colorEnabled() ? chalk.yellow(s) : s,
  info: (s: string) => colorEnabled() ? chalk.cyan(s) : s,
  
  // Typography emphasis levels
  heading: (s: string) => colorEnabled() ? chalk.bold.underline(s) : `== ${s} ==`,
  subheading: (s: string) => colorEnabled() ? chalk.bold(s) : `** ${s} **`,
  label: (s: string) => colorEnabled() ? chalk.bold(s) : s.toUpperCase(),
  
  // Data type highlighting
  identifier: (s: string) => colorEnabled() ? chalk.cyan(s) : s,
  count: (s: string) => colorEnabled() ? chalk.magenta(s) : s,
  url: (s: string) => colorEnabled() ? chalk.underline.cyan(s) : `<${s}>`,
  
  // De-emphasis (auxiliary information)
  dim: (s: string) => colorEnabled() ? chalk.dim(s) : s,
  muted: (s: string) => colorEnabled() ? chalk.gray(s) : s,
  tip: (s: string) => colorEnabled() ? chalk.dim(s) : `(${s})`,
  help: (s: string) => colorEnabled() ? chalk.dim.italic(s) : `[${s}]`,
  
  // Special formatting
  highlight: (s: string) => colorEnabled() ? chalk.bgBlue.white(` ${s} `) : `[${s}]`,
  code: (s: string) => colorEnabled() ? chalk.bgGray.white(` ${s} `) : `\`${s}\``,
};

/**
 * Build status specific theming
 * Matches conventions from GitHub Actions, CircleCI, Jenkins
 */
export const BUILD_STATUS_THEME = {
  // Success states
  PASSED: {
    color: SEMANTIC_COLORS.success,
    symbol: '✓',
    ascii: '[OK]',
  },
  
  // Failure states
  FAILED: {
    color: SEMANTIC_COLORS.error,
    symbol: '✖',
    ascii: '[FAIL]',
  },
  FAILING: {
    color: (s: string) => colorEnabled() ? chalk.rgb(255, 165, 0)(s) : s,
    symbol: '⚠',
    ascii: '[FAILING]',
  },
  
  // Warning states
  BLOCKED: {
    color: SEMANTIC_COLORS.warning,
    symbol: '⚠',
    ascii: '[BLOCKED]',
  },
  CANCELED: {
    color: SEMANTIC_COLORS.warning,
    symbol: '⊘',
    ascii: '[CANCEL]',
  },
  CANCELING: {
    color: SEMANTIC_COLORS.warning,
    symbol: '⊘',
    ascii: '[...]',
  },
  
  // Active states
  RUNNING: {
    color: SEMANTIC_COLORS.info,
    symbol: '↻',
    ascii: '[RUN]',
  },
  SCHEDULED: {
    color: SEMANTIC_COLORS.info,
    symbol: '⏱',
    ascii: '[QUEUE]',
  },
  
  // Inactive states
  SKIPPED: {
    color: SEMANTIC_COLORS.muted,
    symbol: '−',
    ascii: '[SKIP]',
  },
  NOT_RUN: {
    color: SEMANTIC_COLORS.muted,
    symbol: '○',
    ascii: '[--]',
  },
};

/**
 * Format a build status with appropriate color and symbol
 */
export function formatBuildStatus(
  status: string, 
  options?: { useSymbol?: boolean; ascii?: boolean }
): string {
  const theme = BUILD_STATUS_THEME[status as keyof typeof BUILD_STATUS_THEME];
  if (!theme) {
    return SEMANTIC_COLORS.muted(status);
  }
  
  const useSymbol = options?.useSymbol ?? true;
  const ascii = options?.ascii ?? false;
  
  if (useSymbol) {
    const symbol = ascii ? theme.ascii : theme.symbol;
    return `${symbol} ${theme.color(status)}`;
  }
  
  return theme.color(status);
}

/**
 * Visual hierarchy helpers
 */
export const HIERARCHY = {
  // Level 1: Critical (errors, failures)
  critical: (s: string) => {
    const symbol = getSymbols().error;
    return `${SEMANTIC_COLORS.error(symbol)} ${chalk.bold(s)}`;
  },
  
  // Level 2: Primary (main data, headings)
  primary: (s: string) => SEMANTIC_COLORS.heading(s),
  
  // Level 3: Standard (regular data)
  standard: (s: string) => s,
  
  // Level 4: Secondary (metadata, counts)
  secondary: (s: string) => SEMANTIC_COLORS.dim(s),
  
  // Level 5: Auxiliary (tips, help)
  auxiliary: (s: string) => SEMANTIC_COLORS.tip(s),
};

/**
 * Create a formatted tip box for better visual separation
 * Only used in wide terminals
 */
export function formatTipBox(tips: string[], width?: number): string {
  const termWidth = width || process.stdout.columns || 80;
  
  // Only use fancy box in wide terminals
  if (termWidth < 80 || !colorEnabled()) {
    return tips.map(t => SEMANTIC_COLORS.tip(`💡 ${t}`)).join('\n');
  }
  
  const lines: string[] = [];
  const boxWidth = Math.min(termWidth - 4, 60);
  const border = '─'.repeat(boxWidth - 10);
  
  lines.push(SEMANTIC_COLORS.dim(`┌─ Tips ${border}`));
  tips.forEach(tip => {
    lines.push(SEMANTIC_COLORS.dim(`│ • ${tip}`));
  });
  lines.push(SEMANTIC_COLORS.dim(`└${'─'.repeat(boxWidth - 1)}`));
  
  return lines.join('\n');
}

/**
 * Format an error message with consistent styling
 */
export function formatError(
  error: string | Error, 
  options?: { 
    showHelp?: boolean; 
    helpCommand?: string;
    suggestions?: string[];
  }
): string {
  const lines: string[] = [];
  const symbols = getSymbols();
  
  // Error header
  lines.push(HIERARCHY.critical('Error'));
  lines.push('');
  
  // Error message
  const message = typeof error === 'string' ? error : error.message;
  lines.push(message);
  
  // Suggestions if provided
  if (options?.suggestions && options.suggestions.length > 0) {
    lines.push('');
    lines.push(SEMANTIC_COLORS.subheading('To fix this:'));
    options.suggestions.forEach((suggestion, i) => {
      lines.push(`  ${i + 1}. ${suggestion}`);
    });
  }
  
  // Help command
  if (options?.showHelp && options?.helpCommand) {
    lines.push('');
    lines.push(SEMANTIC_COLORS.help(`Need help? Run: ${options.helpCommand}`));
  }
  
  return lines.join('\n');
}

/**
 * Format a success message (subtle, not redundant)
 */
export function formatSuccess(message: string, count?: number): string {
  const symbols = getSymbols();
  
  if (count !== undefined) {
    return `${SEMANTIC_COLORS.success(symbols.success)} ${message} ${SEMANTIC_COLORS.count(count.toString())}`;
  }
  
  return `${SEMANTIC_COLORS.success(symbols.success)} ${message}`;
}

/**
 * Format empty state messages
 */
export function formatEmptyState(
  message: string,
  suggestions?: string[]
): string {
  const lines: string[] = [];
  
  lines.push(SEMANTIC_COLORS.dim(message));
  
  if (suggestions && suggestions.length > 0) {
    lines.push('');
    suggestions.forEach(s => {
      // Make commands stand out from the dimmed text
      const formatted = s.replace(/--\w+[^ ]*/g, match => chalk.reset(match));
      lines.push(SEMANTIC_COLORS.dim(formatted));
    });
  }
  
  return lines.join('\n');
}

/**
 * Check if decorations should be applied
 */
export function shouldDecorate(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f !== 'json' && f !== 'alfred' && colorEnabled();
}

// Re-export symbols for convenience
export const SYMBOLS = getSymbols();

// Backwards compatibility exports
export const COLORS = {
  error: SEMANTIC_COLORS.error,
  warn: SEMANTIC_COLORS.warning,
  success: SEMANTIC_COLORS.success,
  info: SEMANTIC_COLORS.info,
  muted: SEMANTIC_COLORS.muted,
  highlight: SEMANTIC_COLORS.highlight,
  dim: SEMANTIC_COLORS.dim,
};
