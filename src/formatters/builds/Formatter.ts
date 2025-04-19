import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';

export interface BuildFormatter extends BaseFormatterInterface {
  formatBuilds(builds: any[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements BuildFormatter {
  abstract formatBuilds(builds: any[], options?: FormatterOptions): string;
} 