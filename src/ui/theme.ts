/**
 * Enhanced Visual Design System for bktide CLI
 * 
 * This module implements a comprehensive color and typography system
 * that enhances information hierarchy and accessibility.
 */
import chalk from 'chalk';
import { getSymbols } from './symbols.js';
import { terminalLink } from '../utils/terminal-links.js';

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
  url: (s: string, label?: string) => terminalLink(s, label),
  
  // De-emphasis (auxiliary information)
  dim: (s: string) => colorEnabled() ? chalk.dim(s) : s,
  muted: (s: string) => colorEnabled() ? chalk.gray(s) : s,
  tip: (s: string) => colorEnabled() ? chalk.dim(s) : `(${s})`,
  help: (s: string) => colorEnabled() ? chalk.dim.italic(s) : `[${s}]`,
  
  // Special formatting
  highlight: (s: string) => colorEnabled() ? chalk.magenta(s) : s,
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
  // Normalize status to uppercase for theme lookup
  const normalizedStatus = status.toUpperCase();
  const theme = BUILD_STATUS_THEME[normalizedStatus as keyof typeof BUILD_STATUS_THEME];
  if (!theme) {
    return SEMANTIC_COLORS.muted(status);
  }
  
  const useSymbol = options?.useSymbol ?? true;
  const ascii = options?.ascii ?? false;
  
  if (useSymbol) {
    const symbol = ascii ? theme.ascii : theme.symbol;
    // Keep original casing for display
    return `${symbol} ${theme.color(status)}`;
  }
  
  // Keep original casing for display
  return theme.color(status);
}

/**
 * Tip display styles for different contexts
 */
export enum TipStyle {
  GROUPED = 'grouped',      // Tips: with arrows
  INDIVIDUAL = 'individual', // → Individual arrows
  ACTIONS = 'actions',      // Next steps: with arrows
  FIXES = 'fixes',          // To fix this: numbered
  BOX = 'box'              // Fancy box with arrows (wide terminals)
}

/**
 * Format tips with consistent styling based on context
 */
export function formatTips(
  tips: string[], 
  style: TipStyle = TipStyle.GROUPED,
  includeTurnOff: boolean = true
): string {
  if (tips.length === 0) return '';
  
  // Add the turn-off tip if not already included
  const allTips = [...tips];
  const turnOffMessage = 'Use --no-tips to hide these hints';
  if (includeTurnOff && !tips.some(tip => tip.includes('--no-tips'))) {
    allTips.push(turnOffMessage);
  }
  
  switch (style) {
    case TipStyle.GROUPED:
      return formatGroupedTips(allTips);
    case TipStyle.INDIVIDUAL:
      return formatIndividualTips(allTips);
    case TipStyle.ACTIONS:
      return formatActionTips(allTips);
    case TipStyle.FIXES:
      return formatFixTips(allTips);
    case TipStyle.BOX:
      return formatTipBox(allTips); // Use existing function
    default:
      return formatGroupedTips(allTips);
  }
}

function formatGroupedTips(tips: string[]): string {
  const lines: string[] = [];
  lines.push(SEMANTIC_COLORS.dim('Tips:'));
  tips.forEach(tip => {
    lines.push(SEMANTIC_COLORS.dim(`  → ${tip}`));
  });
  return lines.join('\n');
}

function formatIndividualTips(tips: string[]): string {
  return tips
    .map(tip => SEMANTIC_COLORS.dim(`→ ${tip}`))
    .join('\n');
}

function formatActionTips(tips: string[]): string {
  const lines: string[] = [];
  lines.push(SEMANTIC_COLORS.dim('Next steps:'));
  tips.forEach(tip => {
    lines.push(SEMANTIC_COLORS.dim(`  → ${tip}`));
  });
  return lines.join('\n');
}

function formatFixTips(tips: string[]): string {
  const lines: string[] = [];
  lines.push(SEMANTIC_COLORS.subheading('To fix this:'));
  tips.forEach((tip, i) => {
    lines.push(`  ${i + 1}. ${tip}`);
  });
  return lines.join('\n');
}

/**
 * Create a formatted tip box for better visual separation
 * Only used in wide terminals
 */
