import { ApiError } from '../errors/ApiError.js';
import { logger } from '../services/logger.js';
import { formatError } from '../ui/theme.js';
import { parseScopeError, formatScopeError } from './scopeError.js';

/**
 * True when Buildkite accepted the token but the user's role does not permit
 * the action: a 403 that is not a missing-scope error.
 */
export function isRoleDenied(error: unknown): error is ApiError {
  return error instanceof ApiError
    && error.status === 403
    && !parseScopeError(error.message).matched;
}

function stripPrefix(message: string): string {
  return message.replace(/^API request failed:\s*/, '');
}

/**
 * Report a failed write request (rebuild, retry) with guidance that matches
 * the cause: a missing token scope, a role that forbids the action, or
 * Buildkite's own message for anything else.
 *
 * @param action What the user tried, phrased to follow "allow you to", e.g. "retry jobs in acme/infra"
 */
export function reportWriteError(error: unknown, action: string): void {
  if (!(error instanceof Error)) {
    logger.error(String(error));
    return;
  }

  const scope = parseScopeError(error.message);
  if (scope.matched) {
    const formatted = formatScopeError(scope.scope);
    logger.console(formatError(formatted.message, { suggestions: formatted.suggestions }));
    return;
  }

  if (isRoleDenied(error)) {
    logger.console(formatError(
      `Permission denied: your Buildkite role does not allow you to ${action}.`,
      {
        suggestions: [
          `Buildkite responded: ${stripPrefix(error.message)}`,
          'Your token is valid and has the needed scope, so refreshing or re-storing it will not help',
          'Ask a Buildkite organization admin or the pipeline\'s team maintainer for access that permits this',
        ],
      },
    ));
    return;
  }

  logger.error(error.message);
}
