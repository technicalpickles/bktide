import { BaseFormatter, BuildFormatterOptions } from './Formatter.js';
import { Build } from '../../types/index.js';

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
      let output = 'No builds found.';
      
      // Add user info if provided
      if (options?.userName) {
        output = `No builds found for ${options.userName}`;
        if (options?.userEmail || options?.userId) {
          output += ` (${options.userEmail || options.userId})`;
        }
        output += '.';
      }
      
      // Add organization suggestion if applicable
      if (!options?.orgSpecified) {
        output += '\nTry specifying an organization with --org to narrow your search.';
      }
      
      return output;
    }

    const lines: string[] = [];
    lines.push(`Found ${builds.length} builds:`);
    
    // Build a tabular summary view for scan-ability
    const rows: string[][] = [];
    rows.push(['PIPELINE', 'NUMBER', 'STATE', 'BRANCH']);
    builds.forEach((b: Build) => {
      rows.push([
        b.pipeline?.slug || 'Unknown',
        `#${b.number}`,
        b.state || 'Unknown',
        b.branch || 'Unknown'
      ]);
    });
    const widths = rows[0].map((_, i) => Math.max(...rows.map(r => (r[i] ?? '').length)));
    const table = rows.map(r => r.map((c, i) => (c ?? '').padEnd(widths[i])).join('  ')).join('\n');
    lines.push(table);
    
    // Detailed per-build lines (optional in future; keeping summary only for now)
    // Summary and guidance lines
    lines.push(`\nShowing ${builds.length} builds. Use --count and --page options to see more.`);
    if (options?.organizationsCount && options.organizationsCount > 1 && !options.orgSpecified) {
      lines.push(`Searched across ${options.organizationsCount} organizations. Use --org to filter to a specific organization.`);
    }
    
    return lines.join('\n');
  }
  
  private formatAccessError(options?: BuildFormatterOptions): string {
    let output = '';
    
    if (options?.userName) {
      output = `No builds found for ${options.userName}`;
      if (options?.userEmail || options?.userId) {
        output += ` (${options.userEmail || options.userId})`;
      }
      output += '. ';
    }
    
    if (options?.orgSpecified && options?.accessErrors && options.accessErrors.length > 0) {
      output += options.accessErrors[0];
    } else {
      output += 'You don\'t have access to the specified organization(s).';
    }
    
    return output;
  }
  
  private formatNotFoundError(options?: BuildFormatterOptions): string {
    let output = '';
    
    if (options?.userName) {
      output = `No builds found for ${options.userName}`;
      if (options?.userEmail || options?.userId) {
        output += ` (${options.userEmail || options.userId})`;
      }
      output += '.';
    } else {
      output = 'No builds found.';
    }
    
    if (!options?.orgSpecified) {
      output += '\nTry specifying an organization with --org to narrow your search.';
    }
    
    return output;
  }
  
  private formatApiError(options?: BuildFormatterOptions): string {
    return options?.errorMessage || 'An API error occurred while fetching builds.';
  }
  
  private formatGenericError(options?: BuildFormatterOptions): string {
    return options?.errorMessage || 'An error occurred while fetching builds.';
  }
} 