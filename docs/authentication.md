# Authentication

You can authenticate with Buildkite in several ways:

1. Using the `--token` option with each command:
   ```bash
   npm run dev -- viewer --token YOUR_BUILDKITE_API_TOKEN
   ```

2. Setting the `BK_TOKEN` environment variable:
   ```bash
   export BK_TOKEN=YOUR_BUILDKITE_API_TOKEN
   npm run dev -- viewer
   ```

3. Using the system keychain (recommended):
   ```bash
   # Store your token securely in the system keychain
   npm run dev -- token store
   # You'll be prompted to enter your token securely
   
   # Now you can run commands without providing the token
   npm run dev -- viewer
   ```

## Credential Management

The CLI includes secure credential management using the system's native keychain:

```bash
# Store a token in the system keychain (will prompt for token)
npm run dev -- token store

# Check if a token is stored
npm run dev -- token check

# Delete the stored token
npm run dev -- token delete
```

You can also use the `--save-token` flag with any command to save the token used to the system keychain:

```bash
# Use and store a token provided on the command line
npm run dev -- viewer --token YOUR_BUILDKITE_API_TOKEN --save-token

# Use and store a token from the environment variable
# (requires BK_TOKEN to be set)
npm run dev -- viewer --save-token
```

This secure storage method:
- Uses the system's native keychain (Keychain Access on macOS, Credential Manager on Windows, Secret Service API on Linux)
- Eliminates the need to store tokens in plain text or environment variables
- Makes future commands more convenient as no token needs to be provided

## Shell Completions and Authentication

Note: Dynamic shell completions for Fish (when `jq` is installed) require a valid Buildkite token to fetch real-time data:

- Organization name completions (`bktide pipelines --org <Tab>`)
- Pipeline name completions (`bktide builds --pipeline <Tab>`)

If you haven't configured a token, these dynamic completions won't work, but static completions (commands, options, predefined values) will still function normally. 