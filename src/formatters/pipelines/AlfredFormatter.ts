import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { Pipeline } from '../../types/index.js';

export class AlfredFormatter extends BaseFormatter {
  name = 'alfred';
  
  formatPipelines(pipelines: Pipeline[], _organizations: string[], _options?: FormatterOptions): string {
    // Format pipelines as Alfred-compatible JSON items
    const alfredItems = pipelines.map((pipeline: Pipeline) => {
      // Generate web URL for the pipeline (if not already present)
      const pipelineUrl = pipeline.url || 
        `https://buildkite.com/${pipeline.organization}/${pipeline.slug}`;
      
      const uid = pipeline.uuid;
      const title = pipeline.slug;
      const subtitle = pipeline.description || '';
      const autocomplete = `${pipeline.organization}/${pipeline.name}`;
      const match = `${pipeline.organization}/${pipeline.slug}`;

      return {
        uid: uid,
        title: title,
        subtitle: subtitle,
        match: match,
        arg: pipelineUrl,
        autocomplete: autocomplete,
        mods: {
          alt: {
            subtitle: `Organization: ${pipeline.organization}`,
            arg: pipelineUrl
          },
          cmd: {
            subtitle: `Name: ${pipeline.name}`,
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