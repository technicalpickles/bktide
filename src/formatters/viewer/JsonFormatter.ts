import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { ViewerData } from '../../types/index.js';

export class JsonFormatter extends BaseFormatter {
  formatViewer(viewerData: ViewerData, options?: FormatterOptions): string {
    if (!viewerData?.viewer) {
      return JSON.stringify({ error: 'No viewer data found' }, null, 2);
    }
    
    const result = {
      id: viewerData.viewer.id,
      user: viewerData.viewer.user ? {
        id: viewerData.viewer.user.id || null,
        uuid: viewerData.viewer.user.uuid || null,
        name: viewerData.viewer.user.name || null,
        email: viewerData.viewer.user.email || null
      } : null
    };
    
    return JSON.stringify(result, null, 2);
  }
} 