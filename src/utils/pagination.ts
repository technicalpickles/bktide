/**
 * Utilities for handling pagination in API responses
 */

import { ProgressBar } from '../ui/progress.js';

/**
 * Parse Link header from REST API responses
 * Following RFC 5988 standard for web linking
 */
export interface LinkHeaderInfo {
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
  lastPage?: number;
  totalPages?: number;
}

/**
 * Parse a Link header string into structured data
 * @param header The Link header value from the response
 * @returns Parsed link information including page numbers
 */
export function parseLinkHeader(header: string): LinkHeaderInfo {
  const links: LinkHeaderInfo = {};
  
  if (!header) return links;
  
  // Match: <url>; rel="relation"
  const regex = /<([^>]+)>;\s*rel="([^"]+)"/g;
  let match;
  
  while ((match = regex.exec(header)) !== null) {
    const url = match[1];
    const rel = match[2];
    
    // Store the URL for each relation
    if (rel === 'next') links.next = url;
    if (rel === 'prev') links.prev = url;
    if (rel === 'first') links.first = url;
    if (rel === 'last') links.last = url;
    
    // Extract page number from last page
    if (rel === 'last') {
      const pageMatch = url.match(/[?&]page=(\d+)/);
      if (pageMatch) {
        links.lastPage = parseInt(pageMatch[1], 10);
        links.totalPages = links.lastPage;
      }
    }
  }
  
  return links;
}

/**
 * Helper to run operations on a list of items with progress tracking
 * @param items Array of items to process
 * @param operation Async operation to run for each item
 * @param options Configuration for progress display
 */
export async function withCountedProgress<T>(
  items: T[],
  operation: (item: T, index: number) => Promise<void>,
  options: {
    label?: string;
    format?: string;
    itemLabel?: (item: T, index: number) => string;
    showPercentage?: boolean;
    showCounts?: boolean;
    onComplete?: (count: number) => string;
  } = {}
): Promise<void> {
  if (!items || items.length === 0) {
    return;
  }
  
  const progress = new ProgressBar({
    total: items.length,
    label: options.label || 'Processing',
    showPercentage: options.showPercentage !== false,
    showCounts: options.showCounts === true,
    format: options.format
  });
  
  progress.start();
  
  try {
    for (let i = 0; i < items.length; i++) {
      const label = options.itemLabel ? 
        options.itemLabel(items[i], i) : 
        `Processing item ${i + 1}/${items.length}`;
      
      progress.update(i, label);
      await operation(items[i], i);
    }
    
    // Update to 100%
    progress.update(items.length, 'Complete');
    
    // Show completion message
    const completeMessage = options.onComplete ?
      options.onComplete(items.length) :
      `Processed ${items.length} items`;
    
    progress.complete(completeMessage);
  } catch (error) {
    progress.stop();
    throw error;
  }
}

/**
 * Extract current page number from URL
 */
export function getCurrentPage(url: string): number {
  const match = url.match(/[?&]page=(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Check if we can show determinate progress based on headers
 */
export function canShowDeterminateProgress(linkHeader: string | null): boolean {
  if (!linkHeader) return false;
  const info = parseLinkHeader(linkHeader);
  return info.totalPages !== undefined && info.totalPages > 0;
}
