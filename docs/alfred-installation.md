# Alfred Workflow Installation Guide

This guide covers installing and configuring the bktide Alfred workflow for optimal performance.

## Requirements

### Node.js Requirement
The bktide Alfred workflow requires **Node.js 18+** to be installed on your system. The workflow uses Node.js to run the bktide CLI in the background.

#### Checking if Node.js is installed
```bash
node --version
```

If Node.js is not installed or you see an error, you'll need to install it.

#### Installing Node.js

**Option 1: Official installer (Recommended for beginners)**
1. Visit [nodejs.org](https://nodejs.org/)
2. Download and install the LTS version
3. Restart Alfred after installation

**Option 2: Homebrew (Recommended for developers)**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

**Option 3: Node Version Manager (nvm)**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node.js LTS
nvm install --lts
nvm use --lts
```

## Installation

1. **Download the workflow**
   - Download `bktide-workflow-x.x.x.alfredworkflow` from the [latest release](https://github.com/yourusername/bktide/releases)

2. **Import into Alfred**
   - Double-click the `.alfredworkflow` file
   - Alfred will open and ask to import the workflow
   - Click "Import" to install

3. **Verify installation**
   - Open Alfred (⌘ + Space)
   - Type `bktide viewer`
   - You should see the command available (may show an error about missing token - this is normal)

## Configuration

### Buildkite API Token
You need a Buildkite API token to use the workflow:

1. **Get a token from Buildkite**
   - Go to [Buildkite Personal Access Tokens](https://buildkite.com/user/api-access-tokens)
   - Click "New API Access Token"
   - Give it a name like "Alfred Workflow"
   - Select scopes: `read_builds`, `read_organizations`, `read_pipelines`
   - Copy the generated token

2. **Store the token securely**
   - Open Alfred and run: `bktide token store`
   - Paste your token when prompted
   - The token will be stored securely in your macOS keychain

### Environment Configuration (Optional)

If Node.js is not in your system PATH or you want to use a specific Node.js version, you can create a configuration file:

1. **Create the config directory**
   ```bash
   mkdir -p ~/.config/bktide
   ```

2. **Create the environment file**
   ```bash
   cp /path/to/workflow/env.example ~/.config/bktide/env
   ```

3. **Edit the configuration**
   ```bash
   nano ~/.config/bktide/env
   ```

#### Common Configuration Examples

**For Homebrew on Apple Silicon (M1/M2) Macs:**
```bash
export PATH="/opt/homebrew/bin:$PATH"
NODE_BIN=/opt/homebrew/bin/node
```

**For Homebrew on Intel Macs:**
```bash
export PATH="/usr/local/bin:$PATH"
NODE_BIN=/usr/local/bin/node
```

**For nvm users:**
```bash
export PATH="/Users/$(whoami)/.nvm/versions/node/v18.17.0/bin:$PATH"
NODE_BIN="/Users/$(whoami)/.nvm/versions/node/v18.17.0/bin/node"
```

**For system Node.js:**
```bash
NODE_BIN=node
```

## Usage

### Available Commands

- **`bktide viewer`** - Show your Buildkite user information
- **`bktide orgs`** - List your organizations
- **`bktide pipelines [org]`** - List pipelines (optionally filtered by organization)
- **`bktide builds [filter]`** - List recent builds with optional filtering
- **`bktide annotations <build-ref>`** - Show annotations for a specific build

### Build References
When referencing builds, you can use:
- Slug format: `org/pipeline/123`
- URL format: `https://buildkite.com/org/pipeline/builds/123`
- Alfred format: `@https://buildkite.com/org/pipeline/builds/123`

### Keyboard Shortcuts
- **Enter** - Open build/pipeline in browser
- **⌘ + Enter** - Copy URL to clipboard
- **⌥ + Enter** - Copy build number or name to clipboard

## Troubleshooting

### "Command not found" or "node: command not found"

This means Node.js is not in your PATH or the workflow can't find it.

**Solution 1: Add Node.js to PATH**
1. Find where Node.js is installed:
   ```bash
   which node
   ```
2. Add that directory to your PATH in `~/.config/bktide/env`:
   ```bash
   export PATH="/path/to/node/bin:$PATH"
   ```

**Solution 2: Specify Node.js path directly**
1. Find the full path to Node.js:
   ```bash
   which node
   ```
2. Set `NODE_BIN` in `~/.config/bktide/env`:
   ```bash
   NODE_BIN=/full/path/to/node
   ```

### "Authentication failed" or "Invalid token"

Your Buildkite API token is missing or invalid.

**Solution:**
1. Check your token: `bktide token check`
2. If invalid, store a new one: `bktide token store`
3. Verify the token has the required scopes in Buildkite

### Workflow is slow or times out

**Solution 1: Check Node.js version**
```bash
node --version
```
Ensure you're running Node.js 18 or later.

**Solution 2: Clear cache**
Run this in Terminal:
```bash
rm -rf ~/.cache/bktide
```

**Solution 3: Enable debug logging**
1. Add to `~/.config/bktide/env`:
   ```bash
   DEBUG=true
   ```
2. Check logs at `~/.local/state/bktide/logs/alfred.log`

### Native dependency errors

If you see errors about `@napi-rs/keyring` or missing binaries:

**Solution 1: Reinstall the workflow**
1. Delete the current workflow from Alfred
2. Download and install the latest version

**Solution 2: Check architecture**
Make sure you're using the correct workflow for your Mac:
- Apple Silicon (M1/M2): Ensure ARM64 support
- Intel: Ensure x64 support

## Getting Help

### Debug Information
To get debug information for troubleshooting:

1. **Enable debug mode**
   ```bash
   echo "DEBUG=true" >> ~/.config/bktide/env
   ```

2. **Check debug logs**
   ```bash
   tail -f ~/.local/state/bktide/logs/alfred.log
   ```

3. **Test from command line**
   ```bash
   /path/to/workflow/bin/alfred-entrypoint viewer
   ```

### Log Files
- Alfred logs: `~/.local/state/bktide/logs/alfred.log`
- Cache location: `~/.cache/bktide/`
- Config location: `~/.config/bktide/`

### Support
If you're still having issues:
1. Check the [GitHub Issues](https://github.com/yourusername/bktide/issues)
2. Create a new issue with:
   - Your macOS version
   - Node.js version (`node --version`)
   - Alfred version
   - Error messages from the log files
   - Contents of your `~/.config/bktide/env` file (redacted)

## Advanced Configuration

### Custom Cache Directory
```bash
# In ~/.config/bktide/env
CACHE_DIR=/custom/path/to/cache
```

### Custom Log Directory
```bash
# In ~/.config/bktide/env
LOG_DIR=/custom/path/to/logs
```

### Disable Caching
```bash
# In ~/.config/bktide/env
NO_CACHE=true
```

### Multiple Node.js Versions
If you have multiple Node.js versions, you can specify exactly which one to use:
```bash
# In ~/.config/bktide/env
NODE_BIN=/Users/username/.nvm/versions/node/v18.17.0/bin/node
```
