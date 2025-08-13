# bktide Alfred Workflow

A powerful Alfred workflow for interacting with Buildkite builds, pipelines, and organizations.

## Quick Start

1. **Install Node.js 18+** (required)
   - Download from [nodejs.org](https://nodejs.org/) or install via Homebrew: `brew install node`

2. **Set up your Buildkite token**
   - Open Alfred: `bktide token store`
   - Enter your Buildkite API token

3. **Start using the workflow**
   - `bktide viewer` - Show your user info
   - `bktide orgs` - List organizations
   - `bktide pipelines` - List pipelines
   - `bktide builds` - List recent builds

## Commands

| Command | Description |
|---------|-------------|
| `bktide viewer` | Show your Buildkite user information |
| `bktide orgs` | List your accessible organizations |
| `bktide pipelines [org]` | List pipelines, optionally filtered by org |
| `bktide builds [filter]` | List recent builds with optional filtering |
| `bktide annotations <build-ref>` | Show annotations for a specific build |

## Configuration

If Node.js is not in your PATH, create `~/.config/bktide/env`:

```bash
# For Homebrew on Apple Silicon
export PATH="/opt/homebrew/bin:$PATH"
NODE_BIN=/opt/homebrew/bin/node

# For Homebrew on Intel
export PATH="/usr/local/bin:$PATH"
NODE_BIN=/usr/local/bin/node

# For nvm
NODE_BIN=/Users/username/.nvm/versions/node/v18.17.0/bin/node
```

See `env.example` in this workflow for more configuration options.

## Troubleshooting

**"node: command not found"**
- Install Node.js or configure the path in `~/.config/bktide/env`

**"Authentication failed"**
- Run `bktide token store` to set up your Buildkite API token

**Workflow is slow**
- Clear cache: `rm -rf ~/.cache/bktide`
- Check logs: `~/.local/state/bktide/logs/alfred.log`

## Support

- Full documentation: See included `docs/alfred-installation.md`
- Issues: [GitHub Issues](https://github.com/yourusername/bktide/issues)
- Logs: `~/.local/state/bktide/logs/alfred.log`
