import { BaseFormatter, BuildFormatterOptions } from './Formatter.js';
import { Build } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';
import { renderResponsiveTable, isNarrowTerminal, isMobileTerminal } from '../../ui/responsive-table.js';
import { 
  SEMANTIC_COLORS, 
  formatBuildStatus,
  formatEmptyState,
  formatError,
  formatTips,
  TipStyle
} from '../../ui/theme.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatBuilds(builds: Build[], options?: BuildFormatterOptions): string {
    // Handle error cases first
    if (options?.hasError) {
      if (options.errorType === 'access') {
        return this.formatAccessError(options);
      } else if (options.errorType === 'not_found') {
        return this.formatNotFoundError(options);
      } else if (options.errorType === 'api') {
        return this.formatApiError(options);
      } else {
        return this.formatGenericError(options);
      }
    }
    
    // Handle empty results (no error, just no data)
    if (builds.length === 0) {
      let message = 'No builds found';
      const suggestions: string[] = [];
      
      // Add user info if provided
      if (options?.userName) {
        message = `No builds found for ${SEMANTIC_COLORS.label(options.userName)}`;
        if (options?.userEmail || options?.userId) {
          message += ` ${SEMANTIC_COLORS.dim(`(${options.userEmail || options.userId})`)}`;
        }
      }
      
      // Add suggestions based on context
      if (!options?.orgSpecified) {
        suggestions.push('Try specifying an organization with --org <name>');
      }
      suggestions.push('Use --count to increase the number of results');
      
      return formatEmptyState(message, suggestions);
    }

    const lines: string[] = [];
    
    // Build a tabular summary view for scan-ability
    const headers = ['PIPELINE', 'NUMBER', 'STATE', 'BRANCH'].map(
      h => SEMANTIC_COLORS.heading(h)
    );
    
    const dataRows: string[][] = [];
    builds.forEach((b: Build) => {
      dataRows.push([
        b.pipeline?.slug || SEMANTIC_COLORS.muted('unknown'),
        SEMANTIC_COLORS.identifier(`#${b.number}`),
        formatBuildStatus(b.state || 'UNKNOWN', { useSymbol: false }),
        b.branch || SEMANTIC_COLORS.dim('(no branch)')
      ]);
    });
    
    // Use responsive table for narrow terminals
    if (isNarrowTerminal()) {
      // Configure columns with priorities for narrow displays
      const columns = [
        { header: 'PIPELINE', priority: 3, minWidth: 10, truncate: true },
        { header: 'NUMBER', priority: 10, minWidth: 6, align: 'right' as const },
        { header: 'STATE', priority: 9, minWidth: 8 },
        { header: 'BRANCH', priority: 1, minWidth: 6, truncate: true }
      ];
      
      if (isMobileTerminal()) {
        // For very narrow terminals, show only most important columns
        columns[0].priority = 2; // Lower pipeline priority
        columns[3].priority = 0; // Hide branch on mobile
      }
      
      lines.push(renderResponsiveTable(headers, dataRows, { columns }));
    } else {
      // Use standard table for wide terminals
      const rows: string[][] = [headers, ...dataRows];
      lines.push(renderTable(rows, { preserveWidths: true }));
    }
    
    // Summary line (dimmed as auxiliary info)
    lines.push('');
    lines.push(SEMANTIC_COLORS.dim(`Found ${SEMANTIC_COLORS.count(builds.length.toString())} builds`));
    
    // Add contextual hints if searching multiple orgs
    if (options?.organizationsCount && options.organizationsCount > 1 && !options.orgSpecified) {
      const hints = [`Searched across ${options.organizationsCount} organizations. Use --org to filter to a specific organization.`];
      lines.push('');
      lines.push(formatTips(hints, TipStyle.INDIVIDUAL));
    }
    
    return lines.join('\n');
  }
  
  private formatAccessError(options?: BuildFormatterOptions): string {
    let message = 'Access Denied';
    
    if (options?.orgSpecified && options?.accessErrors && options.accessErrors.length > 0) {
      message = options.accessErrors[0];
    } else {
      message = 'You don\'t have access to the specified organization(s).';
    }
    
    return formatError(message, {
      showHelp: true,
      helpCommand: 'bktide orgs',
      suggestions: [
        'Check your organization name is correct',
        'Run "bktide orgs" to see available organizations',
        'Verify your token has the correct permissions'
      ]
    });
  }
  
  private formatNotFoundError(options?: BuildFormatterOptions): string {
    let message = 'No builds found';
    
    if (options?.userName) {
      message = `No builds found for ${options.userName}`;
      if (options?.userEmail || options?.userId) {
        message += ` (${options.userEmail || options.userId})`;
      }
    }
    
    const suggestions: string[] = [];
    if (!options?.orgSpecified) {
      suggestions.push('Try specifying an organization with --org <name>');
    }
    suggestions.push('Check your filters are correct');
    suggestions.push('Try broadening your search');
    
    return formatEmptyState(message, suggestions);
  }
  
  private formatApiError(options?: BuildFormatterOptions): string {
    const message = options?.errorMessage || 'Failed to fetch builds from Buildkite';
    return formatError(message, {
      showHelp: true,
      helpCommand: 'bktide builds --help',
      suggestions: ['This might be a temporary issue. Try again in a moment.']
    });
  }
  
  private formatGenericError(options?: BuildFormatterOptions): string {
    const message = options?.errorMessage || 'An unexpected error occurred';
    return formatError(message, {
      showHelp: true,
      helpCommand: 'bktide builds --help'
    });
  }
} 