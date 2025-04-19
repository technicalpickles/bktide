import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { Build } from '../../types/index.js';

export interface BuildFormatter extends BaseFormatterInterface {
  formatBuilds(builds: Build[], options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements BuildFormatter {
  abstract formatBuilds(builds: Build[], options?: FormatterOptions): string;
} 