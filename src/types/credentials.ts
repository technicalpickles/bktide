/**
 * Represents the validation status of a Buildkite API token
 */
export interface TokenValidationStatus {
  /** Whether the token is valid for the GraphQL API */
  graphqlValid: boolean;
  /** Whether the token is valid for the REST API */
  restValid: boolean;
}

/**
 * Represents the complete status of a Buildkite API token
 */
export interface TokenStatus {
  /** Whether a token exists in the keychain */
  hasToken: boolean;
  /** Whether the token is valid for both GraphQL and REST APIs */
  isValid: boolean;
  /** Detailed validation status for each API */
  validation: TokenValidationStatus;
} 