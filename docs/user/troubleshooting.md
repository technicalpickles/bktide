# Troubleshooting bktide CLI

This guide helps you resolve common issues with the bktide command-line interface.

## Authentication Issues

### "No Buildkite API token found"
This error means bktide can't find your API token.

**Solutions:**
1. **Store a token permanently:**
   ```bash
   bktide token --store
   ```
   
2. **Set environment variable:**
   ```bash
   export BUILDKITE_API_TOKEN=your_token_here
   ```
   
3. **Use the --token flag:**
   ```bash
   bktide builds --token your_token_here
   ```

### "Authentication failed" or "Invalid token"
Your token is invalid, expired, or lacks necessary permissions.

**Solutions:**
1. **Create a new token:**
   - Go to [Buildkite API Access Tokens](https://buildkite.com/user/api-access-tokens)
   - Create a new token with **GraphQL** scope enabled
   - Store it: `bktide token --store`

2. **Check token permissions:**
   ```bash
   bktide token --check
   ```

### "No organizations accessible"
Your token works but doesn't have access to any organizations.

**Solutions:**
- Verify you're a member of Buildkite organizations
- Check that your token has the correct scopes
- Contact your Buildkite admin to verify permissions

## Command Issues

### "Command not found: bktide"
The CLI isn't installed or not in your PATH.

**Solutions:**
1. **Install globally:**
   ```bash
   npm install -g bktide
   ```

2. **Check installation:**
   ```bash
   which bktide
   bktide --version
   ```

3. **Use npx if not installed globally:**
   ```bash
   npx bktide builds
   ```

### Commands are slow or timing out
Network or API issues are causing delays.

**Solutions:**
1. **Check internet connection:**
   ```bash
   ping buildkite.com
   ```

2. **Try with debug mode:**
   ```bash
   bktide builds --debug
   ```

3. **Clear cache:**
   ```bash
   bktide builds --clear-cache
   ```

4. **Disable cache temporarily:**
   ```bash
   bktide builds --no-cache
   ```

### "Build not found" or "Pipeline not found"
The specified build or pipeline doesn't exist or you don't have access.

**Solutions:**
1. **Check the reference format:**
   ```bash
   # Correct formats:
   bktide build org-name/pipeline-name/123
   bktide build @https://buildkite.com/org/pipeline/builds/123
   ```

2. **Verify you have access:**
   ```bash
   bktide orgs  # Check available organizations
   bktide pipelines --org org-name  # Check available pipelines
   ```

3. **Check the build exists:**
   - Visit the Buildkite web interface
   - Verify the build number is correct

## Output Issues

### Garbled or missing characters
Terminal encoding or font issues.

**Solutions:**
1. **Use ASCII mode:**
   ```bash
   bktide builds --ascii
   # or set environment variable
   export BKTIDE_ASCII=1
   ```

2. **Check terminal font:**
   - Use a font that supports UTF-8 symbols
   - Try a different terminal emulator

3. **Disable emoji mode if enabled:**
   ```bash
   unset BKTIDE_EMOJI
   ```

### No colors in output
Color output is disabled or not supported.

**Solutions:**
1. **Force color output:**
   ```bash
   bktide builds --color always
   ```

2. **Check NO_COLOR environment variable:**
   ```bash
   unset NO_COLOR
   ```

3. **Verify terminal supports colors:**
   ```bash
   echo $TERM
   # Should show something like "xterm-256color"
   ```

### JSON output is malformed
Usually caused by mixing debug output with JSON format.

**Solutions:**
1. **Don't use --debug with JSON format:**
   ```bash
   # Wrong:
   bktide builds --format json --debug
   
   # Correct:
   bktide builds --format json
   ```

2. **Use --quiet to suppress extra output:**
   ```bash
   bktide builds --format json --quiet
   ```

## Performance Issues

### Commands are very slow
Caching issues or large datasets.

**Solutions:**
1. **Check cache status:**
   ```bash
   bktide builds --debug
   # Look for "Cache hit" or "Cache miss" messages
   ```

2. **Clear corrupted cache:**
   ```bash
   rm -rf ~/.local/state/bktide/cache/
   ```

3. **Reduce result count:**
   ```bash
   bktide builds --count 10  # Instead of default 50
   ```

4. **Filter results:**
   ```bash
   bktide builds --org specific-org  # Instead of all orgs
   ```

### High memory usage
Large datasets or memory leaks.

**Solutions:**
1. **Use pagination:**
   ```bash
   bktide builds --count 20  # Smaller batches
   ```

2. **Filter by organization:**
   ```bash
   bktide builds --org main-org  # Reduce scope
   ```

3. **Restart terminal if memory usage persists**

## Network Issues

### "Connection refused" or "Network error"
Can't connect to Buildkite API.

**Solutions:**
1. **Check internet connection:**
   ```bash
   curl -I https://api.buildkite.com/v2/user
   ```

2. **Check for proxy settings:**
   ```bash
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

3. **Try different network:**
   - Switch from WiFi to mobile hotspot
   - Try from different location

### SSL/Certificate errors
Certificate validation issues.

**Solutions:**
1. **Update Node.js:**
   ```bash
   node --version  # Should be 18+ 
   ```

2. **Check system time:**
   - Ensure system clock is correct
   - SSL certificates are time-sensitive

3. **Corporate firewall:**
   - Contact IT about Buildkite API access
   - May need proxy configuration

## Cache Issues

### Stale or incorrect data
Cache contains outdated information.

**Solutions:**
1. **Clear cache:**
   ```bash
   bktide builds --clear-cache
   ```

2. **Disable cache temporarily:**
   ```bash
   bktide builds --no-cache
   ```

3. **Check cache location:**
   ```bash
   ls -la ~/.local/state/bktide/cache/
   ```

### Cache permission errors
Can't read or write cache files.

**Solutions:**
1. **Fix permissions:**
   ```bash
   chmod -R 755 ~/.local/state/bktide/
   ```

2. **Clear cache directory:**
   ```bash
   rm -rf ~/.local/state/bktide/cache/
   ```

3. **Use different cache location:**
   ```bash
   export XDG_STATE_HOME=/tmp/bktide-state
   ```

## Configuration Issues

### Commands use wrong settings
Environment variables or config files interfering.

**Solutions:**
1. **Check environment variables:**
   ```bash
   env | grep -i buildkite
   env | grep -i bktide
   ```

2. **Reset to defaults:**
   ```bash
   unset BUILDKITE_API_TOKEN
   unset BKTIDE_ASCII
   unset BKTIDE_EMOJI
   unset NO_COLOR
   ```

3. **Use explicit flags:**
   ```bash
   bktide builds --token your_token --format plain --color auto
   ```

## Getting More Help

### Enable Debug Mode
For any issue, start with debug mode to see what's happening:

```bash
bktide builds --debug
```

This shows:
- API requests and responses
- Cache hit/miss information
- Timing information
- Detailed error messages

### Check Log Files
bktide writes logs to `~/.local/state/bktide/logs/`:

```bash
# View recent logs
tail -f ~/.local/state/bktide/logs/cli.log

# Search for errors
grep -i error ~/.local/state/bktide/logs/cli.log
```

### Test with Minimal Command
Try the simplest possible command:

```bash
bktide viewer --debug --no-cache
```

If this works, the issue is likely with specific commands or caching.

### Common Debug Commands

```bash
# Test authentication
bktide token --check

# Test basic API access
bktide viewer --debug

# Test without cache
bktide orgs --no-cache --debug

# Test with explicit token
bktide viewer --token your_token --debug

# Test output formats
bktide orgs --format json
```

### Report Issues

If you can't resolve the issue:

1. **Gather information:**
   ```bash
   bktide --version
   node --version
   npm --version
   echo $SHELL
   uname -a
   ```

2. **Run with debug mode:**
   ```bash
   bktide your-failing-command --debug
   ```

3. **Check logs:**
   ```bash
   tail -50 ~/.local/state/bktide/logs/cli.log
   ```

4. **Remove sensitive information** (tokens, organization names) before sharing

## Quick Fixes Checklist

When bktide isn't working:

- [ ] Check internet connection: `ping buildkite.com`
- [ ] Verify token: `bktide token --check`
- [ ] Try debug mode: `bktide viewer --debug`
- [ ] Clear cache: `bktide viewer --clear-cache`
- [ ] Check for updates: `npm update -g bktide`
- [ ] Restart terminal session
- [ ] Try with minimal command: `bktide viewer --no-cache`
