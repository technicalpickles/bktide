import { StepLogsFormatter, StepLogsData, StepLogsFormatterOptions } from './Formatter.js';

export class JsonStepLogsFormatter extends StepLogsFormatter {
  name = 'json';

  constructor(options: StepLogsFormatterOptions) {
    super(options);
  }

  format(data: StepLogsData): string {
    return JSON.stringify(data, null, 2);
  }
}
