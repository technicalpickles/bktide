import { BaseFormatter, BuildFormatterOptions } from './Formatter.js';
import { Build } from '../../types/index.js';

export class AlfredFormatter extends BaseFormatter {
  name = 'alfred';
  
  formatBuilds(builds: Build[], options?: BuildFormatterOptions): string {
    // Handle error cases
    if (options?.hasError) {
      let errorTitle = 'Error';
      let errorSubtitle = options.errorMessage || 'An error occurred';
      
      if (options.errorType === 'access') {
        errorTitle = 'Access Error';
        if (options.accessErrors && options.accessErrors.length > 0) {
          errorSubtitle = options.accessErrors[0];
        } else {
          errorSubtitle = 'You don\'t have access to the specified organization(s).';
        }
      } else if (options.errorType === 'not_found') {
        errorTitle = 'No Builds Found';
        if (options.userName) {
          errorSubtitle = `No builds found for ${options.userName}${options.userEmail ? ` (${options.userEmail})` : ''}.`;
        } else {
          errorSubtitle = 'No builds found.';
        }
      }
      
      const errorItem = {
        uid: 'error',
        title: errorTitle,
        subtitle: errorSubtitle,
        icon: {
          path: 'icons/error.png'
        }
      };
      
      return JSON.stringify({ items: [errorItem] }, null, 2);
    }
    
    // Handle empty results (no error, just no data)
    if (builds.length === 0) {
      let emptyTitle = 'No Builds Found';
      let emptySubtitle = options?.userName 
        ? `No builds found for ${options.userName}${options?.userEmail ? ` (${options.userEmail})` : ''}.`
        : 'No builds found.';
      
      if (!options?.orgSpecified) {
        emptySubtitle += ' Try specifying an organization with --org.';
      }
      
      const emptyItem = {
        uid: 'empty',
        title: emptyTitle,
        subtitle: emptySubtitle,
        icon: {
          path: 'icons/empty.png'
        }
      };
      
      return JSON.stringify({ items: [emptyItem] }, null, 2);
    }
    
    // Format builds as Alfred-compatible JSON items
    const alfredItems = builds.map((build: Build) => {
      // Generate web URL for the build (if not already present)
      const buildUrl = build.web_url || build.url || '';

      // Derive org/pipeline/number buildRef for alternative actions
      const orgSlug = build.organization?.slug || extractFromUrl(buildUrl, 'org');
      const pipelineSlug = build.pipeline?.slug || extractFromUrl(buildUrl, 'pipeline');
      const buildNumber = build.number;
      const buildRef = orgSlug && pipelineSlug && buildNumber ? `${orgSlug}/${pipelineSlug}/${buildNumber}` : undefined;

      const uid = `${build.pipeline?.slug || 'unknown'}-${build.number}`;
      const title = `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}`;
      const subtitle = `${build.state || 'Unknown'} • ${build.branch || 'Unknown'} • ${build.message || 'No message'}`;
      const autocomplete = `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}`;

      // Previously used for alternative subtitles; not needed with new modifiers

      const item: any = {
        uid: uid,
        title: title,
        subtitle: subtitle,
        arg: buildUrl,
        autocomplete: autocomplete,
        icon: {
          path: this.getStateIcon(build.state)
        },
        mods: {
          cmd: {
            subtitle: 'Paste URL',
            arg: buildUrl
          }
        },
        text: {
          copy: buildUrl,
          largetype: `${build.pipeline?.slug || 'Unknown pipeline'} #${build.number}\n${build.state || 'Unknown'} • ${build.branch || 'Unknown'}\n${build.message || 'No message'}`
        }
      };

      if (buildRef) {
        item.mods.alt = {
          subtitle: 'Show annotations',
          arg: buildRef
        };
      }

      return item;
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

function extractFromUrl(url: string, part: 'org' | 'pipeline'): string | undefined {
  if (!url) return undefined;
  const match = url.match(/^https?:\/\/buildkite\.com\/([^\/]+)\/([^\/]+)\/builds\/\d+\/?/i);
  if (!match) return undefined;
  return part === 'org' ? match[1] : match[2];
} 