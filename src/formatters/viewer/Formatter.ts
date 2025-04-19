import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';

export interface ViewerFormatter extends BaseFormatterInterface {
  formatViewer(viewerData: any, options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements ViewerFormatter {
  abstract formatViewer(viewerData: any, options?: FormatterOptions): string;
} 