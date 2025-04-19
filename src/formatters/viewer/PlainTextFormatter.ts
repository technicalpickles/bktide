import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { ViewerData } from '../../types/index.js';

export class PlainTextFormatter extends BaseFormatter {
  formatViewer(viewerData: ViewerData, options?: FormatterOptions): string {
    if (!viewerData?.viewer) {
      return 'No viewer data found.';
    }

    let output = 'Logged in as:\n';
    output += `- ID: ${viewerData.viewer.id}\n`;
    
    // Safely display user data if available
    if (viewerData.viewer.user) {
      output += `- User ID: ${viewerData.viewer.user.id || 'N/A'}\n`;
      output += `- Name: ${viewerData.viewer.user.name || 'N/A'}\n`;
      output += `- Email: ${viewerData.viewer.user.email || 'N/A'}\n`;
    }
    
    return output;
  }
} 