# Alfred Workflow Troubleshooting

This guide helps you troubleshoot common issues with the bktide Alfred workflow.

## Installation Issues

### Node.js Not Found
If you see "Node.js not found" errors:

1. **Check if Node.js is installed:**
   ```bash
   node --version
   ```

2. **Install Node.js if missing:**
   - **Official installer**: Download from [nodejs.org](https://nodejs.org/)
   - **Homebrew**: `brew install node`
   - **nvm**: `nvm install --lts && nvm use --lts`

3. **Restart Alfred** after installing Node.js

### Workflow Import Fails
If the workflow won't import:
- [ ] Ensure you downloaded the correct `.alfredworkflow` file
- [ ] Try double-clicking the file again
- [ ] Check Alfred preferences → Workflows → Import

## Authentication Issues

### No Token Configured
When you see "No token configured":
1. Run `bktide token store` in Terminal
2. Enter your Buildkite API token when prompted
3. Try the Alfred command again

### Invalid Token
If you see "Authentication failed":
1. Get a new token from [Buildkite](https://buildkite.com/user/api-access-tokens)
2. Run `bktide token store` to update it
3. Ensure the token has GraphQL scopes enabled

### Token Priority
The workflow looks for tokens in this order:
1. `BUILDKITE_API_TOKEN` environment variable
2. Token stored via `bktide token store`

## Command Issues

### Commands Don't Appear in Alfred
If bktide commands don't show up:
- [ ] Check that the workflow is enabled in Alfred preferences
- [ ] Try typing the full command name (e.g., "bktide viewer")
- [ ] Restart Alfred

### Commands Return Errors
For command-specific errors:

**Viewer Command Issues:**
- [ ] Verify your token with `bktide token check`
- [ ] Check internet connection
- [ ] Try `bktide viewer --debug` for more details

**Organization/Pipeline Issues:**
- [ ] Ensure you have access to the organization
- [ ] Check that the organization name is spelled correctly
- [ ] Try without filters first: `bktide orgs`

**Build Issues:**
- [ ] Verify the build reference format: `org/pipeline/123`
- [ ] Try the URL format: `@https://buildkite.com/org/pipeline/builds/123`
- [ ] Check that the build exists and you have access

## Performance Issues

### Slow Response Times
If commands are slow:
- [ ] Check your internet connection
- [ ] Clear the cache: add `NO_CACHE=true` to `~/.config/bktide/env`
- [ ] Try with debug mode to see timing: add `DEBUG=true` to `~/.config/bktide/env`

### Memory Issues
If Alfred becomes unresponsive:
- [ ] Restart Alfred
- [ ] Check Activity Monitor for hanging Node.js processes
- [ ] Clear the cache directory: `~/.local/state/bktide/cache/`

## Configuration Issues

### Custom Node.js Path
If Node.js is installed in a non-standard location:

1. Create `~/.config/bktide/env`:
   ```bash
   mkdir -p ~/.config/bktide
   ```

2. Add your Node.js path:
   ```bash
   # Option 1: Add to PATH
   export PATH="/opt/homebrew/bin:$PATH"
   
   # Option 2: Specify exact binary
   NODE_BIN=/opt/homebrew/bin/node
   ```

### Debug Mode
To enable detailed logging:

1. Add to `~/.config/bktide/env`:
   ```bash
   DEBUG=true
   ```

2. Check logs at `~/.local/state/bktide/logs/alfred.log`

## Output Format Issues

### Garbled Output
If output looks wrong:
- [ ] Check your terminal font supports UTF-8 symbols
- [ ] Try ASCII mode: add `BKTIDE_ASCII=1` to `~/.config/bktide/env`
- [ ] Disable emoji: remove `BKTIDE_EMOJI=1` if set

### Missing Colors
If output has no colors:
- [ ] Check if `NO_COLOR=1` is set in your environment
- [ ] Try `--color always` flag
- [ ] Verify your terminal supports colors

## Network Issues

### Connection Timeouts
If you see timeout errors:
- [ ] Check internet connection
- [ ] Verify Buildkite.com is accessible
- [ ] Check if you're behind a corporate firewall
- [ ] Try with a different network

### SSL/Certificate Errors
For SSL-related errors:
- [ ] Update Node.js to the latest version
- [ ] Check system date/time is correct
- [ ] Verify no proxy is interfering

## Cache Issues

### Stale Data
If you see outdated information:
- [ ] Clear cache: add `NO_CACHE=true` to `~/.config/bktide/env`
- [ ] Or delete cache directory: `rm -rf ~/.local/state/bktide/cache/`

### Cache Permission Errors
If you see cache-related permission errors:
- [ ] Check permissions: `ls -la ~/.local/state/bktide/`
- [ ] Fix permissions: `chmod -R 755 ~/.local/state/bktide/`

## Getting Help

### Enable Debug Logging
1. Add `DEBUG=true` to `~/.config/bktide/env`
2. Run the failing command
3. Check logs: `tail -f ~/.local/state/bktide/logs/alfred.log`

### Test Commands Directly
You can test commands outside Alfred:
```bash
# Test basic functionality
bktide viewer --debug

# Test with specific token
bktide viewer --token YOUR_TOKEN --debug

# Test output formats
bktide orgs --format json
```

### Common Error Messages

**"Node.js not found"**
- Install Node.js and restart Alfred

**"Authentication failed"**
- Check token with `bktide token check`
- Store new token with `bktide token store`

**"No organizations accessible"**
- Verify token permissions
- Check token scopes include GraphQL access

**"Build not found"**
- Verify build reference format
- Check you have access to the organization/pipeline

**"Network error"**
- Check internet connection
- Verify Buildkite.com is accessible

### Still Need Help?

If these steps don't resolve your issue:
1. Enable debug logging (see above)
2. Reproduce the issue
3. Check the debug logs for specific error messages
4. Report the issue with the debug output (remove any sensitive tokens)
