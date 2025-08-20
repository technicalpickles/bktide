# Shell Completions Feature

## Added in Current Version

### New Features

#### Shell Completions Support
- **New command**: `bktide completions [shell]` generates shell completion scripts
- **Supported shells**: Fish, Bash, and Zsh
- **Auto-detection**: Automatically detects your shell when no argument provided
- **Dual support**: Completions work for both global `bktide` and local development `bin/bktide`

#### Completion Features
- Command completion: All commands are auto-completed
- Option completion: Both long (`--option`) and short (`-o`) options
- Value completion: Predefined values for options like `--format`, `--state`, etc.
- Context-aware: Options only appear for relevant commands
- No file pollution: File completions are disabled to avoid suggesting irrelevant local files

#### Dynamic Completions (Fish + jq)
- Organization names fetched from your Buildkite account
- Pipeline names filtered by selected organization
- Git branches from current repository
- Requires valid Buildkite token for API calls

### Installation

```bash
# Fish
bktide completions fish > ~/.config/fish/completions/bktide.fish

# Bash
echo 'source <(bktide completions bash)' >> ~/.bashrc

# Zsh
echo 'source <(bktide completions zsh)' >> ~/.zshrc
```

### Developer Experience
- New npm scripts: `completions:install`, `completions:generate`
- Static completion files in `completions/` directory
- GenerateCompletions command for dynamic generation
- Comprehensive documentation in `docs/shell-completions.md`

### Technical Implementation
- Installation instructions output to stderr (won't pollute completion scripts)
- Completion scripts output to stdout (for easy redirection)
- Quiet mode (`--quiet`) suppresses installation instructions
- Works in pipelines and non-TTY environments
