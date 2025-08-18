/**
 * Responsive table rendering with smart column handling
 */

import { termWidth, stripAnsi, truncate } from './width.js';

export interface ColumnConfig {
  /** Column header text */
  header: string;
  /** Priority for column visibility (higher = more important) */
  priority?: number;
  /** Minimum width in characters */
  minWidth?: number;
  /** Maximum width in characters */
  maxWidth?: number;
  /** Alignment: left, right, or center */
  align?: 'left' | 'right' | 'center';
  /** Whether to truncate with ellipsis or wrap */
  truncate?: boolean;
}

export interface ResponsiveTableOptions {
  /** Column configurations */
  columns?: ColumnConfig[];
  /** Separator between columns */
  separator?: string;
  /** Terminal width override (for testing) */
  width?: number;
  /** Force all columns visible regardless of width */
  forceAllColumns?: boolean;
}

/**
 * Calculate optimal column widths based on content and terminal width
 */
function calculateOptimalWidths(
  rows: string[][],
  columns: ColumnConfig[],
  availableWidth: number
): { widths: number[]; visibleColumns: boolean[] } {
  const numColumns = columns.length;
  const visibleColumns = new Array(numColumns).fill(true);
  
  // Calculate content widths (max width needed for each column)
  const contentWidths = columns.map((col, i) => {
    const maxContentWidth = Math.max(
      stripAnsi(col.header).length,
      ...rows.map(row => stripAnsi(row[i] ?? '').length)
    );
    return {
      min: col.minWidth ?? 3,
      max: col.maxWidth ?? maxContentWidth,
      content: maxContentWidth,
      priority: col.priority ?? 0
    };
  });
  
  // Start with ideal widths (content width capped by max)
  let widths = contentWidths.map(cw => Math.min(cw.content, cw.max));
  let totalWidth = widths.reduce((a, b) => a + b, 0);
  
  // If we fit, return as-is
  if (totalWidth <= availableWidth) {
    return { widths, visibleColumns };
  }
  
  // Try to shrink columns proportionally
  const shrinkable = contentWidths.map((cw, i) => widths[i] - cw.min);
  const totalShrinkable = shrinkable.reduce((a, b) => a + b, 0);
  
  if (totalShrinkable > 0) {
    const needToShrink = totalWidth - availableWidth;
    
    if (needToShrink <= totalShrinkable) {
      // We can fit by shrinking
      const shrinkRatio = needToShrink / totalShrinkable;
      widths = widths.map((w, i) => {
        const shrinkAmount = Math.floor(shrinkable[i] * shrinkRatio);
        return w - shrinkAmount;
      });
      return { widths, visibleColumns };
    }
  }
  
  // Still doesn't fit - hide low priority columns
  const sortedByPriority = columns
    .map((col, i) => ({ col, index: i, priority: col.priority ?? 0 }))
    .sort((a, b) => a.priority - b.priority);
  
  // Start with minimum widths
  widths = contentWidths.map(cw => cw.min);
  totalWidth = widths.reduce((a, b) => a + b, 0);
  
  // Hide columns starting with lowest priority until we fit
  for (const { index } of sortedByPriority) {
    if (totalWidth <= availableWidth) break;
    
    visibleColumns[index] = false;
    totalWidth -= widths[index];
    widths[index] = 0;
  }
  
  // Expand remaining columns if we have extra space
  const visibleIndices = visibleColumns
    .map((v, i) => v ? i : -1)
    .filter(i => i >= 0);
  
  if (visibleIndices.length > 0 && totalWidth < availableWidth) {
    const extraSpace = availableWidth - totalWidth;
    const spacePerColumn = Math.floor(extraSpace / visibleIndices.length);
    
    for (const i of visibleIndices) {
      widths[i] = Math.min(widths[i] + spacePerColumn, contentWidths[i].max);
    }
  }
  
  return { widths, visibleColumns };
}

/**
 * Align text within a given width
 */
function alignText(text: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const visibleLength = stripAnsi(text).length;
  
  if (visibleLength >= width) {
    return text; // No room for alignment
  }
  
  const padding = width - visibleLength;
  
  switch (align) {
    case 'right':
      return ' '.repeat(padding) + text;
    case 'center':
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
    default: // left
      return text + ' '.repeat(padding);
  }
}

/**
 * Format a single cell with proper width and alignment
 */
function formatCell(
  content: string,
  width: number,
  config: ColumnConfig
): string {
  if (width === 0) return ''; // Hidden column
  
  const visibleLength = stripAnsi(content).length;
  
  // Truncate or pad as needed
  let formatted: string;
  if (visibleLength > width) {
    if (config.truncate !== false) { // Default to truncate
      formatted = truncate(content, width);
    } else {
      // For wrapping, just take first line for now
      formatted = content.substring(0, width);
    }
  } else {
    formatted = content;
  }
  
  // Apply alignment
  return alignText(formatted, width, config.align);
}

/**
 * Render a responsive table that adapts to terminal width
 */
export function renderResponsiveTable(
  headers: string[],
  rows: string[][],
  options?: ResponsiveTableOptions
): string {
  const separator = options?.separator ?? '  ';
  const width = options?.width ?? termWidth();
  
  // Create default column configs if not provided
  const columns: ColumnConfig[] = options?.columns ?? headers.map(h => ({
    header: h,
    priority: 0,
    minWidth: 3,
    truncate: true
  }));
  
  // Combine headers with data for width calculation
  const allRows = [headers, ...rows];
  
  // Account for separators
  const numSeparators = columns.length - 1;
  const availableWidth = Math.max(columns.length * 3, width - (separator.length * numSeparators));
  
  // Calculate optimal widths
  const { widths, visibleColumns } = options?.forceAllColumns 
    ? { widths: columns.map((_, i) => Math.max(...allRows.map(r => stripAnsi(r[i] ?? '').length))), visibleColumns: new Array(columns.length).fill(true) }
    : calculateOptimalWidths(rows, columns, availableWidth);
  
  // Filter to visible columns
  const visibleIndices = visibleColumns
    .map((v, i) => v ? i : -1)
    .filter(i => i >= 0);
  
  if (visibleIndices.length === 0) {
    // Emergency: show at least one column
    visibleIndices.push(0);
    visibleColumns[0] = true;
    widths[0] = availableWidth;
  }
  
  // Format output
  const lines: string[] = [];
  
  // Format all rows
  for (const row of allRows) {
    const formattedCells = visibleIndices.map(i => 
      formatCell(row[i] ?? '', widths[i], columns[i])
    );
    lines.push(formattedCells.join(separator).trimEnd());
  }
  
  return lines.join('\n');
}

/**
 * Responsive list rendering for narrow terminals
 */
export function renderResponsiveList(
  items: Array<{ label: string; value: string }>,
  options?: { width?: number; labelWidth?: number }
): string {
  const width = options?.width ?? termWidth();
  const labelWidth = options?.labelWidth ?? Math.min(20, Math.floor(width * 0.3));
  
  const lines: string[] = [];
  
  for (const item of items) {
    const label = truncate(item.label, labelWidth).padEnd(labelWidth);
    const valueWidth = Math.max(10, width - labelWidth - 2);
    const value = truncate(item.value, valueWidth);
    
    lines.push(`${label}  ${value}`);
  }
  
  return lines.join('\n');
}

/**
 * Detect if terminal is narrow
 */
export function isNarrowTerminal(threshold = 80): boolean {
  return termWidth() < threshold;
}

/**
 * Detect if terminal is very narrow (mobile-like)
 */
export function isMobileTerminal(threshold = 50): boolean {
  return termWidth() < threshold;
}
