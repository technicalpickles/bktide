import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Build } from '../../types/index.js';

export class AlfredFormatter extends BaseFormatter {
  name = 'alfred';
  
  formatBuilds(builds: Build[], options?: FormatterOptions): string {
    // Format builds as Alfred-compatible JSON items
    const alfredItems = builds.map((build: Build) => {
      // Generate web URL for the build (if not already present)
      const buildUrl = build.web_url || build.url || '';
      
      const uid = `${build.pipeline?.slug || 'unknown'}-${build.number}`;
      const title = `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}`;
      const subtitle = `${build.state || 'Unknown'} • ${build.branch || 'Unknown'} • ${build.message || 'No message'}`;
      const autocomplete = `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}`;

      const createdDate = (build.created_at || build.createdAt) ? 
        new Date(build.created_at || build.createdAt as string).toLocaleString() : 'Unknown';
      
      const startedDate = (build.started_at || build.startedAt) ? 
        `Started: ${new Date(build.started_at || build.startedAt as string).toLocaleString()}` : 'Not started';
      
      const finishedDate = (build.finished_at || build.finishedAt) ? 
        `Finished: ${new Date(build.finished_at || build.finishedAt as string).toLocaleString()}` : 'Not finished';

      return {
        uid: uid,
        title: title,
        subtitle: subtitle,
        arg: buildUrl,
        autocomplete: autocomplete,
        icon: {
          path: this.getStateIcon(build.state)
        },
        mods: {
          alt: {
            subtitle: `Created: ${createdDate}`,
            arg: buildUrl
          },
          cmd: {
            subtitle: `${startedDate} • ${finishedDate}`,
            arg: buildUrl
          }
        },
        text: {
          copy: buildUrl,
          largetype: `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}\n${build.state || 'Unknown'} • ${build.branch || 'Unknown'}\n${build.message || 'No message'}`
        }
      };
    });
    
    // Return formatted JSON for Alfred
    return JSON.stringify({ items: alfredItems }, null, 2);
  }
  
  private getStateIcon(state?: string): string {
    if (!state) return 'icons/unknown.png';
    
    const normalizedState = state.toLowerCase();
    switch (normalizedState) {
      case 'passed':
        return 'icons/passed.png';
      case 'failed':
        return 'icons/failed.png';
      case 'running':
        return 'icons/running.png';
      case 'scheduled':
        return 'icons/scheduled.png';
      case 'canceled':
        return 'icons/canceled.png';
      case 'canceling':
        return 'icons/canceling.png';
      case 'skipped':
        return 'icons/skipped.png';
      case 'not_run':
        return 'icons/not_run.png';
      default:
        return 'icons/unknown.png';
    }
  }
} 