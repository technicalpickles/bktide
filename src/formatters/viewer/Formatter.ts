import { BaseFormatter as BaseFormatterInterface, FormatterOptions } from '../BaseFormatter.js';
import { ViewerData } from '../../types/index.js';

export interface ViewerFormatter extends BaseFormatterInterface {
  formatViewer(viewerData: ViewerData, options?: FormatterOptions): string;
}

export abstract class BaseFormatter implements ViewerFormatter {
  abstract formatViewer(viewerData: ViewerData, options?: FormatterOptions): string;
} 