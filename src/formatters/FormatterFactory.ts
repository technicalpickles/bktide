import { BaseFormatter } from './BaseFormatter.js';
import { getPipelineFormatter } from './pipelines/index.js';
import { getBuildFormatter } from './builds/index.js';
import { getViewerFormatter } from './viewer/index.js';
import { getOrganizationFormatter } from './organizations/index.js';
import { getErrorFormatter } from './errors/index.js';
import { getTokenFormatter } from './token/index.js';
import { getAnnotationFormatter } from './annotations/index.js';

export enum FormatterType {
  PIPELINE = 'pipeline',
  BUILD = 'build', 
  VIEWER = 'viewer',
  ORGANIZATION = 'organization',
  ERROR = 'error',
  TOKEN = 'token',
  ANNOTATION = 'annotation'
}

export class FormatterFactory {
  /**
   * Get the appropriate formatter based on the type and format
   * @param type The formatter type ('pipeline', 'build', 'viewer', 'organization', 'error', 'token', 'annotation')
   * @param format The format to use ('plain', 'json', 'alfred')
   * @returns The appropriate formatter instance
   */
  static getFormatter(type: FormatterType, format: string = 'plain'): BaseFormatter {
    // Normalize the format string
    const normalizedFormat = format.toLowerCase().trim();
    
    switch (type) {
      case FormatterType.PIPELINE:
        return getPipelineFormatter(normalizedFormat);
      case FormatterType.BUILD:
        return getBuildFormatter(normalizedFormat);
      case FormatterType.VIEWER:
        return getViewerFormatter(normalizedFormat);
      case FormatterType.ORGANIZATION:
        return getOrganizationFormatter(normalizedFormat);
      case FormatterType.ERROR:
        return getErrorFormatter(normalizedFormat);
      case FormatterType.TOKEN:
        return getTokenFormatter(normalizedFormat);
      case FormatterType.ANNOTATION:
        return getAnnotationFormatter(normalizedFormat);
      default:
        throw new Error(`Unknown formatter type: ${type}`);
    }
  }
} 