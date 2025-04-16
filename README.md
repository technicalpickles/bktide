# bk-cli

A Command Line Interface for Buildkite.

## Installation

For development:

```bash
# Clone the repository
git clone <repository-url>
cd bk-cli

# Install dependencies
npm install

# Build the project
npm run build

# Create a global symlink
npm link
```

## Usage

```bash
# Basic command
bk-cli hello

# Trigger a build
bk-cli build --pipeline my-pipeline --branch feature/new-feature --message "Build from CLI"

# Help
bk-cli --help
```

## Development

```bash
# Run in development mode (without building)
npm run dev -- hello

# Build the project
npm run build

# Watch for changes and rebuild automatically
npm run watch
```

## License

ISC 