# Alfred Workflow Development Testing Checklist

This checklist is for developers working on the Alfred workflow to ensure it works correctly across different environments and configurations before release.

> **For end users**: If you're having issues with the Alfred workflow, see the [troubleshooting guide](../user/alfred/troubleshooting.md).

## Pre-Release Testing Matrix

### Environment Combinations
Test the workflow on the current standard environment:

**Operating System:**
- [ ] Latest macOS (currently Sonoma 14.x)

**Alfred Version:**
- [ ] Alfred 5 (latest stable)

**Node.js Installation States:**
- [ ] Node.js installed via official installer
- [ ] Node.js installed via Homebrew
- [ ] Node.js installed via nvm
- [ ] Node.js not installed (should show helpful error)

**Token States:**
- [ ] No token configured
- [ ] Token stored in keychain via `bktide token store`
- [ ] Token provided via environment variable
- [ ] Invalid/expired token

**Environment File States:**
- [ ] No env file (default behavior)
- [ ] `~/.config/bktide/env` exists with PATH override
- [ ] `~/.config/bktide/env` exists with NODE_BIN override
- [ ] Workflow directory `.env` exists (fallback)

## Packaging Validation

### Build Process
- [ ] `npm run build` completes without errors
- [ ] `npm run package` creates workflow bundle successfully
- [ ] Generated `.alfredworkflow` file is valid zip archive
- [ ] SHA256 checksum file is generated correctly
- [ ] All required files are included in bundle:
  - [ ] `info.plist`
  - [ ] `icon.png` and `icons/` directory
  - [ ] `bin/alfred-entrypoint`
  - [ ] `dist/` directory with compiled JS
  - [ ] `node_modules/` with production dependencies only
  - [ ] `package.json` and `package-lock.json`
  - [ ] `env.example`
  - [ ] `WORKFLOW_README.md`

### Native Dependencies
- [ ] `@napi-rs/keyring` binaries are present in `node_modules`
- [ ] Correct architecture binaries included (darwin-arm64, darwin-x64)
- [ ] Native modules load correctly in packaged workflow

## Functional Testing

### Core Commands
Test each command with debug logging enabled (`~/.config/bktide/env` with `DEBUG=true`):

**Viewer Command:**
- [ ] `bktide viewer` shows user information
- [ ] Returns valid JSON when format specified
- [ ] Shows appropriate error when token is invalid
- [ ] Caches results appropriately

**Organizations Command:**
- [ ] `bktide orgs` lists accessible organizations
- [ ] Handles empty organization list gracefully
- [ ] Shows appropriate error when token lacks permissions

**Pipelines Command:**
- [ ] `bktide pipelines` lists all pipelines
- [ ] `bktide pipelines --org <org>` filters by organization
- [ ] Handles non-existent organization gracefully
- [ ] Pagination works for large pipeline lists

**Builds Command:**
- [ ] `bktide builds` shows recent builds across all orgs
- [ ] `bktide builds --org <org>` filters by organization
- [ ] `bktide builds --pipeline <pipeline>` filters by pipeline
- [ ] `bktide builds --state FAILED` filters by state
- [ ] `bktide builds --branch main` filters by branch
- [ ] Handles empty results gracefully

**Annotations Command:**
- [ ] `bktide annotations org/pipeline/123` shows build annotations
- [ ] `bktide annotations @https://buildkite.com/org/pipeline/builds/123` works with URL
- [ ] Handles builds with no annotations
- [ ] Handles non-existent builds gracefully
- [ ] HTML content is converted to readable text

**Token Management:**
- [ ] `bktide token store` prompts for and stores token securely
- [ ] `bktide token check` validates stored token
- [ ] `bktide token check --token <token>` validates provided token

### Output Formats
Test each command with different output formats:
- [ ] `--format plain` (default) produces human-readable output
- [ ] `--format json` produces valid JSON
- [ ] `--format alfred` produces Alfred-compatible JSON with `items` array

### Output Behavior & TTY
- [ ] Plain format: shows a single success confirmation line (✓ …) after operations complete; no duplicate completion lines.
- [ ] Plain format: aligned tables for pipelines, builds, and orgs; no wrapping anomalies in typical terminals.
- [ ] json/alfred: no extra lines, no symbols or color; progress indicators and reporter are silent.
- [ ] `--color auto|always|never` behaves as expected; `NO_COLOR=1` disables color.
- [ ] Progress indicators: visible only in interactive TTY; clear on completion (no residual frames).
  - [ ] Spinners show for indeterminate operations
  - [ ] Progress bars show for operations with known totals (multi-org, token validation)

