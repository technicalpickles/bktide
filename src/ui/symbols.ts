/**
 * Symbol management with ASCII fallback support
 */

/**
 * Check if ASCII symbols should be used
 * Based on environment variable or command line flag
 */
export function useAscii(): boolean {
  return process.env.BKTIDE_ASCII === '1' || 
         process.argv.includes('--ascii');
}

/**
 * Symbol sets for different display modes
 */
const UNICODE_SYMBOLS = {
  success: '✓',
  warn: '⚠︎',
  error: '✖',
  info: 'ℹ︎',
  bullet: '•',
  arrow: '→',
  check: '✓',
  cross: '✗'
};

const ASCII_SYMBOLS = {
  success: '[OK]',
  warn: '[!]',
  error: '[X]',
  info: '[i]',
  bullet: '*',
  arrow: '->',
  check: '[v]',
  cross: '[x]'
};

/**
 * Get the appropriate symbol set based on current settings
 */
export function getSymbols(): typeof UNICODE_SYMBOLS {
  return useAscii() ? ASCII_SYMBOLS : UNICODE_SYMBOLS;
}

/**
 * Export the symbols for use throughout the application
 * This dynamically returns the appropriate set based on settings
 */
export const SYMBOLS = getSymbols();
