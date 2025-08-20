# Getting Started with bktide

This guide will help you get up and running with the bktide CLI quickly.

## Installation

```bash
npm install -g bktide
```

Once installed, you can use the `bktide` command from anywhere in your terminal.

## Authentication

You'll need a Buildkite API token to use bktide. 

### 1. Create a Buildkite API Token

1. Go to [Buildkite API Access Tokens](https://buildkite.com/user/api-access-tokens)
2. Click "New API Access Token"
3. Give it a name (e.g., "bktide CLI")
4. **Required scopes**: Enable these scopes for full functionality:
   - **GraphQL** - Required for all API access
   - **Read builds** - View build information and history
   - **Read organizations** - Access organization data
   - **Read pipelines** - View pipeline configurations
   - **Read user** - View your user profile
5. Copy the generated token

### 2. Store Your Token

**Recommended**: Store it securely in your system keychain (most secure):

```bash
bktide token --store
```

You'll be prompted to enter your token. It will be stored securely in your system's native keychain and used automatically.

**Alternative**: Set an environment variable (less secure, token visible in plain text):
```bash
export BUILDKITE_API_TOKEN=your_token_here
```

The keychain method is preferred because:
- Tokens are encrypted and stored securely
- No plain text tokens in shell history or environment
- Works across terminal sessions automatically

### 3. Verify Authentication

```bash
bktide viewer
```

This should show your Buildkite user information.

## Basic Commands

### View Your Organizations
```bash
bktide orgs
```

### List Pipelines
```bash
# All pipelines
bktide pipelines

# Pipelines in a specific organization
bktide pipelines --org your-org-name
```

### View Recent Builds
```bash
# Recent builds across all organizations
bktide builds

# Builds for a specific organization
bktide builds --org your-org-name

# Builds for a specific pipeline
bktide builds --org your-org-name --pipeline your-pipeline-name

# Failed builds only
bktide builds --state FAILED
```

### View Build Details
```bash
# Using org/pipeline/number format
bktide build your-org/your-pipeline/123

# Using URL format
bktide build https://buildkite.com/your-org/your-pipeline/builds/123

# Include job details and failure information
bktide build your-org/your-pipeline/123 --jobs --failed
```

### View Build Annotations
```bash
bktide annotations your-org/your-pipeline/123
```

## Output Formats

bktide supports multiple output formats:

```bash
# Human-readable (default)
bktide builds

# JSON format
bktide builds --format json

# Alfred workflow format (for macOS Alfred integration)
bktide builds --format alfred
```

## Shell Completions

Set up auto-completion for your shell:

```bash
# Fish
bktide completions fish > ~/.config/fish/completions/bktide.fish

# Bash
echo 'source <(bktide completions bash)' >> ~/.bashrc

# Zsh
echo 'source <(bktide completions zsh)' >> ~/.zshrc
```

See the [Shell Completions Guide](shell-completions.md) for detailed setup instructions.

## Performance Tips

### Caching
bktide automatically caches API responses to improve performance:
- Organization data: cached for 1 hour
- Pipeline data: cached for 1 minute  
- Build data: cached for 30 seconds

```bash
# Disable caching for a command
bktide builds --no-cache

# Clear cache before running
bktide builds --clear-cache
```

### Filtering
Use filters to reduce API calls and get exactly what you need:

```bash
# Filter by organization to reduce data
bktide builds --org your-main-org

# Filter by state to find issues quickly
bktide builds --state FAILED --org your-org

# Filter by branch for deployment tracking
bktide builds --branch main --org your-org
```

## Common Workflows

### Check Build Status
```bash
# Quick overview of recent activity
bktide builds --count 10

# Check for failures across all organizations
bktide builds --state FAILED --count 20

# Monitor a specific pipeline
bktide builds --org your-org --pipeline critical-pipeline
```

### Investigate Build Failures
```bash
# Find recent failures
bktide builds --state FAILED --org your-org

# Get detailed failure information
bktide build your-org/pipeline/123 --failed --jobs

# Check annotations for additional context
bktide annotations your-org/pipeline/123
```

### Pipeline Management
```bash
# List all pipelines to see what's available
bktide pipelines --org your-org

# Filter pipelines by name
bktide pipelines --org your-org --filter api

# Get pipeline details (shows recent builds)
bktide builds --org your-org --pipeline specific-pipeline --count 5
```

## Alfred Integration (macOS)

If you use Alfred on macOS, you can install the bktide Alfred workflow for quick access:

1. Download the workflow from the [releases page](https://github.com/yourusername/bktide/releases)
2. Double-click the `.alfredworkflow` file to install
3. Use Alfred to search for builds, pipelines, and organizations

See the [Alfred Installation Guide](alfred/installation.md) for detailed setup instructions.

## Getting Help

### Command Help
```bash
# General help
bktide --help

# Command-specific help
bktide builds --help
bktide annotations --help
```

### Debug Mode
If you encounter issues, enable debug mode:
```bash
bktide builds --debug
```

This will show detailed information about API calls, caching, and any errors.

### Troubleshooting

- **Authentication issues**: See [Authentication Guide](authentication.md)
- **Shell completion issues**: See [Shell Completions Guide](shell-completions.md)  
- **Alfred workflow issues**: See [Alfred Troubleshooting](alfred/troubleshooting.md)
- **Performance issues**: See [Caching Guide](caching.md)
- **General CLI issues**: See [Troubleshooting Guide](troubleshooting.md)

## Next Steps

- Set up [shell completions](shell-completions.md) for faster command entry
- Install the [Alfred workflow](alfred/installation.md) if you use macOS
- Explore the [complete command reference](../reference/commands.md) (coming soon)
- Learn about [advanced configuration options](../reference/configuration.md) (coming soon)
