/**
 * Represents the validation status of a Buildkite API token
 */
export interface TokenValidationStatus {
  /** Combined status of all validation checks */
  valid: boolean;

  /** Whether the token is valid for the GraphQL API */
  graphqlValid: boolean;
  /** Whether the token is valid for the REST API to access a build */
  buildAccessValid: boolean;
  /** Whether the token is valid for the REST API to access an organization */
  orgAccessValid: boolean;
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