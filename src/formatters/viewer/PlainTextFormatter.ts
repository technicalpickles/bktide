import { FormatterOptions } from '../BaseFormatter.js';
import { BaseFormatter } from './Formatter.js';
import { ViewerData } from '../../types/index.js';
import { SEMANTIC_COLORS, formatEmptyState } from '../../ui/theme.js';

export class PlainTextFormatter extends BaseFormatter {
  name = 'plain-text';
  
  formatViewer(viewerData: ViewerData, _options?: FormatterOptions): string {
    if (!viewerData?.viewer) {
      return formatEmptyState(
        'No viewer data found',
        ['Check your API token is valid', 'Run "bktide token --check" to verify']
      );
    }

    const lines: string[] = [];
    
    if (viewerData.viewer.user) {
      lines.push(`${SEMANTIC_COLORS.label('Name:')}  ${viewerData.viewer.user.name || SEMANTIC_COLORS.muted('(not set)')}`);
      lines.push(`${SEMANTIC_COLORS.label('Email:')} ${viewerData.viewer.user.email || SEMANTIC_COLORS.muted('(not set)')}`);
      lines.push(`${SEMANTIC_COLORS.label('ID:')}    ${SEMANTIC_COLORS.identifier(viewerData.viewer.user.id || '(unknown)')}`);
    } else {
      return formatEmptyState(
        'No user data found',
        ['Your token may not have the required permissions']
      );
    }
    
    return lines.join('\n');
  }
} 