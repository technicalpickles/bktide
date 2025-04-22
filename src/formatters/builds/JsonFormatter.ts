import { BaseFormatter, BuildFormatterOptions } from './Formatter.js';
import { Build } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  name = 'json';
  
  formatBuilds(builds: Build[], options?: BuildFormatterOptions): string {
    // Handle error cases
    if (options?.hasError) {
      const errorResult = {
        error: true,
        errorType: options.errorType || 'unknown',
        message: options.errorMessage || 'An error occurred',
        accessErrors: options.accessErrors || []
      };
      
      return JSON.stringify(errorResult, null, 2);
    }
    
    // Handle empty results (no error, just no data)
    if (builds.length === 0) {
      const emptyResult = {
        count: 0,
        builds: [],
        message: options?.userName 
          ? `No builds found for ${options.userName}${options?.userEmail ? ` (${options.userEmail})` : ''}.`
          : 'No builds found.'
      };
      
      return JSON.stringify(emptyResult, null, 2);
    }
    
    // Normal case with builds
    const result = {
      count: builds.length,
      builds: builds.map((build: Build) => ({
        pipeline: build.pipeline?.slug || 'Unknown pipeline',
        number: build.number,
        branch: build.branch || 'Unknown',
        state: build.state || 'Unknown',
        message: build.message || 'No message',
        url: build.web_url || build.url || 'No URL',
        created_at: build.created_at || build.createdAt || null,
        started_at: build.started_at || build.startedAt || null,
        finished_at: build.finished_at || build.finishedAt || null
      }))
    };
    
    return JSON.stringify(result, null, 2);
  }
} 