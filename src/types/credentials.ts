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

/**
 * Represents the result of checking a token's status
 */
export interface TokenCheckResult {
  /** The token status information */
  status: TokenStatus;
  /** Any errors encountered during validation */
  errors: unknown[];
}

/**
 * Represents the result of checking or storing a token
 */
export interface TokenCheckOrStoreResult {
  /** Whether a token was stored */
  stored: boolean;
  /** Any errors encountered during the process */
  errors: unknown[];
}

/**
 * Represents the result of storing a token
 */
export interface TokenStoreResult {
  /** Whether the token was successfully stored */
  success: boolean;
  /** Any errors encountered during storage */
  errors: unknown[];
} 