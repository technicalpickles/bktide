# Alfred Integration

Streamline your Buildkite CI/CD workflows directly from Alfred, providing instant access to builds, pipelines, and organizations without leaving your keyboard.

> **Note**: Shell completions and Alfred integration are independent features. You can use both simultaneously without any conflicts.

For installation instructions, see [Alfred Installation Guide](installation.md). For troubleshooting, see [Alfred Troubleshooting](troubleshooting.md).

## What it does

The bktide Alfred workflow transforms your Buildkite workflow management by:

- **Instant Access**: Search and view builds, pipelines, and organizations from Alfred
- **Rich Previews**: See build statuses, pipeline information, and annotations at a glance  
- **Quick Actions**: Open builds in browser, copy URLs, or view details with keyboard shortcuts
- **Smart Filtering**: Filter by organization, build state, or search terms
- **Seamless Integration**: Works with your existing Alfred workflows and shortcuts

## Key Features

### Build Management
- Search recent builds across all your organizations
- Filter by build state (passed, failed, running, etc.)
- View build details including branch, commit, and timing
- Quick access to build URLs and annotations

### Pipeline Overview  
- Browse all accessible pipelines
- Filter by organization or search by name
- Quick access to pipeline configurations and recent builds

### Organization Access
- View all organizations you have access to
- Quick navigation between different Buildkite accounts

### Token Management
Built-in commands for managing your API authentication:
- **Check token status**: Verify your current token is valid
- **Store new token**: Securely save a new API token
- **Reset token**: Remove stored credentials

### Keyboard Shortcuts
- **Enter**: Open build/pipeline in your browser
- **⌘+Enter**: Copy URL to clipboard  
- **⌥+Enter**: View detailed information (like annotations) in Alfred

## Getting Started

1. **Install the workflow**: See [installation guide](installation.md)
2. **Configure Node.js**: Set up the Node.js path in Alfred workflow configuration
3. **Set up authentication**: Configure your Buildkite API token in the workflow settings
4. **Start searching**: Type your Alfred keyword and start exploring your Buildkite data

For detailed setup instructions, see the [installation guide](installation.md).

## Common Use Cases

- **Monitor build status**: Quickly check if your latest builds passed or failed
- **Investigate failures**: Jump directly to failed builds and view error details
- **Pipeline management**: Browse and access pipeline configurations
- **Team collaboration**: Share build URLs and status updates with teammates
