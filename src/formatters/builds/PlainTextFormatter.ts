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

    let output = `Found ${builds.length} builds:\n`;
    output += '==============================================\n';
    
    builds.forEach((build: Build) => {
      try {
        output += `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}\n`;
        output += `State: ${build.state || 'Unknown'}\n`;
        output += `Branch: ${build.branch || 'Unknown'}\n`;
        output += `Message: ${build.message || 'No message'}\n`;
        
        const createdDate = (build.created_at || build.createdAt) ? 
          new Date(build.created_at || build.createdAt as string).toLocaleString() : 'Unknown';
        
        const startedDate = (build.started_at || build.startedAt) ? 
          new Date(build.started_at || build.startedAt as string).toLocaleString() : 'Not started';
        
        const finishedDate = (build.finished_at || build.finishedAt) ? 
          new Date(build.finished_at || build.finishedAt as string).toLocaleString() : 'Not finished';
        
        output += `Created: ${createdDate}\n`;
        output += `Started: ${startedDate}\n`;
        output += `Finished: ${finishedDate}\n`;
        output += `URL: ${build.web_url || build.url || 'No URL'}\n`;
        output += '------------------\n';
      } catch (error) {
        output += `Error displaying build: ${error}\n`;
        if (options?.debug) {
          output += `Build data: ${JSON.stringify(build, null, 2)}\n`;
        }
        output += '------------------\n';
      }
    });
    
    // Summary and guidance lines
    output += `\nShowing ${builds.length} builds. Use --count and --page options to see more.\n`;
    if (options?.organizationsCount && options.organizationsCount > 1 && !options.orgSpecified) {
      output += `Searched across ${options.organizationsCount} organizations. Use --org to filter to a specific organization.\n`;
    }
    
    return output;
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