### Icon Display Modes
- [ ] Default mode shows UTF-8 symbols (✓, ✗, ◷, etc.)
- [ ] `BKTIDE_EMOJI=1` or `--emoji` shows emoji (✅, ❌, 🔄, etc.)
- [ ] `BKTIDE_ASCII=1` or `--ascii` shows ASCII ([OK], [FAIL], [>>>], etc.)
- [ ] Debug output uses appropriate icons for each mode
- [ ] Icons display correctly in different terminal emulators

### Alfred Integration
- [ ] Workflow import completes without errors
- [ ] All commands appear in Alfred search
- [ ] Keyboard shortcuts work correctly:
  - [ ] Enter opens URLs in browser
  - [ ] ⌘+Enter copies URLs to clipboard
  - [ ] ⌥+Enter copies build numbers/names to clipboard
- [ ] Error messages display correctly in Alfred
- [ ] Loading states show appropriate feedback

### Shell Completion Testing
Test shell completions across supported shells:

**Fish Shell:**
- [ ] Command completion: `bktide <Tab>` shows available commands
- [ ] Option completion: `bktide builds --<Tab>` shows available options
- [ ] Value completion: `bktide --format <Tab>` shows format options
- [ ] Dynamic completion (with jq): `bktide builds --org <Tab>` shows organization names
- [ ] Dynamic completion (with jq): `bktide builds --pipeline <Tab>` shows pipeline names
- [ ] Completion works with both `bktide` and `bin/bktide`
- [ ] No errors in completion generation: `bktide completions fish` produces valid output

**Bash Shell:**
- [ ] Command completion: `bktide <Tab><Tab>` shows available commands
- [ ] Option completion: `bktide builds --<Tab><Tab>` shows available options
- [ ] Value completion: `bktide --format <Tab><Tab>` shows format options
- [ ] Completion works after sourcing: `source <(bktide completions bash)`
- [ ] No errors in completion generation: `bktide completions bash` produces valid output

**Zsh Shell:**
- [ ] Command completion: `bktide <Tab>` shows available commands
- [ ] Option completion: `bktide builds --<Tab>` shows available options
- [ ] Value completion: `bktide --format <Tab>` shows format options
- [ ] Completion works after sourcing: `source <(bktide completions zsh)`
- [ ] No errors in completion generation: `bktide completions zsh` produces valid output

**Completion Generation:**
- [ ] `bktide completions` auto-detects shell and generates appropriate completions
- [ ] `bktide completions --help` shows usage information
- [ ] Generated completions are syntactically valid for each shell
- [ ] Completions handle special characters in organization/pipeline names correctly
- [ ] Completions work with quoted arguments: `bktide builds --org "my org"`

**Dynamic Completion Requirements (Fish with jq):**
- [ ] Organization completion requires valid token and shows accessible orgs
- [ ] Pipeline completion requires valid token and org context
- [ ] Completion gracefully handles network errors (shows static completions)
- [ ] Completion gracefully handles authentication errors (shows static completions)
- [ ] Completion performance is acceptable (< 2 seconds for dynamic completions)

## Error Handling Testing

### Authentication Errors
- [ ] Missing token shows helpful error message
- [ ] Invalid token shows authentication error  
- [ ] Expired token shows appropriate message
- [ ] Token with insufficient permissions shows clear error

### Network Errors
- [ ] Network unavailable shows appropriate error
- [ ] API rate limits are handled gracefully
- [ ] Timeout errors are handled appropriately
- [ ] SSL/TLS errors show helpful messages

### Input Validation Errors
- [ ] Invalid build references show format help
- [ ] Non-existent organizations show available options
- [ ] Invalid command arguments show usage help

### Node.js Environment Errors
- [ ] Node.js not found shows installation instructions
- [ ] Incorrect Node.js version shows version requirements
- [ ] Permission errors show troubleshooting steps

> **Note**: For detailed troubleshooting steps for end users, see [Alfred troubleshooting guide](../user/alfred/troubleshooting.md).

## Performance Testing

### Response Times
Measure and verify acceptable response times:
- [ ] `bktide viewer` completes in < 2 seconds (cached)
- [ ] `bktide orgs` completes in < 3 seconds (cached)
- [ ] `bktide pipelines` completes in < 5 seconds (cached)
- [ ] `bktide builds` completes in < 5 seconds (first 50 results)
- [ ] `bktide annotations` completes in < 3 seconds (cached)

### Caching Behavior
- [ ] First command execution hits API (cache miss in debug log)
- [ ] Second execution uses cache (cache hit in debug log)
- [ ] Cache expires correctly after TTL
- [ ] `--no-cache` bypasses cache correctly
- [ ] `--clear-cache` clears cache correctly

