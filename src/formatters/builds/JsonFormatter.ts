import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Build } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  formatBuilds(builds: Build[], options?: FormatterOptions): string {
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