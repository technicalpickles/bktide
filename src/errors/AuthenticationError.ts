/**
 * Authentication error with actionable guidance
 *
 * Thrown when API authentication fails (401 response).
 * Carries structured information for user-friendly error display.
 */
export class AuthenticationError extends Error {
  public readonly details: string;
  public readonly suggestions: string[];
  public readonly originalError?: Error;
  public readonly httpStatus: number = 401;

  constructor(options?: {
    message?: string;
    details?: string;
    suggestions?: string[];
    originalError?: Error;
  }) {
    super(options?.message ?? 'Authentication failed');
    this.name = 'AuthenticationError';

    this.details = options?.details ?? 'Your Buildkite API token is invalid or expired.';
    this.suggestions = options?.suggestions ?? [
      'Check your token: bktide token --check',
      'Store a new token: bktide token --store',
      'Get a token at: https://buildkite.com/user/api-access-tokens'
    ];
    this.originalError = options?.originalError;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }

  /**
   * Create an AuthenticationError from a GraphQL 401 response
   */
  static fromGraphQLError(error: Error): AuthenticationError {
    return new AuthenticationError({
      message: 'Authentication failed',
      originalError: error
    });
  }
}
