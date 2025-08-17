import { termWidth, calculateColumnWidths, formatTableRow } from './width.js';

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
    // Legacy behavior: preserve exact widths (may overflow in narrow terminals)
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
    return rows
      .map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join(separator))
      .join('\n');
  }
  
  // Width-aware behavior: responsive tables that fit terminal width
  const width = termWidth();
  const columnWidths = calculateColumnWidths(numColumns, width, separator.length);
  
  return rows
    .map(row => formatTableRow(row, columnWidths, separator))
    .join('\n');
}