export function formatTipBox(tips: string[], width?: number): string {
  const termWidth = width || process.stdout.columns || 80;
  
  // Only use fancy box in wide terminals
  if (termWidth < 80 || !colorEnabled()) {
    return formatGroupedTips(tips);
  }
  
  const lines: string[] = [];
  const boxWidth = Math.min(termWidth - 4, 60);
  const border = '─'.repeat(boxWidth - 10);
  
  lines.push(SEMANTIC_COLORS.dim(`┌─ Tips ${border}`));
  tips.forEach(tip => {
    lines.push(SEMANTIC_COLORS.dim(`│ → ${tip}`));
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
  lines.push(`${SEMANTIC_COLORS.error(symbols.error)} ${chalk.bold('Error')}`);
  lines.push('');
  
  // Error message
  const message = typeof error === 'string' ? error : error.message;
  lines.push(message);
  
  // Suggestions if provided
  if (options?.suggestions && options.suggestions.length > 0) {
    lines.push('');
    lines.push(formatTips(options.suggestions, TipStyle.FIXES));
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
 * Legacy color exports for backward compatibility
 * @deprecated Use SEMANTIC_COLORS instead
 */
export const COLORS = {
  error: SEMANTIC_COLORS.error,
  warn: SEMANTIC_COLORS.warning,
  success: SEMANTIC_COLORS.success,
  info: SEMANTIC_COLORS.info,
  muted: SEMANTIC_COLORS.muted,
  highlight: SEMANTIC_COLORS.highlight,
  dim: SEMANTIC_COLORS.dim,
};

// Export symbols from the symbols module
export const SYMBOLS = getSymbols();

export function shouldDecorate(format?: string): boolean {
  const f = (format || '').toLowerCase();
  return f !== 'json' && f !== 'alfred' && colorEnabled();
}

/**
 * Icon Display Modes
 */
export enum IconMode {
  EMOJI = 'emoji',    // Full emoji support
  UTF8 = 'utf8',      // UTF-8 symbols (no emoji)
  ASCII = 'ascii'     // ASCII-only fallback
}

/**
 * Build and Job State Icons
 * Each has emoji, UTF-8, and ASCII alternatives
 */
export const STATE_ICONS = {
  PASSED: {
    emoji: '✅',
    utf8: '✓',     // U+2713 Check mark
    ascii: '[OK]'
  },
  FAILED: {
    emoji: '❌',
    utf8: '✗',     // U+2717 Ballot X
    ascii: '[FAIL]'
  },
  RUNNING: {
    emoji: '🔄',
    utf8: '↻',     // U+21BB Clockwise arrow
    ascii: '[RUN]'
  },
  BLOCKED: {
    emoji: '⏸️',
    utf8: '‖',     // U+2016 Double vertical line
    ascii: '[BLOCK]'
  },
  CANCELED: {
    emoji: '🚫',
    utf8: '⊘',     // U+2298 Circled division slash
    ascii: '[CANCEL]'
  },
  SCHEDULED: {
    emoji: '📅',
    utf8: '⏰',     // U+23F0 Alarm clock
    ascii: '[SCHED]'
  },
  SKIPPED: {
    emoji: '⏭️',
    utf8: '»',     // U+00BB Right-pointing double angle
    ascii: '[SKIP]'
  },
  UNKNOWN: {
    emoji: '❓',
    utf8: '?',     // Regular question mark
    ascii: '[?]'
  }
};

/**
 * Annotation Style Icons
 */
export const ANNOTATION_ICONS = {
  ERROR: {
    emoji: '❌',
    utf8: '✗',     // U+2717 Ballot X
    ascii: '[ERR]'
  },
  WARNING: {
    emoji: '⚠️',
    utf8: '⚠',     // U+26A0 Warning sign (without emoji variant)
    ascii: '[WARN]'
  },
  INFO: {
    emoji: 'ℹ️',
    utf8: 'ⓘ',     // U+24D8 Circled Latin small letter i
    ascii: '[INFO]'
  },
  SUCCESS: {
    emoji: '✅',
    utf8: '✓',     // U+2713 Check mark
    ascii: '[OK]'
  },
  DEFAULT: {
    emoji: '📝',
    utf8: '◆',     // U+25C6 Black diamond
    ascii: '[NOTE]'
  }
};

/**
 * Progress and Debug Icons
 */
export const PROGRESS_ICONS = {
  TIMING: {
    emoji: '⏱️',
    utf8: '⧗',     // U+29D7 Black hourglass
    ascii: '[TIME]'
  },
  STARTING: {
    emoji: '🕒',
    utf8: '◷',     // U+25F7 White circle with upper right quadrant
    ascii: '[>>>]'
  },
  RETRY: {
    emoji: '🔄',
    utf8: '↻',     // U+21BB Clockwise arrow
    ascii: '[RETRY]'
  },
  SUCCESS_LOG: {
    emoji: '✅',
    utf8: '✓',     // U+2713 Check mark
    ascii: '[✓]'
  },
  BLOCKED_MESSAGE: {
    emoji: '🚫',
    utf8: '⊘',     // U+2298 Circled division slash
    ascii: '[BLOCKED]'
  }
};

/**
 * Get current icon mode based on environment and flags
 */
export function getIconMode(): IconMode {
  // Check command-line flags first
  if (process.argv.includes('--ascii')) {
    return IconMode.ASCII;
  }
  if (process.argv.includes('--emoji')) {
    return IconMode.EMOJI;
  }
  
  // Check environment variables
  if (process.env.BKTIDE_ASCII === '1') {
    return IconMode.ASCII;
  }
  if (process.env.BKTIDE_EMOJI === '1') {
    return IconMode.EMOJI;
  }
  
  // Default to UTF-8 symbols (clean, universal, works in most modern terminals)
  // ASCII is only used if explicitly requested via flag or env var
  return IconMode.UTF8;
}

/**
 * Helper to get icon based on current mode
 */
export function getIcon(iconDef: { emoji: string; utf8: string; ascii: string }): string {
  const mode = getIconMode();
  switch (mode) {
    case IconMode.ASCII:
      return iconDef.ascii;
    case IconMode.UTF8:
      return iconDef.utf8;
    default:
      return iconDef.emoji;
  }
}

/**
 * Get state icon for build/job states
 */
export function getStateIcon(state: string): string {
  const upperState = state.toUpperCase().replace('CANCELING', 'CANCELED');
  const iconDef = STATE_ICONS[upperState as keyof typeof STATE_ICONS] || STATE_ICONS.UNKNOWN;
  return getIcon(iconDef);
}

/**
 * Get annotation style icon
 */
export function getAnnotationIcon(style: string): string {
  const upperStyle = style.toUpperCase();
  const iconDef = ANNOTATION_ICONS[upperStyle as keyof typeof ANNOTATION_ICONS] || ANNOTATION_ICONS.DEFAULT;
  return getIcon(iconDef);
}

/**
 * Get progress/debug icon
 */
export function getProgressIcon(type: keyof typeof PROGRESS_ICONS): string {
  return getIcon(PROGRESS_ICONS[type]);
}


