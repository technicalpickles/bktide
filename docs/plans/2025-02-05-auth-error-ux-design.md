# Auth Error UX Improvements

**Date:** 2025-02-05
**Bean:** gt-o0wz
**Status:** Draft

## Problem Statement

When authentication fails, bktide shows raw JSON dumps with stack traces instead of friendly, actionable error messages. This makes it difficult for users to understand what went wrong and how to fix it.

### Current Behavior

```
ERROR: Error occurred
    err: {
      "type": "ClientError",
      "message": "GraphQL Error (Code: 401): {"response":{"status":401,...
      "stack": Error: GraphQL Error (Code: 401)...
```

### Expected Behavior

```
ERROR   Authentication failed

Your Buildkite API token is invalid or expired.

To fix this:
  → Check your token: bktide token --check
  → Store a new token: bktide token --store
  → Get a token at: https://buildkite.com/user/api-access-tokens
```

## Root Causes

### 1. Token Resolution Order

**Current:** Keychain → Environment variable → CLI flag
**Problem:** Can't override keychain token for testing or CI/CD

**Location:** `src/services/CredentialManager.ts`

### 2. Error Handling in Commands

**Current:** Commands catch errors and call `this.handleError()` which uses `logger.error()`
**Problem:** `logger.error()` outputs raw pino-pretty JSON, not the formatted error display

**Location:** `src/commands/BaseCommand.ts:handleError()`

### 3. No Auth-Specific Error Detection

**Current:** All GraphQL errors treated the same
**Problem:** 401 errors need special handling with auth-specific guidance

## Implementation Plan

### Phase 1: Token Resolution Order (Priority: High)

**Goal:** Allow env vars and CLI flags to override keychain token

#### Changes to `src/services/CredentialManager.ts`

```typescript
// Current order (wrong)
async getToken(): Promise<string | null> {
  return this.getFromKeychain()
      || this.getFromEnv()
      || this.getFromFlag();
}

// New order (correct)
async getToken(options?: { token?: string }): Promise<string | null> {
  // 1. CLI flag takes highest precedence
  if (options?.token) return options.token;

  // 2. Environment variable
  const envToken = this.getFromEnv();
  if (envToken) return envToken;

  // 3. Keychain as fallback
  return this.getFromKeychain();
}
```

#### Changes to `src/commands/ManageToken.ts`

Make `token --check` respect the `--token` flag:

```typescript
async checkToken(options?: TokenOptions): Promise<TokenCheckResult> {
  // Use provided token, env var, or keychain (in that order)
  const token = options?.token
             || process.env.BUILDKITE_API_TOKEN
             || process.env.BK_TOKEN
             || await this.getFromKeychain();
  // ... rest of validation
}
```

### Phase 2: Auth Error Detection (Priority: High)

**Goal:** Detect 401 errors and provide auth-specific guidance

#### Create `src/errors/AuthenticationError.ts`

```typescript
import { CLIError } from './CLIError.js';

export class AuthenticationError extends CLIError {
  constructor(originalError?: Error) {
    super('Authentication failed', {
      details: 'Your Buildkite API token is invalid or expired.',
      suggestions: [
        'Check your token: bktide token --check',
        'Store a new token: bktide token --store',
        'Get a token at: https://buildkite.com/user/api-access-tokens'
      ],
      originalError
    });
  }
}
```

#### Update `src/services/BuildkiteClient.ts`

Wrap GraphQL client to detect auth errors:

```typescript
private async executeQuery<T>(query: string, variables?: any): Promise<T> {
  try {
    return await this.client.request(query, variables);
  } catch (error) {
    if (this.isAuthError(error)) {
      throw new AuthenticationError(error);
    }
    throw error;
  }
}

private isAuthError(error: unknown): boolean {
  if (error instanceof ClientError) {
    return error.response?.status === 401;
  }
  return false;
}
```

### Phase 3: Error Formatter Integration (Priority: Medium)

**Goal:** Use the existing error formatter for all command errors

#### Option A: Update `BaseCommand.handleError()`

```typescript
protected handleError(error: unknown, options?: { debug?: boolean }): void {
  // Use the CLI error display instead of logger.error()
  displayCLIError(error, {
    format: this.format,
    debug: options?.debug
  });
}
```

#### Option B: Let errors propagate to command wrapper

Remove try/catch from individual commands and handle all errors in the command wrapper in `src/index.ts`.

**Recommendation:** Option A is less invasive and maintains command-level control.

### Phase 4: Additional Error Types (Priority: Low)

Create specific error types for common failure modes:

| Error | Trigger | Guidance |
|-------|---------|----------|
| `AuthenticationError` | 401 response | Token setup instructions |
| `PermissionError` | 403 response | Required scopes list |
| `NotFoundError` | 404 response | Check org/pipeline/build exists |
| `RateLimitError` | 429 response | Wait and retry |
| `NetworkError` | Connection failed | Check internet connection |

## File Changes Summary

| File | Change |
|------|--------|
| `src/services/CredentialManager.ts` | Reorder token resolution |
| `src/commands/ManageToken.ts` | Respect --token flag in checkToken |
| `src/errors/AuthenticationError.ts` | New file |
| `src/services/BuildkiteClient.ts` | Detect and wrap auth errors |
| `src/commands/BaseCommand.ts` | Use error formatter in handleError |
| `src/formatters/errors/` | May need updates for new error types |

## Testing

### Manual Testing

Use `scripts/test-token-ux.sh` to verify all scenarios:

```bash
./scripts/test-token-ux.sh
```

### Unit Tests

Add tests for:
- Token resolution order (env var overrides keychain)
- AuthenticationError formatting
- Error detection in BuildkiteClient

### Test Scenarios

| Scenario | Expected Output |
|----------|-----------------|
| Invalid token via env var | Friendly auth error with guidance |
| Invalid token via --token flag | Friendly auth error with guidance |
| No token at all | "No token configured" with setup steps |
| Valid token | Normal operation |

## Migration Notes

- No breaking changes to public CLI interface
- Internal error handling changes only
- Existing scripts using exit codes will continue to work

## Success Criteria

1. `BUILDKITE_API_TOKEN=invalid bktide orgs` shows friendly error
2. `bktide token --check --token invalid` validates the provided token
3. All auth errors include actionable "next steps"
4. No raw JSON/stack traces in user-facing output
5. `scripts/test-token-ux.sh` passes all scenarios
