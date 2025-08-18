/**
 * Enhanced Plain Text Formatter for Builds
 * Implements the visual design system for better UX
 */
import { BaseFormatter, BuildFormatterOptions } from './Formatter.js';
import { Build } from '../../types/index.js';
import { renderTable } from '../../ui/table.js';
import { 
  SEMANTIC_COLORS, 
  BUILD_STATUS_THEME,
  formatBuildStatus,
  formatEmptyState,
  formatTipBox,
  HIERARCHY
} from '../../ui/theme-v2.js';

export class PlainTextFormatterV2 extends BaseFormatter {
  name = 'plain-text-v2';
  
  formatBuilds(builds: Build[], options?: BuildFormatterOptions): string {
    // Handle error cases first
    if (options?.hasError) {
      return this.formatError(options);
    }
    
    // Handle empty results
    if (builds.length === 0) {
      return this.formatEmpty(options);
    }

    const lines: string[] = [];
    
    // Section header with visual emphasis
    lines.push(SEMANTIC_COLORS.heading('Build Results'));
    lines.push(''); // Visual spacing
    
    // Build the enhanced table
    lines.push(this.formatTable(builds));
    lines.push('');
    
    // Summary line (dimmed to be auxiliary)
    const summary = this.formatSummary(builds, options);
    if (summary) {
      lines.push(summary);
    }
    
    // Tips at the end, visually separated
    const tips = this.generateTips(builds, options);
    if (tips.length > 0) {
      lines.push('');
      lines.push(formatTipBox(tips));
    }
    
    return lines.join('\n');
  }
  
  private formatTable(builds: Build[]): string {
    // Table headers with emphasis
    const headers = [
      SEMANTIC_COLORS.label('PIPELINE'),
      SEMANTIC_COLORS.label('BUILD'),
      SEMANTIC_COLORS.label('STATUS'),
      SEMANTIC_COLORS.label('BRANCH'),
      SEMANTIC_COLORS.label('CREATED BY')
    ];
    
    // Table rows with semantic coloring
    const rows = builds.map(build => this.formatBuildRow(build));
    
    return renderTable([headers, ...rows]);
  }
  
  private formatBuildRow(build: Build): string[] {
    return [
      // Pipeline name - standard
      build.pipeline?.slug || SEMANTIC_COLORS.muted('unknown'),
      
      // Build number - as identifier
      SEMANTIC_COLORS.identifier(`#${build.number}`),
      
      // Status - with color and symbol
      formatBuildStatus(build.state || 'UNKNOWN', { useSymbol: true }),
      
      // Branch - standard or dimmed if missing
      build.branch || SEMANTIC_COLORS.dim('(no branch)'),
      
      // Creator - secondary information
      SEMANTIC_COLORS.dim(this.formatCreator(build))
    ];
  }
  
  private formatCreator(build: Build): string {
    if (build.createdBy?.name) {
      return build.createdBy.name;
    }
    if (build.creator?.name) {
      return build.creator.name;
    }
    return 'system';
  }
  
  private formatSummary(builds: Build[], options?: BuildFormatterOptions): string {
    const parts: string[] = [];
    
    // Build count
    parts.push(SEMANTIC_COLORS.dim(
      `Showing ${SEMANTIC_COLORS.count(builds.length.toString())} builds`
    ));
    
    // Add filter context if applicable
    const filters: string[] = [];
    if (options?.filters?.state) {
      filters.push(`state: ${options.filters.state}`);
    }
    if (options?.filters?.branch) {
      filters.push(`branch: ${options.filters.branch}`);
    }
    
    if (filters.length > 0) {
      parts.push(SEMANTIC_COLORS.dim(`(filtered by ${filters.join(', ')})`));
    }
    
    // Organization context
    if (options?.organizationsCount && options.organizationsCount > 1 && !options.orgSpecified) {
      parts.push(SEMANTIC_COLORS.dim(`across ${options.organizationsCount} organizations`));
    }
    
    return parts.join(' ');
  }
  
