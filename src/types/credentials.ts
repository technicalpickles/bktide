/**
 * Represents the validation status of a Buildkite API token
 */
export interface OrganizationValidationStatus {
  /** Whether the token is valid for the GraphQL API for this organization */
  graphql: boolean;
  /** Whether the token is valid for the REST API to access builds in this organization */
  builds: boolean;
  /** Whether the token is valid for the REST API to access organization details */
  organizations: boolean;
}

export interface TokenValidationStatus {
  /** Combined status of all validation checks */
  valid: boolean;
  /** Whether the token can access the GraphQL API to list organizations */
  canListOrganizations: boolean;
  /** Validation status for each organization */
  organizations: Record<string, OrganizationValidationStatus>;
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