import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { ViewerData } from '../../types/index.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatViewer(viewerData: ViewerData, options?: FormatterOptions): string {
    if (!viewerData?.viewer) {
      return 'No viewer data found.';
    }

    let output = 'Logged in as:\n';
    if (viewerData.viewer.user) {
      output += `- ID: ${viewerData.viewer.user?.id}\n`;
      output += `- Name: ${viewerData.viewer.user?.name}\n`;
      output += `- Email: ${viewerData.viewer.user?.email}\n`;
    } else {
      output += `- No user data found.\n`;
    }
 
    
    return output;
  }
} 