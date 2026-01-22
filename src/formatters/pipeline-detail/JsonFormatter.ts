import { PipelineDetailFormatter, PipelineDetailData } from './Formatter.js';
import { FormatterOptions } from '../BaseFormatter.js';

export class JsonPipelineDetailFormatter extends PipelineDetailFormatter {
  name = 'json';

  constructor(options: FormatterOptions) {
    super(options);
  }

  format(data: PipelineDetailData): string {
    return JSON.stringify(data, null, 2);
  }
}
