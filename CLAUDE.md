# bktide - Claude Development Guide

## What is bktide?

A feature-rich CLI for Buildkite CI/CD workflows, designed for power users who want fast access to build information. Includes shell completions (Fish/Bash/Zsh), Alfred integration, and multiple output formats.

## Tech Stack

- **Language**: TypeScript (strict mode, ES modules)
- **Runtime**: Node.js 20+
- **CLI Framework**: Commander.js
- **APIs**: GraphQL (graphql-request) + REST (node-fetch)
- **Testing**: Vitest with hybrid pattern-based mocking + MSW
- **Logging**: Pino (structured JSON logs)

## Project Structure

```
src/
├── index.ts              # CLI entry point
├── commands/             # Command implementations
│   ├── BaseCommand.ts    # Abstract base for all commands
│   ├── ShowBuild.ts
│   ├── SmartShow.ts      # Smart reference parser/router
│   └── ...
├── formatters/           # Multi-format output (plain/JSON/Alfred)
│   ├── FormatterFactory.ts
│   └── {entity}/         # Per-entity formatters
├── services/             # Business logic
│   ├── BuildkiteClient.ts    # GraphQL client
│   ├── BuildkiteRestClient.ts
│   ├── CacheManager.ts
│   └── logger.ts
├── ui/                   # Visual components
│   ├── theme.ts          # Icons, colors (modify here for UI changes)
│   └── ...
├── utils/                # Utilities
│   └── parseBuildkiteReference.ts
├── graphql/
│   ├── queries.ts
│   └── fragments/        # Reusable GraphQL fragments
└── types/
```

## Key Architectural Patterns

### Commands (Command Pattern)
All commands extend `BaseCommand`:
- Implement `execute(options): Promise<number>` returning exit codes
- Set `static requiresToken = true/false`
- Use `this.getClient()` and `this.getRestClient()` for API access

### Formatters (Strategy Pattern)
Each entity has formatters for plain/JSON/Alfred:
- Located in `src/formatters/{entity}/`
- Use `FormatterFactory` to create the right formatter
- No side effects - return string output

### UI Theme
All icons, colors, and visual elements go through `src/ui/theme.ts`:
- Use `getStateIcon()` for build/job states
- Respect `NO_COLOR`, `BKTIDE_ASCII`, `BKTIDE_EMOJI` env vars
- Color palette: blue (passed), orange (failed), yellow (warning)

**When modifying CLI output**, consult `docs/developer/ui-design-system.md` for:
- Semantic color conventions (`SEMANTIC_COLORS`)
- Tip/hint formatting patterns (`formatTips`, `TipStyle`)
- Icon system with accessibility fallbacks
- Visual hierarchy guidelines

### GraphQL Fragments
Reusable fragments in `src/graphql/fragments/`:
- `JOB_SUMMARY_FIELDS` - minimal job info
- `JOB_DETAIL_FIELDS` - full job info
- Run `npm run codegen` after modifying queries

## Development Workflow

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run dev -- <cmd> # Run with ts-node
bin/bktide <cmd>     # Run compiled version
```

### Adding a New Command
1. Create `src/commands/MyCommand.ts` extending `BaseCommand`
2. Export from `src/commands/index.ts`
3. Wire up in `src/index.ts`
4. Create formatters if needed

### Adding a GraphQL Query
1. Add query to `src/graphql/queries.ts`
2. Run `npm run codegen` to generate types
3. Prefer HTML fields (`bodyHtml`) for rich content

## Testing

```bash
npm test                      # Run all tests
npm run test:watch            # Watch mode
npm run test:coverage         # Coverage report
npm run test:extract-patterns # Extract patterns from real data
```

### Pattern-Based Mocking
Tests use realistic patterns extracted from real Buildkite data:
- Patterns in `test/fixtures/data-patterns.json` (safe to commit)
- MSW intercepts network requests
- Never commit raw API recordings or real user data

## Code Conventions

### TypeScript
- Strict mode enabled
- No `any` without explicit reasoning
- ES module imports (`import`), never `require`

### Error Handling
- Specific, actionable error messages
- Include context and suggestions
- Debug info available with `--debug` flag

### Output
- Always go through formatters, never `console.log`
- Use `logger.debug()` for debugging
- Respect output format preference (plain/JSON/Alfred)

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point, command registration |
| `src/commands/BaseCommand.ts` | Common command logic |
| `src/ui/theme.ts` | Icons, colors, visual elements |
| `src/formatters/FormatterFactory.ts` | Format selection |
| `src/graphql/fragments/jobs.ts` | Job field definitions |

## Important Conventions

1. **Exit Codes**: 0 (success), 1 (failure)
2. **Build References**: Support multiple formats (org/pipeline/number, URL, hash)
3. **Caching**: Use existing CacheManager, don't implement custom caching
4. **Job Classification**: Use `softFailed` field for soft failures (yellow triangle)
5. **Accessibility**: Always provide text fallbacks for icons

## Documentation Structure

- `docs/user/` - End-user guides
- `docs/developer/` - Contributor guides
- `docs/reference/` - Changelogs, process docs
- `docs/retrospective/` - Real-world feedback and learnings
- `docs/plans/` - Design documents (read before implementing features)

## Common Debugging

```bash
# Debug API issues
bin/bktide builds --org my-org --debug --no-cache

# Check logs
cat ~/.local/state/bktide/logs/cli.log | jq

# View recent errors
cat ~/.local/state/bktide/logs/cli.log | grep -v '"level":30' | jq
```

## Design Documents

Before implementing major features, check `docs/plans/` for existing designs:
- `smart-reference-*.md` - URL and reference parsing
- `snapshot-command-design.md` - Build snapshot feature
- `soft-failure-support-design.md` - Soft failure handling

These documents contain architectural decisions, implementation details, and testing strategies.

## Learnings from Real Usage

From `docs/retrospective/`:
- **Discoverability matters**: Document commands prominently, include in `--help`
- **Output structure**: Document snapshot/output formats for programmatic use
- **AI agents**: Benefit from explicit patterns and examples in docs

## Git Workflow

- Main branch: `main`
- Feature branches: `feature/description`
- Run tests before committing
- Update relevant docs when adding features
