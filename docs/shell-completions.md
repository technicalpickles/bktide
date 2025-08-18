# Shell Completions for bktide

The bktide CLI supports auto-completion for Fish, Bash, and Zsh shells. Completions work for both globally installed `bktide` and local development with `bin/bktide`.

## Features

- **Command completion**: Auto-complete all available commands (viewer, orgs, pipelines, builds, etc.)
- **Option completion**: Auto-complete command-specific and global options
- **Value completion**: Auto-complete option values (e.g., formats, log levels, build states)
- **Dynamic completion** (Fish with jq installed): Auto-complete organization names, pipeline names, and branches from your Buildkite account
- **Local development support**: Completions work with both `bktide` and `bin/bktide`

## Quick Installation

### Fish Shell

```fish
# Install completions for your user
bktide completions fish > ~/.config/fish/completions/bktide.fish

# Reload your shell
exec fish
```

### Bash Shell

```bash
# Add to your ~/.bashrc
echo 'source <(bktide completions bash)' >> ~/.bashrc

# Reload your shell
source ~/.bashrc
```

### Zsh Shell

```zsh
# Option 1: Add to your ~/.zshrc
echo 'source <(bktide completions zsh)' >> ~/.zshrc

# Option 2: Install to completions directory
mkdir -p ~/.zsh/completions
bktide completions zsh > ~/.zsh/completions/_bktide
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc

# Reload your shell
source ~/.zshrc
```

## Detailed Installation Options

### Fish Shell

#### User-specific Installation (Recommended)
```fish
# Generate and install completions
bktide completions fish > ~/.config/fish/completions/bktide.fish

# The completions are loaded automatically
```

#### System-wide Installation
```fish
# Requires sudo
bktide completions fish | sudo tee /usr/share/fish/vendor_completions.d/bktide.fish
```

#### Dynamic Completions (Enhanced)
If you have `jq` installed, Fish completions will provide dynamic suggestions for:
- Organization names from your Buildkite account
- Pipeline names (filtered by selected organization)
- Git branches from your current repository

Install jq:
```fish
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Arch Linux
sudo pacman -S jq
```

### Bash Shell

#### User-specific Installation
```bash
# Option 1: Source from command (add to ~/.bashrc)
echo 'source <(bktide completions bash)' >> ~/.bashrc

# Option 2: Save to file and source
bktide completions bash > ~/.bktide-completions.bash
echo 'source ~/.bktide-completions.bash' >> ~/.bashrc
```

#### System-wide Installation
```bash
# Linux
bktide completions bash | sudo tee /etc/bash_completion.d/bktide

# macOS with Homebrew
bktide completions bash > $(brew --prefix)/etc/bash_completion.d/bktide
```

### Zsh Shell

#### User-specific Installation
```zsh
# Option 1: Source directly (add to ~/.zshrc)
echo 'source <(bktide completions zsh)' >> ~/.zshrc

# Option 2: Add to fpath
mkdir -p ~/.zsh/completions
bktide completions zsh > ~/.zsh/completions/_bktide

# Add to ~/.zshrc if not already present
cat >> ~/.zshrc << 'EOF'
fpath=(~/.zsh/completions $fpath)
autoload -U compinit && compinit
EOF
```

#### System-wide Installation
```zsh
# Depends on your system's zsh setup
bktide completions zsh | sudo tee /usr/local/share/zsh/site-functions/_bktide
```

## Local Development

When developing bktide locally, the completions automatically work for both:
- `bktide` (if installed globally via npm)
- `bin/bktide` (when running from the project directory)

No additional configuration is needed. The completion scripts detect and support both commands.

## Usage Examples

### Basic Command Completion
```bash
# Type and press Tab
bktide <Tab>
# Shows: viewer orgs pipelines builds token annotations completions boom

# Complete command options
bktide builds --<Tab>
# Shows: --org --pipeline --branch --state --count --page --filter ...
```

### Dynamic Organization Completion (Fish with jq)
```fish
# Auto-complete organization names from your Buildkite account
bktide pipelines --org <Tab>
# Shows: my-org another-org test-org ...
```

### State Value Completion
```bash
# Auto-complete build states
bktide builds --state <Tab>
# Shows: running scheduled passed failing failed canceled blocked ...
```

### Format Completion
```bash
# Auto-complete output formats
bktide builds --format <Tab>
# Shows: plain json alfred
```

## Updating Completions

When bktide is updated with new commands or options:

```bash
# Regenerate completions
bktide completions <your-shell> > <completion-file>

# For example (Fish):
bktide completions fish > ~/.config/fish/completions/bktide.fish
```

## Troubleshooting

### Completions Not Working

1. **Check shell version**:
   - Fish: 3.0+
   - Bash: 4.0+ (macOS ships with 3.2, install newer via Homebrew)
   - Zsh: 5.0+

2. **Verify installation**:
   ```bash
   # Fish
   ls ~/.config/fish/completions/bktide.fish
   
   # Bash
   complete -p bktide
   
   # Zsh
   echo $fpath | grep -q completions && echo "fpath configured"
   ```

3. **Reload your shell**:
   ```bash
   # Fish
   exec fish
   
   # Bash
   source ~/.bashrc
   
   # Zsh
   source ~/.zshrc
   ```

### Dynamic Completions Not Working (Fish)

1. **Check jq is installed**:
   ```fish
   which jq
   ```

2. **Verify Buildkite token is configured**:
   ```fish
   bktide token --check
   ```

3. **Test command manually**:
   ```fish
   bktide orgs --format json --quiet | jq -r '.[].slug'
   ```

### Completions for bin/bktide Not Working

1. **Ensure you're in the project directory**:
   ```bash
   ls bin/bktide
   ```

2. **Check executable permissions**:
   ```bash
   chmod +x bin/bktide
   ```

## Advanced Features

### Custom Completion Functions (Fish)

You can extend the completions with custom functions in your Fish config:

```fish
# Add to ~/.config/fish/config.fish
function __fish_bktide_recent_branches
    # Show recently used branches
    git reflog show --all | grep 'checkout:' | head -10 | awk '{print $NF}' | sort -u
end

# Use in completions
complete -c bktide -n "__fish_seen_subcommand_from builds" -l branch \
    -xa "(__fish_bktide_recent_branches)"
```

### Performance Optimization

For faster completions, especially with dynamic content:

1. **Enable caching** in bktide (default):
   ```bash
   bktide orgs  # First call fetches from API
   bktide orgs  # Subsequent calls use cache
   ```

2. **Increase cache TTL** for completion queries:
   ```bash
   alias bktide-complete='bktide --cache-ttl 3600000'  # 1 hour cache
   ```

## Contributing

To improve completions:

1. Edit the completion scripts in `completions/`
2. Test with both `bktide` and `bin/bktide`
3. Update the `GenerateCompletions` command if adding new features
4. Submit a pull request with your improvements

## See Also

- [Fish Completion Documentation](https://fishshell.com/docs/current/completions.html)
- [Bash Completion Tutorial](https://iridakos.com/programming/2018/03/01/bash-programmable-completion-tutorial)
- [Zsh Completion System](https://zsh.sourceforge.io/Doc/Release/Completion-System.html)
