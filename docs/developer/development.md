# Development Guide

## Running the CLI

The CLI can be run in several ways:

```bash
# Regular development mode
npm run dev -- <command> [options]

# With source maps and improved error handling
npm run dev:sourcemap -- <command> [options]

# Compiled mode with source maps (recommended for debugging)
npm run dev:compiled -- <command> [options]
```

## UI Guidelines

### Icon System

The project uses a centralized icon system with three display modes for different terminal capabilities:

**Icon Display Modes:**
- **UTF-8 (default)**: Clean symbols like ✓, ✗, ◷ that work universally
- **Emoji**: Full emoji support (✅, ❌, 🔄) via `BKTIDE_EMOJI=1` or `--emoji`
- **ASCII**: Plain text ([OK], [FAIL]) via `BKTIDE_ASCII=1` or `--ascii`

**Usage in Code:**
```typescript
import { getStateIcon, getAnnotationIcon, getProgressIcon } from '../ui/theme.js';

// Use theme functions for icons
const icon = getStateIcon('PASSED');  // Returns ✓ (or ✅ in emoji mode, [OK] in ASCII)
lines.push(`${icon} Build passed`);

// Available functions:
// - getStateIcon(state) - Build/job states (PASSED, FAILED, RUNNING, etc.)
// - getAnnotationIcon(style) - Annotation styles (ERROR, WARNING, INFO, SUCCESS)
// - getProgressIcon(type) - Debug indicators (TIMING, STARTING, SUCCESS_LOG, etc.)

// ❌ AVOID hard-coding emoji
lines.push(`✅ Build passed`);  // Don't do this
```

**Examples:**
```typescript
// In formatters
const statusIcon = getStateIcon(build.state);
const annotationIcon = getAnnotationIcon('ERROR');

// In debug logging
logger.debug(`${getProgressIcon('SUCCESS_LOG')} Operation completed`);
```

### Tip and Hint Formatting

When displaying tips or hints to users, use the standardized `formatTips` utility:

**Correct Usage:**
```typescript
import { formatTips, TipStyle } from '../../ui/theme.js';

// Collect tips as plain strings (no formatting)
const tips = [
  'Use --org <name> to filter to a specific organization',
  'Use --filter <text> to search by name'
];

// Use formatTips utility which automatically:
// - Adds "Tips:" header
// - Adds arrow icons (→) to each tip
// - Includes "Use --no-tips to hide these hints"
// - Applies consistent dimmed styling
if (tips.length > 0) {
  lines.push('');
  lines.push(formatTips(tips, TipStyle.GROUPED));
}
```

**Example Output:**
```
Tips:
  → Use --org <name> to filter to a specific organization
  → Use --filter <text> to search by name
  → Use --no-tips to hide these hints
```

**Guidelines:**
- Always use `formatTips()` utility, never format tips manually
- Display tips AFTER showing data, not before
- Keep tips concise and actionable
- Only show contextually relevant tips
- The utility automatically includes the turn-off hint

## Error Handling Improvements

For better error handling and stack traces:

1. Configure TypeScript with source maps in `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "sourceMap": true,
       "inlineSources": true,
       "sourceRoot": "/"
     }
   }
   ```

2. Use the `dev:compiled` script, which:
   - Compiles TypeScript with source maps
   - Runs Node.js with source maps enabled
   - Provides proper stack traces back to the original TypeScript files

3. For direct debugging with Chrome DevTools, use:
   ```bash
   npm run debug:inspect -- <command> [options]
   ```

## Common Commands

```bash
# Show current user information
npm run dev -- viewer

# List organizations
npm run dev -- orgs

# List pipelines for an organization
npm run dev -- pipelines [--org <org>] [--count <count>]

# List builds
npm run dev -- builds [--org <org>] [--pipeline <pipeline>] [--branch <branch>]
```

Add the `--debug` flag to any command for detailed error information.

## Output Architecture

- Formatters: convert domain data to strings by format (plain|json|alfred). They own the content of results and errors.
- Reporter: handles presentation and IO for human-readable output (plain only). Provides `info/success/warn/error` and a simple `table(rows)` helper. Silent for json/alfred.
- Progress indicators: unified API for showing progress during long-running operations
  - Use `Progress.spinner()` for operations of unknown duration
  - Use `Progress.bar()` for operations with known totals (e.g., processing N organizations)
  - TTY-aware and automatically hidden in pipes, CI, and machine formats

Usage rules
- Only use Reporter in `plain` format; avoid any Reporter calls for `json|alfred`.
- Use Progress indicators for operations that can take noticeable time:
  - `Progress.spinner()` for pagination loops, single API calls
  - `Progress.bar()` for multi-org queries or operations with known item counts
  - Always call `stop()` or use try/finally for cleanup
  - Let Reporter print the single success line after progress completes
- Prefer aligned tables for list outputs in plain format. Keep JSON/Alfred schemas unchanged.

## Shell Completions Development

### Testing Completions
```bash
# Generate completions for testing
bin/bktide completions fish --quiet > test.fish
fish -c "source test.fish && complete --do-complete 'bktide builds --'"

# Install for local development
npm run completions:install  # Fish users
```

### Adding New Commands/Options
When adding new commands or options to the CLI:
1. Update the static completion files in `completions/` if needed
2. The `GenerateCompletions` command will automatically detect new commands
3. Test completions work for both `bktide` and `bin/bktide`

### Completion Files
- `completions/bktide.fish` - Basic Fish completions
- `completions/bktide-dynamic.fish` - Fish with dynamic completions (requires jq)
- `completions/bktide.bash` - Bash completions
- `completions/bktide.zsh` - Zsh completions

## Using the GraphQL Client in Your Code

The Buildkite GraphQL client can be used in your own code:

```typescript
import { BuildkiteClient } from './services/BuildkiteClient';
import { GET_PIPELINES } from './graphql/queries';

const client = new BuildkiteClient('your-api-token');

async function getPipelines(organizationSlug: string) {
  const variables = {
    organizationSlug,
    first: 10
  };
  
  const data = await client.query(GET_PIPELINES, variables);
  return data.organization.pipelines.edges;
}
```

## Using the REST API Client

The Buildkite REST API client can be used in your own code:

```typescript
import { BuildkiteRestClient } from './services/BuildkiteRestClient';

const restClient = new BuildkiteRestClient('your-api-token');

async function getBuildsForUser(org: string, userId: string) {
  const builds = await restClient.getBuilds(org, {
    creator: userId,
    per_page: '10',
    page: '1'
  });
  
  return builds;
}
```

## Available GraphQL Queries

The `src/graphql/queries.ts` file contains several pre-defined GraphQL queries:

- `GET_VIEWER`: Get information about the authenticated user
- `GET_ORGANIZATIONS`: List organizations the user belongs to
- `GET_PIPELINES`: List pipelines in an organization
- `GET_BUILDS`: List builds for a pipeline
- `GET_VIEWER_BUILDS`: List builds for the current user

## Available API Endpoints

### GraphQL API
The `src/graphql/queries.ts` file contains several pre-defined GraphQL queries:

- `GET_VIEWER`: Get information about the authenticated user
- `GET_ORGANIZATIONS`: List organizations the user belongs to
- `GET_PIPELINES`: List pipelines in an organization
- `GET_BUILDS`: List builds for a pipeline

### REST API
The `src/services/BuildkiteRestClient.ts` file provides access to the Buildkite REST API endpoints:

- `getBuilds`: Get builds from an organization with filtering options including by creator/user 