# Manual Testing: Agent-Aware Token Setup

Tests the `TokenSetupGuide` integration that detects whether bktide is running in an agent (Claude Code), interactive terminal, or non-interactive context, and provides appropriate setup guidance.

## Prerequisites

All tests below use `npm run dev` so you don't need a compiled build. If you have a token already stored in keychain, temporarily remove it for the "no token" tests:

```bash
# Check current state
npm run dev -- token --check

# Remove stored token (you'll re-add it after)
npm run dev -- token --reset
```

Also unset any env vars that would provide a token:

```bash
unset BUILDKITE_API_TOKEN
unset BK_TOKEN
```

## Test Matrix

| # | Scenario | Environment | Token present? | Expected behavior |
|---|----------|-------------|----------------|-------------------|
| 1 | Agent, no token, any command | `CLAUDECODE=1` | No | Structured markdown guidance to stderr, error exit |
| 2 | Agent, no token, `token --store` | `CLAUDECODE=1` | No | Store guidance (directs user to terminal), no prompt |
| 3 | Agent, token exists, any command | `CLAUDECODE=1` | Yes | Normal operation, no guidance shown |
| 4 | Interactive, no token, any command | TTY | No | Short guidance mentioning `bktide token --store` |
| 5 | Interactive, no token, `token --store` | TTY | No | Normal interactive prompt for token |
| 6 | Non-interactive, no token | Piped | No | One-line message |

## Test 1: Agent with no token (any command)

Simulates Claude Code running a bktide command when no token is configured.

```bash
CLAUDECODE=1 npm run dev -- builds --org gusto 2>&1
```

**Expected output** (on stderr):

```
## Setup Required: Buildkite API Token

bktide needs a Buildkite API token. Ask the user to set this up in their terminal (not here, they need to see keychain prompts directly).

### Steps for the user:
1. Go to https://buildkite.com/user/api-access-tokens/new
2. Create a token with these permissions:
   - Read Builds
   - Read Build Logs
   - Read Organizations
   - GraphQL API Access
3. Run in their terminal: bktide token --store
4. Paste the token when prompted
```

Followed by an error: `Buildkite API token not configured.`

**What to verify:**
- [x] Output is structured markdown (headers, numbered list)
- [x] Mentions "their terminal" (not "your terminal")
- [x] Lists all 4 required permissions
- [x] Includes the token creation URL
- [x] Includes the `bktide token --store` command
- [x] Exit code is non-zero

## Test 2: Agent runs `token --store`

Simulates Claude Code trying to run the token store command directly.

```bash
CLAUDECODE=1 npm run dev -- token --store
```

**Expected output:**

```
## Token Setup Required

Can't complete token setup here. The user needs to do this in their own terminal to grant keychain access and see validation feedback.

### Ask the user to run in their terminal:

  bktide token --store

This will:
1. Prompt for their Buildkite API token
2. Validate it has the right permissions
3. Store it securely in the system keychain

### If they need to create a token first:
1. Go to https://buildkite.com/user/api-access-tokens/new
2. Required permissions:
   - Read Builds
   - Read Build Logs
   - Read Organizations
   - GraphQL API Access
```

**What to verify:**
- [x] Does NOT prompt for a password (no interactive input)
- [x] Explains why it can't complete here (keychain access)
- [x] Tells the agent to ask the user to run in their terminal
- [x] Lists required permissions and token URL
- [x] Exit code is 1

## Test 3: Agent with token present

Simulates Claude Code running a command when the token is already configured.

```bash
# Provide token via env var (or restore keychain token first)
CLAUDECODE=1 BUILDKITE_API_TOKEN=bkua_your_real_token npm run dev -- token --check
```

**What to verify:**
- [x] Normal output, no setup guidance shown
- [x] Token check completes successfully
- [x] Exit code is 0

## Test 4: Interactive terminal, no token

Normal user in a terminal, no token configured.

```bash
npm run dev -- builds --org gusto
```

**Expected output:**

```
No Buildkite API token found.

Run this to set one up:

  bktide token --store

Or set the BUILDKITE_API_TOKEN environment variable.
```

**What to verify:**
- [x] Shorter than agent output (no permissions list, no markdown headers)
- [x] Mentions both `bktide token --store` and env var option
   - TODO: recommend store to use keyring
- [ ] Exit code is non-zero

## Test 5: Interactive terminal, `token --store`

Normal user stores a token. This should work exactly as before.

```bash
npm run dev -- token --store
```

**What to verify:**
- [ ] Prompts for token input (password-style, hidden)
- [ ] Validates the token against Buildkite API
- [ ] Stores in keychain on success
- [ ] Shows next-steps tips after success
- [ ] No agent-specific guidance appears

## Test 6: Non-interactive (piped), no token

Simulates a script or CI context. We pipe **stdout** through `cat` to make
`process.stdout.isTTY` false. (Piping stdin with `echo |` doesn't affect
stdout's TTY status.)

```bash
npm run dev -- builds --org gusto 2>&1 | cat
```

**What to verify:**
- [ ] Output is a single terse line: `No Buildkite API token. Run: bktide token --store`
- [ ] No markdown formatting, no permissions list
- [ ] Exit code is non-zero

## Agent with `--token` flag

Even in agent mode, providing a token directly should bypass all guidance.

```bash
CLAUDECODE=1 npm run dev -- token --store --token bkua_your_real_token
```

**What to verify:**
- [ ] Skips agent guidance entirely (token provided via flag)
- [ ] Validates and stores the token normally
- [ ] This is the escape hatch for programmatic setup

## Cleanup

After testing, restore your token:

```bash
npm run dev -- token --store
# Paste your real token when prompted

# Verify it's working
npm run dev -- token --check
```
