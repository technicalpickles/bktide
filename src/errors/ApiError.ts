/**
 * Error from a Buildkite REST API request that carries the HTTP status,
 * so callers can tell a 403 (forbidden) from a 401 (bad token) or a 422.
 */
export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
