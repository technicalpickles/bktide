import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';

export class AlfredFormatter extends BaseFormatter {
  formatPipelines(pipelines: any[], organizations: string[], options?: FormatterOptions): string {
    // Format pipelines as Alfred-compatible JSON items
    const alfredItems = pipelines.map((pipeline: any) => {
      // Generate web URL for the pipeline (if not already present)
      const pipelineUrl = pipeline.url || 
        `https://buildkite.com/${pipeline.organization}/${pipeline.slug}`;
      
      const title = pipeline.name;
      const subtitle = pipeline.description || '';
      const uid = `${pipeline.organization}-${pipeline.slug}`;

      return {
        uid: uid,
        title: title,
        subtitle: subtitle,
        arg: pipelineUrl,
        autocomplete: `${pipeline.organization}/${pipeline.name}`,
        mods: {
          alt: {
            subtitle: `Organization: ${pipeline.organization}`,
            arg: pipelineUrl
          },
          cmd: {
            subtitle: `Slug: ${pipeline.slug}`,
            arg: pipelineUrl
          }
        },
        text: {
          copy: pipelineUrl,
          largetype: `${pipeline.name}\nOrganization: ${pipeline.organization}\nSlug: ${pipeline.slug}`
        }
      };
    });
    
    // Return formatted JSON for Alfred
    return JSON.stringify({ items: alfredItems }, null, 2);
  }
} 