import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';

export class PlainTextFormatter extends BaseFormatter {
  formatBuilds(builds: any[], options?: FormatterOptions): string {
    if (builds.length === 0) {
      return 'No builds found.';
    }

    let output = `Found ${builds.length} builds:\n`;
    output += '==============================================\n';
    
    builds.forEach((build: any) => {
      try {
        output += `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}\n`;
        output += `State: ${build.state || 'Unknown'}\n`;
        output += `Branch: ${build.branch || 'Unknown'}\n`;
        output += `Message: ${build.message || 'No message'}\n`;
        output += `Created: ${build.created_at || build.createdAt ? new Date(build.created_at || build.createdAt).toLocaleString() : 'Unknown'}\n`;
        output += `Started: ${build.started_at || build.startedAt ? new Date(build.started_at || build.startedAt).toLocaleString() : 'Not started'}\n`;
        output += `Finished: ${build.finished_at || build.finishedAt ? new Date(build.finished_at || build.finishedAt).toLocaleString() : 'Not finished'}\n`;
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