  private generateTips(builds: Build[], options?: BuildFormatterOptions): string[] {
    const tips: string[] = [];
    
    // Tip about seeing more builds
    if (builds.length >= 10) {
      tips.push('Use --count 20 to see more builds');
    }
    
    // Tip about filtering if not already filtered
    if (!options?.filters?.state) {
      tips.push('Filter by state: --state failed');
    }
    if (!options?.filters?.branch) {
      tips.push('Filter by branch: --branch main');
    }
    
    // Tip about organization if searching multiple
    if (options?.organizationsCount && options.organizationsCount > 1 && !options.orgSpecified) {
      tips.push('Use --org to focus on a specific organization');
    }
    
    return tips;
  }
  
  private formatEmpty(options?: BuildFormatterOptions): string {
    let message = 'No builds found';
    const suggestions: string[] = [];
    
    // Add context if available
    if (options?.userName) {
      message = `No builds found for ${SEMANTIC_COLORS.label(options.userName)}`;
      if (options?.userEmail) {
        message += ` ${SEMANTIC_COLORS.dim(`(${options.userEmail})`)}`;
      }
    }
    
    // Add suggestions based on context
    if (!options?.orgSpecified) {
      suggestions.push('Try specifying an organization with --org <name>');
    }
    
    if (options?.filters?.state) {
      suggestions.push('Try removing the state filter or using a different state');
    }
    
    if (options?.filters?.branch) {
      suggestions.push('Try a different branch or remove the --branch filter');
    }
    
    suggestions.push('Use --count to increase the number of results');
    
    return formatEmptyState(message, suggestions);
  }
  
  private formatError(options?: BuildFormatterOptions): string {
    const lines: string[] = [];
    
    if (options?.errorType === 'access') {
      lines.push(HIERARCHY.critical('Access Denied'));
      lines.push('');
      
      if (options?.accessErrors && options.accessErrors.length > 0) {
        lines.push(options.accessErrors[0]);
      } else {
        lines.push('You don\'t have access to the specified organization(s).');
      }
      
      lines.push('');
      lines.push(SEMANTIC_COLORS.dim('Try one of these:'));
      lines.push(SEMANTIC_COLORS.dim('  • Check your organization name is correct'));
      lines.push(SEMANTIC_COLORS.dim('  • Run "bktide orgs" to see available organizations'));
      lines.push(SEMANTIC_COLORS.dim('  • Verify your token has the correct permissions'));
      
    } else if (options?.errorType === 'not_found') {
      lines.push(formatEmptyState(
        'No builds found matching your criteria',
        [
          'Check your filters are correct',
          'Try broadening your search',
          'Use "bktide builds --help" for usage examples'
        ]
      ));
      
    } else if (options?.errorType === 'api') {
      lines.push(HIERARCHY.critical('API Error'));
      lines.push('');
      lines.push(options?.errorMessage || 'Failed to fetch builds from Buildkite');
      lines.push('');
      lines.push(SEMANTIC_COLORS.help('This might be a temporary issue. Try again in a moment.'));
      
    } else {
      lines.push(HIERARCHY.critical('Error'));
      lines.push('');
      lines.push(options?.errorMessage || 'An unexpected error occurred');
    }
    
    return lines.join('\n');
  }
}

/**
 * Example output with visual design:
 * 
 * Build Results                            <- Bold + Underline
 * ─────────────────────────────────────────
 * 
 * PIPELINE     BUILD    STATUS       BRANCH    CREATED BY    <- Bold headers
 * payments     #1234    ✓ PASSED     main      John Doe      <- Blue for passed
 * api-server   #5678    ✖ FAILED     fix-bug   Jane Smith    <- Orange for failed
 * frontend     #9101    ↻ RUNNING    develop   Bot           <- Cyan for running
 * 
 * Showing 3 builds across 2 organizations                     <- Dimmed summary
 * 
 * ┌─ Tips ────────────────────────────                       <- Dimmed box
 * │ • Use --count 20 to see more builds
 * │ • Filter by state: --state failed
 * │ • Use --org to focus on a specific organization
 * └────────────────────────────────────
 */
