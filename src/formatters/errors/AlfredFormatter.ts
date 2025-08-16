import { BaseErrorFormatter, ErrorFormatter, ErrorFormatterOptions } from './Formatter.js';
import { isRunningInAlfred } from '../../utils/alfred.js';

/**
 * Alfred formatter for errors
 * 
 * This formatter provides Alfred-compatible JSON output for error conditions
 * that can be processed by Alfred workflows
 */
export class AlfredFormatter extends BaseErrorFormatter implements ErrorFormatter {
  name = 'alfred';

  /**
   * Format one or more errors for display in Alfred JSON format
   * 
   * @param errors The error(s) to format
   * @param options Formatting options
   * @returns Alfred JSON formatted error message
   */
  formatError(errors: unknown | unknown[], options?: ErrorFormatterOptions): string {
    const errorArray = Array.isArray(errors) ? errors : [errors];

    // Alfred first-run UX: if running in Alfred and token is missing, show setup item
    const missingToken = errorArray.some(err => {
      const msg = err instanceof Error ? err.message : String(err);
      return /API token required|No token/i.test(msg);
    });
    if (isRunningInAlfred() && missingToken && !process.env.BUILDKITE_API_TOKEN && !process.env.BK_TOKEN) {
      return JSON.stringify({
        items: [
          {
            uid: 'set-token',
            title: 'Set Buildkite token',
            subtitle: 'Open Workflow Configuration to paste your token',
            arg: 'alfred:open-config',
            icon: { path: 'icons/info.png' },
            valid: true
          }
        ]
      });
    }
    const items = [];

    for (const error of errorArray) {
      // Add main error item
      items.push({
        uid: 'error',
        title: `Error: ${this.getErrorMessage(error)}`,
        subtitle: this.getErrorSubtitle(error),
        arg: this.getErrorMessage(error),
        icon: {
          path: 'icons/error.png'
        },
        valid: true
      });

      // Add stack trace items if debug is enabled
      if (options?.debug) {
        const stack = this.getStackTrace(error);
        if (stack) {
          const stackItems = stack.split('\n').map((line, index) => ({
            uid: `stack-${index}`,
            title: line.trim(),
            subtitle: 'Stack trace line',
            arg: line,
            icon: {
              path: 'icons/stack.png'
            },
            valid: true
          }));
          items.push(...stackItems);
        }

        // Add API errors if present
        const apiErrors = this.getApiErrors(error);
        if (apiErrors?.length) {
          apiErrors.forEach((apiError, index) => {
            items.push({
              uid: `api-error-${index}`,
              title: `API Error: ${apiError.message || 'Unknown error'}`,
              subtitle: apiError.path ? `Path: ${apiError.path.join('.')}` : 'API Error',
              arg: apiError.message || 'Unknown error',
              icon: {
                path: 'icons/api-error.png'
              },
              valid: true
            });
          });
        }

        // Add request details if available
        const request = this.getRequestDetails(error);
        if (request) {
          items.push({
            uid: 'request-details',
            title: 'Request Details',
            subtitle: `${request.method || 'Unknown'} ${request.url || 'Unknown URL'}`,
            arg: `${request.method || 'Unknown'} ${request.url || 'Unknown URL'}`,
            icon: {
              path: 'icons/request.png'
            },
            valid: false
          });
        }
      }
    }

    // Add system info if debug is enabled
    if (options?.debug) {
      items.push({
        uid: 'system-info',
        title: 'System Information',
        subtitle: `Node ${process.version} on ${process.platform} (${process.arch})`,
        arg: `Node ${process.version} on ${process.platform} (${process.arch})`,
        icon: {
          path: 'icons/info.png'
        },
        valid: false
      });
    }

    return JSON.stringify({ items });
  }

  /**
   * Get a subtitle for the error to display in Alfred
   * @param error The error object
   * @returns A subtitle string
   */
  private getErrorSubtitle(error: unknown): string {
    const errorName = this.getErrorName(error);
    const apiErrors = this.getApiErrors(error);
    
    if (apiErrors?.length) {
      const firstError = apiErrors[0];
      return `API Error: ${firstError.message || 'Unknown error'}`;
    }
    
    return `${errorName} - Press Enter to copy error message`;
  }
} 