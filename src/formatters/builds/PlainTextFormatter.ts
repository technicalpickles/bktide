import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Build } from '../../types/index.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatBuilds(builds: Build[], options?: FormatterOptions): string {
    if (builds.length === 0) {
      return 'No builds found.';
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
    
    return output;
  }
} 