### Memory Usage
- [ ] Workflow doesn't leave hanging Node.js processes
- [ ] Memory usage is reasonable (< 100MB for typical operations)
- [ ] No memory leaks during repeated operations

## Configuration Testing

### Environment File Variations
Test with different `~/.config/bktide/env` configurations:

**PATH Override:**
```bash
export PATH="/opt/homebrew/bin:$PATH"
```
- [ ] Node.js found in custom PATH
- [ ] Error if PATH doesn't contain Node.js

**NODE_BIN Override:**
```bash
NODE_BIN=/opt/homebrew/bin/node
```
- [ ] Uses specified Node.js binary
- [ ] Error if specified binary doesn't exist
- [ ] Error if specified binary is wrong version

**Debug Mode:**
```bash
DEBUG=true
```
- [ ] Debug logging appears in Alfred logs
- [ ] Debug output includes cache hit/miss information
- [ ] Debug output includes API request timing

**Cache Configuration:**
```bash
NO_CACHE=true
CACHE_DIR=/tmp/bktide-test-cache
```
- [ ] Caching disabled when NO_CACHE=true
- [ ] Custom cache directory is used and created

### Token Configuration Priority
Test token resolution order:
1. [ ] `--token` command line argument (highest priority)
2. [ ] `BUILDKITE_API_TOKEN` environment variable
3. [ ] Stored token in keychain (lowest priority)

## Regression Testing

### Workflow Import/Export
- [ ] Export workflow from Alfred produces valid `.alfredworkflow`
- [ ] Re-import exported workflow works correctly
- [ ] Workflow settings and configurations are preserved

### Upgrade Testing
- [ ] Install older version, then upgrade to new version
- [ ] Existing token and configuration preserved
- [ ] Cache compatibility maintained or gracefully handled

### Cross-Platform Compatibility
- [ ] Workflow works correctly across different Mac architectures
- [ ] Node.js architecture detection works correctly

## Log File Validation

### Alfred Logs
Check `~/.local/state/bktide/logs/alfred.log`:
- [ ] Contains command execution logs
- [ ] Shows clear error messages
- [ ] Includes timing information in debug mode
- [ ] No sensitive information (tokens) in logs

### Log Rotation
- [ ] Log files don't grow unbounded
- [ ] Old log entries are cleaned up appropriately

## Security Testing

### Token Security
- [ ] Tokens are not logged in plain text
- [ ] Tokens are stored securely in keychain
- [ ] Environment variables with tokens are handled securely

### File Permissions
- [ ] Workflow files have appropriate permissions
- [ ] Cache files are only readable by user
- [ ] Config files have secure permissions

## Documentation Validation

### README Accuracy
- [ ] Installation instructions work as written
- [ ] Configuration examples are correct
- [ ] Troubleshooting steps resolve common issues
- [ ] Links are functional and current

### Help Text
- [ ] `--help` flags show accurate usage information
- [ ] Error messages include helpful suggestions
- [ ] Examples in help text work as shown

## Release Verification

### Final Checks Before Release
- [ ] Version numbers are consistent across all files
- [ ] Changelog includes all changes
- [ ] All tests from this checklist pass
- [ ] Clean install works on fresh macOS system
- [ ] Existing users can upgrade without issues

### Smoke Test Sequence
Perform this sequence on a clean system:
1. [ ] Download and install workflow
2. [ ] Run `bktide viewer` (should prompt for token)
3. [ ] Run `bktide token store` and enter valid token
4. [ ] Run `bktide viewer` again (should show user info)
5. [ ] Run `bktide orgs` (should show organizations)
6. [ ] Run `bktide pipelines` (should show pipelines)
7. [ ] Run `bktide builds` (should show recent builds)
8. [ ] Run `bktide annotations` with valid build reference

## Test Automation

### Automated Testing Scripts
- [ ] Create script to test basic commands
- [ ] Create script to validate output formats
- [ ] Create script to test error conditions
- [ ] Create script to measure performance

### CI Integration
- [ ] Package creation runs in CI
- [ ] Basic functionality tests run in CI
- [ ] Cross-platform testing setup
- [ ] Release artifact validation

---

## Test Execution Notes

**Environment:** Record testing environment details
- macOS Version: _______________
- Alfred Version: ______________
- Node.js Version: _____________
- Test Date: __________________

**Results:** Check off completed tests and note any issues found.

**Issues Found:** Document any issues discovered during testing with reproduction steps.
