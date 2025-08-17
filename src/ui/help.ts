/**
 * Custom Help formatter for Commander with width-aware text wrapping
 */

import { Help } from 'commander';
import { termWidth, wrapText } from './width.js';

export class WidthAwareHelp extends Help {
  /**
   * Get the terminal width with a max limit for readability
   */
  private getHelpWidth(): number {
    // Cap at 100 chars for readability, even on ultra-wide terminals
    return Math.min(termWidth(), 100);
  }

  /**
   * Wrap text to fit terminal width
   */
  private wrapLine(text: string, indent = 0): string {
    const width = this.getHelpWidth();
    const effectiveWidth = Math.max(40, width - indent);
    const lines = wrapText(text, effectiveWidth);
    const indentStr = ' '.repeat(indent);
    return lines.map((line, i) => i === 0 ? line : indentStr + line).join('\n');
  }

  /**
   * Override formatHelp to apply width-aware formatting
   */
  formatHelp(cmd: any, helper: Help): string {
    const width = this.getHelpWidth();
    
    // Get the default help text
    let helpText = super.formatHelp(cmd, helper);
    
    // Process each line to apply wrapping
    const lines = helpText.split('\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      // Skip empty lines
      if (line.trim() === '') {
        processedLines.push(line);
        continue;
      }
      
      // Detect option/command lines (they start with spaces and contain two or more spaces for alignment)
      const optionMatch = line.match(/^(\s+)(\S+)\s{2,}(.*)$/);
      if (optionMatch) {
        const [, indent, option, description] = optionMatch;
        const optionIndent = indent.length;
        const descIndent = optionIndent + option.length + 2;
        
        // If the line is too long, wrap the description
        if (line.length > width) {
          const wrappedDesc = this.wrapLine(description, descIndent);
          processedLines.push(`${indent}${option}  ${wrappedDesc}`);
        } else {
          processedLines.push(line);
        }
      } else if (line.length > width) {
        // For other long lines (like descriptions), wrap them
        const leadingSpaces = line.match(/^(\s*)/)?.[1] || '';
        const content = line.trim();
        const wrapped = this.wrapLine(content, leadingSpaces.length);
        processedLines.push(leadingSpaces + wrapped);
      } else {
        processedLines.push(line);
      }
    }
    
    return processedLines.join('\n');
  }


}
