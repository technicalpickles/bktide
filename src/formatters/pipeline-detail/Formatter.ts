import { FormatterOptions } from '../BaseFormatter.js';

export interface PipelineDetailData {
  pipeline: {
    name: string;
    slug: string;
    description?: string;
    defaultBranch?: string;
    url: string;
    repository?: {
      url: string;
    };
  };
  recentBuilds: Array<{
    number: number;
    state: string;
    branch: string;
    message: string;
    startedAt?: string;
    finishedAt?: string;
  }>;
}

export abstract class PipelineDetailFormatter {
  abstract name: string;
  
  constructor(protected options: FormatterOptions) {}

  abstract format(data: PipelineDetailData): string;
}
