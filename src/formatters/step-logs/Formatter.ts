import { FormatterOptions } from '../BaseFormatter.js';

export interface StepLogsData {
  build: {
    org: string;
    pipeline: string;
    number: number;
    state: string;
    startedAt?: string;
    finishedAt?: string;
    url: string;
  };
  step: {
    id: string;
    label?: string;
    state: string;
    exitStatus?: number;
    startedAt?: string;
    finishedAt?: string;
  };
  logs: {
    content: string;
    size: number;
    totalLines: number;
    displayedLines: number;
    startLine: number;
  };
}

export interface StepLogsFormatterOptions extends FormatterOptions {
  full?: boolean;
  lines?: number;
}

export abstract class StepLogsFormatter {
  abstract name: string;
  protected options: StepLogsFormatterOptions;

  constructor(options: StepLogsFormatterOptions) {
    this.options = options;
  }

  abstract format(data: StepLogsData): string;
}
