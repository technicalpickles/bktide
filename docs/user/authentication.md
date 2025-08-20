# Authentication

You need a Buildkite API token to use bktide. There are several ways to provide it, listed in order of security and convenience:

## 1. System Keychain (Recommended)

**Most secure and convenient** - Store your token in your system's native keychain:

```bash
# Store your token securely in the system keychain
bktide token --store
# You'll be prompted to enter your token securely

# Now you can run commands without providing the token
bktide viewer
```

**Benefits:**
- Tokens are encrypted and stored securely
- No plain text tokens in shell history or environment variables
- Works automatically across all terminal sessions
- Uses native OS security (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)

## 2. Environment Variable

Set the `BUILDKITE_API_TOKEN` environment variable:
```bash
export BUILDKITE_API_TOKEN=YOUR_BUILDKITE_API_TOKEN
bktide viewer
```

**Note:** Less secure as the token is visible in plain text in your shell environment.

## 3. Command Line Flag

Use the `--token` option with each command:
```bash
bktide viewer --token YOUR_BUILDKITE_API_TOKEN
```

**Note:** Least secure as the token appears in shell history and process lists.

## Creating a Buildkite API Token

To create a token with the required permissions:

1. Go to [Buildkite API Access Tokens](https://buildkite.com/user/api-access-tokens)
2. Click "New API Access Token"
3. Give it a descriptive name (e.g., "bktide CLI")
4. **Enable these scopes** for full functionality:
   - **GraphQL** - Required for all API access
   - **Read builds** - View build information and history
   - **Read organizations** - Access organization data  
   - **Read pipelines** - View pipeline configurations
   - **Read user** - View your user profile
5. Copy the generated token

## Token Management Commands

```bash
# Store a token in the system keychain (will prompt for token)
bktide token --store

# Check if a token is stored and validate it
bktide token --check

# Remove the stored token
bktide token --reset
```

You can also use the `--save-token` flag with any command to save the token to the keychain:

```bash
# Use and store a token provided on the command line
bktide viewer --token YOUR_BUILDKITE_API_TOKEN --save-token

# Use and store a token from the environment variable
bktide viewer --save-token
```

## Shell Completions and Authentication

Note: Dynamic shell completions for Fish (when `jq` is installed) require a valid Buildkite token to fetch real-time data:

- Organization name completions (`bktide pipelines --org <Tab>`)
- Pipeline name completions (`bktide builds --pipeline <Tab>`)

If you haven't configured a token, these dynamic completions won't work, but static completions (commands, options, predefined values) will still function normally. 