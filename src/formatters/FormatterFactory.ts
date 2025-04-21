import { BaseFormatter } from './BaseFormatter.js';
import { getPipelineFormatter } from './pipelines/index.js';
import { getBuildFormatter } from './builds/index.js';
import { getViewerFormatter } from './viewer/index.js';
import { getOrganizationFormatter } from './organizations/index.js';

export enum FormatterType {
  PIPELINE = 'pipeline',
  BUILD = 'build', 
  VIEWER = 'viewer',
  ORGANIZATION = 'organization'
}

export class FormatterFactory {
  /**
   * Get the appropriate formatter based on the type and format
   * @param type The formatter type ('pipeline', 'build', 'viewer', 'organization')
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
      default:
        throw new Error(`Unknown formatter type: ${type}`);
    }
  }
} 