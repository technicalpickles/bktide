import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';
import { COLORS, SYMBOLS, formatTips, TipStyle } from '../../ui/theme.js';
import { wrapText, termWidth } from '../../ui/width.js';

/**
 * Plain text formatter for errors with structured sections
 */
export class PlainTextFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'plain';

  /**
   * Format one or more errors for display in plain text
   * 
   * @param errors The error(s) to format
   * @param options Formatting options
   * @returns Formatted error message
   */
  formatError(errors: unknown | unknown[], options?: ErrorFormatterOptions): string {
    const errorArray = Array.isArray(errors) ? errors : [errors];
    const sections: string[] = [];
    const width = termWidth();
    const contentWidth = Math.min(width - 4, 76); // Leave some margin, cap at 76 chars
    
    for (const error of errorArray) {
      if (sections.length > 0) sections.push(''); // Add spacing between multiple errors
      
      // Title section with icon
      const errorName = this.getErrorName(error);
      const errorMessage = this.getErrorMessage(error);
      sections.push(COLORS.error(`${SYMBOLS.error} ERROR   ${errorName}`));
      
      // Message section (wrapped for readability)
      if (errorMessage && errorMessage !== errorName) {
        const wrappedMessage = wrapText(errorMessage, contentWidth);
        wrappedMessage.forEach(line => {
          sections.push(`         ${line}`);
        });
      }
      
      // Cause section (if available)
      const cause = this.getErrorCause(error);
      if (cause) {
        sections.push('');
        sections.push(COLORS.muted(`CAUSE    ${cause}`));
      }
      
      // API errors section
      const apiErrors = this.getApiErrors(error);
      if (apiErrors?.length) {
        sections.push('');
        sections.push(COLORS.warn(`${SYMBOLS.warn} DETAILS`));
        apiErrors.forEach((apiError) => {
          const message = apiError.message || 'Unknown error';
          sections.push(`         ${SYMBOLS.bullet} ${message}`);
          if (apiError.path) {
            sections.push(COLORS.muted(`           Path: ${apiError.path.join('.')}`));
          }
        });
      }
      
      // Stack trace (debug only)
      const stack = this.getStackTrace(error);
      if (stack && options?.debug) {
        sections.push('');
        sections.push(COLORS.muted('STACK'));
        // Indent stack trace lines
        stack.split('\n').forEach(line => {
          sections.push(COLORS.muted(`         ${line}`));
        });
      }
      
      // Request details (debug only)
      const request = this.getRequestDetails(error);
      if (request && options?.debug) {
        sections.push('');
        sections.push(COLORS.muted('REQUEST'));
        if (request.url) sections.push(COLORS.muted(`         URL: ${request.url}`));
        if (request.method) sections.push(COLORS.muted(`         Method: ${request.method}`));
      }
      
      // Hints section - context-aware suggestions
      const hints = this.getContextualHints(error, errorMessage);
      if (hints.length > 0) {
        sections.push('');
        sections.push(formatTips(hints, TipStyle.FIXES));
      }
    }
    
    return sections.join('\n');
  }
  
  /**
   * Get contextual hints based on the error
   */
  private getContextualHints(_error: unknown, message: string): string[] {
    const hints: string[] = [];
    const lowerMessage = message.toLowerCase();
    
    // Authentication errors
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || 
        lowerMessage.includes('401') || lowerMessage.includes('token')) {
      hints.push('Check your token: bktide token --check');
      hints.push('Store a new token: bktide token --store');
      hints.push('Set token via: export BUILDKITE_API_TOKEN=<your-token>');
    }
    // Network errors
    else if (lowerMessage.includes('econnrefused') || lowerMessage.includes('network') ||
             lowerMessage.includes('etimedout') || lowerMessage.includes('dns')) {
      hints.push('Check your internet connection');
      hints.push('Verify Buildkite API is accessible');
      hints.push('Try again with --no-cache to bypass cache');
    }
    // Permission errors
    else if (lowerMessage.includes('permission') || lowerMessage.includes('forbidden') ||
             lowerMessage.includes('403')) {
      hints.push('Verify you have access to this resource');
      hints.push('Check organization permissions');
      hints.push('List accessible orgs: bktide orgs');
    }
    // Not found errors
    else if (lowerMessage.includes('not found') || lowerMessage.includes('404')) {
      hints.push('Verify the resource exists');
      hints.push('Check spelling of organization/pipeline/build names');
      hints.push('List available resources with appropriate list command');
    }
    // Rate limit errors
    else if (lowerMessage.includes('rate limit') || lowerMessage.includes('429')) {
      hints.push('Wait a moment before retrying');
      hints.push('Use --no-cache to avoid repeated API calls');
      hints.push('Consider using --count with a smaller value');
    }
    // Generic hints
    else {
      hints.push('Run with --debug for detailed error information');
      hints.push('Check command syntax: bktide <command> --help');
      hints.push('Report issues: https://github.com/your-repo/issues');
    }
    
    // Always include debug hint if not already in debug mode
    if (!hints.some(h => h.includes('--debug'))) {
      hints.push('Use --debug flag for stack trace');
    }
    
    return hints;
  }
  
  /**
   * Try to extract a cause from the error
   */
  private getErrorCause(error: unknown): string | null {
    if (error && typeof error === 'object' && 'cause' in error) {
      const cause = (error as any).cause;
      if (cause instanceof Error) {
        return cause.message;
      }
      if (typeof cause === 'string') {
        return cause;
      }
    }
    return null;
  }
} 