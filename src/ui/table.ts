import { termWidth, calculateColumnWidths, formatTableRow, stripAnsi } from './width.js';

/**
 * Render a table with proper width awareness
 * @param rows - Array of rows, each row is an array of cells
 * @param options - Optional configuration
 * @returns Formatted table string
 */
export function renderTable(
  rows: string[][], 
  options?: { 
    preserveWidths?: boolean;
    separator?: string;
  }
): string {
  if (!rows || rows.length === 0) return '';
  
  const numColumns = rows[0].length;
  const separator = options?.separator ?? '  ';
  
  if (options?.preserveWidths) {
    // Calculate widths based on visible text (excluding ANSI codes)
    const widths = rows[0].map((_, i) => 
      Math.max(...rows.map(r => stripAnsi(r[i] ?? '').length))
    );
    
    // Format each row with proper padding based on visible length
    return rows
      .map(r => r.map((c, i) => {
        const visibleLength = stripAnsi(c ?? '').length;
        const padding = ' '.repeat(Math.max(0, widths[i] - visibleLength));
        return (c ?? '') + padding;
      }).join(separator))
      .join('\n');
  }
  
  // Width-aware behavior: responsive tables that fit terminal width
  const width = termWidth();
  const columnWidths = calculateColumnWidths(numColumns, width, separator.length);
  
  return rows
    .map(row => formatTableRow(row, columnWidths, separator))
    .join('\n');
}


