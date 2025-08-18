import { BaseBuildDetailFormatter, BuildDetail, BuildDetailFormatterOptions } from './Formatter.js';

export class AlfredFormatter extends BaseBuildDetailFormatter {
  name = 'alfred';
  
  formatBuildDetail(buildData: BuildDetail | null, options?: BuildDetailFormatterOptions): string {
    if (options?.hasError || !buildData) {
      return JSON.stringify({
        items: [{
          uid: 'error',
          title: 'Error fetching build',
          subtitle: options?.errorMessage || 'An error occurred',
          valid: false,
          icon: {
            path: './icons/error.png'
          }
        }]
      });
    }
    
    const build = buildData.build;
    const items: any[] = [];
    
    // Main build item
    const duration = this.formatDuration(build);
    const mainItem = {
      uid: build.id,
      title: `#${build.number}: ${build.message || 'No message'}`,
      subtitle: `${build.state} • ${build.branch} • ${duration}`,
      arg: build.url,
      icon: {
        path: this.getIconPath(build.state)
      },
      mods: {
        cmd: {
          subtitle: 'Open in browser',
          arg: build.url
        },
        alt: {
          subtitle: 'Copy build number',
          arg: build.number.toString()
        }
      }
    };
    
    items.push(mainItem);
    
    // Add failed jobs if present
    if (options?.failed || build.state === 'FAILED') {
      const failedJobs = (build.jobs?.edges || [])
        .filter((j: any) => j.node.state === 'FAILED' || j.node.exitStatus !== 0);
        
      for (const job of failedJobs) {
        items.push({
          uid: job.node.id,
          title: `❌ ${job.node.label}`,
          subtitle: `Failed with exit code ${job.node.exitStatus || 1}`,
          valid: false,
          icon: {
            path: './icons/failed.png'
          }
        });
      }
    }
    
    // Add annotation summary if present
    if (build.annotations?.edges?.length > 0) {
      const annotationCount = build.annotations.edges.length;
      items.push({
        uid: 'annotations',
        title: `📝 ${annotationCount} annotation${annotationCount > 1 ? 's' : ''}`,
        subtitle: 'View build annotations',
        valid: false,
        icon: {
          path: './icons/annotation.png'
        }
      });
    }
    
    return JSON.stringify({ items });
  }
  
  private formatDuration(build: any): string {
    if (!build.startedAt) {
      return 'not started';
    }
    
    const start = new Date(build.startedAt);
    const end = build.finishedAt ? new Date(build.finishedAt) : new Date();
    const durationMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    if (build.state === 'RUNNING') {
      return `${minutes}m ${seconds}s elapsed`;
    }
    
    return `${minutes}m ${seconds}s`;
  }
  
  private getIconPath(state: string): string {
    const iconMap: Record<string, string> = {
      'PASSED': './icons/passed.png',
      'FAILED': './icons/failed.png',
      'RUNNING': './icons/running.png',
      'BLOCKED': './icons/blocked.png',
      'CANCELED': './icons/canceled.png',
      'SCHEDULED': './icons/scheduled.png',
      'SKIPPED': './icons/skipped.png'
    };
    
    return iconMap[state] || './icons/unknown.png';
  }
  
  formatError(action: string, error: any): string {
    return JSON.stringify({
      items: [{
        uid: 'error',
        title: `Error ${action}`,
        subtitle: error instanceof Error ? error.message : String(error),
        valid: false,
        icon: {
          path: './icons/error.png'
        }
      }]
    });
  }
}
