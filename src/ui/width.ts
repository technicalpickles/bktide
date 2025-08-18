/**
 * Terminal width utilities for responsive display
 */

/**
 * Strip ANSI escape codes from a string
 * Used for accurate length calculations
 */
export function stripAnsi(str: string): string {
  // Comprehensive regex for ANSI escape codes
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return str.replace(ansiRegex, '');
}

/**
 * Get the current terminal width
 * Falls back to 80 columns if not available
 */
export function termWidth(): number {
  // Ensure minimum width of 40 for readability
  return Math.max(40, process.stdout.columns || 80);
}

/**
 * Truncate text to fit within a maximum width
 * Adds ellipsis if text is truncated
 */
export function truncate(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  if (maxWidth <= 1) return text[0] || '';
  return text.slice(0, Math.max(0, maxWidth - 1)) + '…';
}

/**
 * Wrap text to fit within a maximum width
 * Returns an array of lines
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];
  if (text.length <= maxWidth) return [text];
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    // If a single word is longer than maxWidth, we need to break it
    if (word.length > maxWidth) {
      // Finish current line if it has content
      if (currentLine) {
        lines.push(currentLine.trim());
        currentLine = '';
      }
      // Break the long word into chunks
      let remaining = word;
      while (remaining.length > maxWidth) {
        lines.push(remaining.slice(0, maxWidth - 1) + '-');
        remaining = remaining.slice(maxWidth - 1);
      }
      currentLine = remaining;
    } else if ((currentLine + ' ' + word).trim().length > maxWidth) {
      // Start a new line
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      // Add word to current line
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  
  // Add any remaining text
  if (currentLine) lines.push(currentLine.trim());
  
  return lines.length > 0 ? lines : [''];
}

/**
 * Calculate column widths for a table based on terminal width
 * Distributes available width evenly among columns
 */
export function calculateColumnWidths(
  numColumns: number,
  terminalWidth: number,
  padding = 2
): number[] {
  if (numColumns <= 0) return [];
  
  // Account for padding between columns (not after last column)
  const totalPadding = padding * (numColumns - 1);
  const availableWidth = Math.max(numColumns, terminalWidth - totalPadding);
  
  // Distribute width evenly
  const baseWidth = Math.floor(availableWidth / numColumns);
  const remainder = availableWidth % numColumns;
  
  // Create array with base widths
  const widths = new Array(numColumns).fill(baseWidth);
  
  // Distribute remainder to first columns
  for (let i = 0; i < remainder; i++) {
    widths[i]++;
  }
  
  return widths;
}

/**
 * Format a table row with proper column widths and truncation
 */
export function formatTableRow(
  cells: string[],
  columnWidths: number[],
  separator = '  '
): string {
  return cells
    .map((cell, i) => {
      const width = columnWidths[i] || 10;
      return truncate(cell ?? '', width).padEnd(width);
    })
    .join(separator);
}
