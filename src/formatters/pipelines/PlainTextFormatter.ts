import { AbstractFormatter } from '../BaseFormatter.js';
import { PipelineFormatter, PipelineFormatterOptions } from './Formatter.js';
import { Pipeline } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';
import { renderResponsiveTable, isNarrowTerminal, isMobileTerminal } from '../../ui/responsive-table.js';
import { SEMANTIC_COLORS, formatEmptyState, formatTips, TipStyle } from '../../ui/theme.js';

export class PlainTextFormatter extends AbstractFormatter implements PipelineFormatter {
  constructor() {
    super('plain-text');
  }

  formatPipelines(pipelines: Pipeline[], organizations: string[], options?: PipelineFormatterOptions): string {
    // If no organizations are found, handle that case
    if (organizations.length === 0) {
      return formatEmptyState(
        'No organizations found',
        ['Check your API token has the correct permissions']
      );
    }
    
    return this.format(pipelines, this.formatPipelinesImpl.bind(this, organizations), options);
  }

  private formatPipelinesImpl(organizations: string[], pipelines: Pipeline[], options?: PipelineFormatterOptions): string {
    const output: string[] = [];
    
    if (pipelines.length === 0) {
      // Build context-aware empty state message
      let message: string;
      const suggestions: string[] = [];
      
      if (options?.filterActive && options?.filterText) {
        // Filter returned no results
        message = `No pipelines match filter '${SEMANTIC_COLORS.label(options.filterText)}'`;
        suggestions.push('Try a broader search term');
        suggestions.push('The filter searches pipeline names, slugs, and descriptions');
        suggestions.push('Remove the filter to see all pipelines');
      } else if (organizations.length === 1) {
        // Specific organization has no pipelines
        message = `No pipelines found in organization ${SEMANTIC_COLORS.label(organizations[0])}`;
        suggestions.push('Check the organization name is correct');
        suggestions.push('Verify you have access to pipelines in this organization');
        suggestions.push('Run "bktide orgs" to see available organizations');
      } else {
        // No pipelines across all organizations
        message = `No pipelines found across ${organizations.length === 0 ? 'any accessible' : organizations.length.toString()} organizations`;
        suggestions.push('Check your API token has the correct permissions');
        suggestions.push('Run "bktide token --check" to verify your access');
        if (organizations.length > 0) {
          suggestions.push('Some organizations may not have any pipelines configured');
        }
      }
      
      return formatEmptyState(message, suggestions);
    }

    // Build table rows
    // Check if we're on a mobile terminal
    if (isMobileTerminal()) {
      // Use a vertical list format for very narrow terminals
      const items = pipelines.map(p => ({
        name: p.name || 'Unknown',
        slug: p.slug || '-',
        org: p.organization || '-'
      }));
      
      items.forEach((item, i) => {
        if (i > 0) output.push(''); // Separator between items
        output.push(SEMANTIC_COLORS.heading(item.name));
        output.push(`  ${SEMANTIC_COLORS.label('Slug:')} ${SEMANTIC_COLORS.dim(item.slug)}`);
        if (organizations.length > 1) {
          output.push(`  ${SEMANTIC_COLORS.label('Org:')} ${item.org}`);
        }
      });
    } else if (isNarrowTerminal()) {
      // Use responsive table for narrow terminals
      if (organizations.length > 1) {
        const headers = ['ORGANIZATION', 'NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        const dataRows: string[][] = pipelines.map((p: Pipeline) => [
          p.organization || SEMANTIC_COLORS.muted('-'),
          p.name || SEMANTIC_COLORS.muted('-'),
          p.slug ? SEMANTIC_COLORS.dim(p.slug) : SEMANTIC_COLORS.muted('-')
        ]);
        
        const columns = [
          { header: 'ORGANIZATION', priority: 2, minWidth: 8, truncate: true },
          { header: 'NAME', priority: 10, minWidth: 10, truncate: true },
          { header: 'SLUG', priority: 5, minWidth: 8, truncate: true }
        ];
        
        output.push(renderResponsiveTable(headers, dataRows, { columns }));
      } else {
        const headers = ['NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        const dataRows: string[][] = pipelines.map((p: Pipeline) => [
          p.name || SEMANTIC_COLORS.muted('-'),
          p.slug ? SEMANTIC_COLORS.dim(p.slug) : SEMANTIC_COLORS.muted('-')
        ]);
        
        const columns = [
          { header: 'NAME', priority: 10, minWidth: 15, truncate: true },
          { header: 'SLUG', priority: 5, minWidth: 10, truncate: true }
        ];
        
        output.push(renderResponsiveTable(headers, dataRows, { columns }));
      }
    } else {
      // Use standard table for wide terminals
      const rows: string[][] = [];
      if (organizations.length > 1) {
        const headers = ['ORGANIZATION', 'NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        rows.push(headers);
        pipelines.forEach((p: Pipeline) => {
          rows.push([
            p.organization || SEMANTIC_COLORS.muted('-'),
            p.name || SEMANTIC_COLORS.muted('-'),
            p.slug ? SEMANTIC_COLORS.dim(p.slug) : SEMANTIC_COLORS.muted('-')
          ]);
        });
      } else {
        const headers = ['NAME', 'SLUG'].map(h => SEMANTIC_COLORS.heading(h));
        rows.push(headers);
        pipelines.forEach((p: Pipeline) => {
          rows.push([
            p.name || SEMANTIC_COLORS.muted('-'),
            p.slug ? SEMANTIC_COLORS.dim(p.slug) : SEMANTIC_COLORS.muted('-')
          ]);
        });
      }
      output.push(renderTable(rows, { preserveWidths: true }));
    }
    
    // Summary line (dimmed)
    output.push('');
    
    // Check if we're showing a subset (we hit the limit and there might be more)
    // But NOT when filtering (filtered results are already a subset)
    const isShowingSubset = !options?.filterActive && (
      options?.hasMoreAvailable || 
      (options?.truncated && pipelines.length >= (options?.requestedLimit || 0))
    );
    
    if (organizations.length === 1) {
      if (isShowingSubset) {
        output.push(SEMANTIC_COLORS.dim(
          `Showing ${SEMANTIC_COLORS.count(pipelines.length.toString())} pipelines from ${organizations[0]}`
        ));
      } else {
        output.push(SEMANTIC_COLORS.dim(
          `${SEMANTIC_COLORS.count(pipelines.length.toString())} ${pipelines.length === 1 ? 'pipeline' : 'pipelines'} in ${organizations[0]}`
        ));
      }
    } else {
      if (isShowingSubset) {
        output.push(SEMANTIC_COLORS.dim(
          `Showing ${SEMANTIC_COLORS.count(pipelines.length.toString())} pipelines from ${organizations.length} organizations`
        ));
      } else {
        output.push(SEMANTIC_COLORS.dim(
          `${SEMANTIC_COLORS.count(pipelines.length.toString())} pipelines across ${organizations.length} organizations`
        ));
      }
    }
    
    // Add contextual hints based on results
    const hints: string[] = [];
    
    // Add filter hints
    if (options?.filterActive && options?.filterText) {
      output.push(SEMANTIC_COLORS.dim(`Showing pipelines matching '${options.filterText}'`));
      hints.push(`Remove --filter to see all pipelines`);
    } else if (pipelines.length > 20) {
      // Many pipelines - suggest filtering
      hints.push(`Use --filter <text> to search by name or description`);
    }
    
    // Add organization hints
    if (organizations.length > 1 && !options?.orgSpecified) {
      hints.push(`Use --org <name> to focus on a specific organization`);
    }
    
    // Add pagination hints
    if (options?.truncated || options?.hasMoreAvailable) {
      const currentCount = pipelines.length;
      const requestedLimit = options?.requestedLimit || currentCount;
      
      // Only show pagination hints if we actually hit the limit
      // (not if we got fewer results than requested)
      if (currentCount >= requestedLimit) {
        // Calculate reasonable next count suggestion
        let nextCount: number;
        if (requestedLimit < 100) {
          nextCount = Math.min(requestedLimit * 2, 100);  // Double up to 100
        } else if (requestedLimit < 500) {
          nextCount = Math.min(requestedLimit + 100, 500);  // Add 100 up to 500
        } else {
          nextCount = requestedLimit + 250;  // Add 250 for larger requests
        }
        
        // Show pagination hint without duplicating the count
        if (options?.hasMoreAvailable || options?.truncated) {
          hints.push(`Use --count ${nextCount} to see more`);
        }
      }
    }
    
    // Display hints if any
    if (hints.length > 0) {
      output.push('');
      output.push(formatTips(hints, TipStyle.GROUPED));
    }
    
    return output.join('\n');
  }
} 