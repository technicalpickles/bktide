/**
 * Error that carries pre-formatted guidance text.
 *
 * Used when the caller has already composed environment-aware help
 * (e.g. TokenSetupGuide). The error formatter should display the
 * guidance directly and skip its own contextual hints/tips.
 */
export class GuidanceError extends Error {
  public readonly guidance: string;

  constructor(guidance: string) {
    // Use a short message for the error title line
    super('Setup required');
    this.name = 'GuidanceError';
    this.guidance = guidance;

    Object.setPrototypeOf(this, GuidanceError.prototype);
  }
}
