# Design: Build Creation Commands (`create` + `rebuild`)

**Date:** 2026-05-28
**Bean:** gt-bgog
**Status:** Ready for implementation

## Overview

Add two new subcommands under `bktide build` that write to the Buildkite API:

- `bktide build create [<org>/<pipeline>]` — start a new build. Auto-detects pipeline, commit, branch, and message from the local git checkout when omitted; flags override.
- `bktide build rebuild <build-ref>` — re-run an existing build with its original parameters. Hits `PUT /builds/{n}/rebuild` straight.

Both subcommands accept `--watch` to hand the newly-created build to the existing `BuildPoller` and stream job state changes until the build hits a terminal state.

The existing `bktide build <ref>` show form continues to work unchanged via commander's default-subcommand support. An explicit `bktide build show <ref>` is also added for symmetry.

## Motivation

bktide has no write capability today. The bean came up when retriggering a cancelled `hawaiian-ice` build required falling back to raw API calls. The original CLI is now strong at reading builds (`bktide build`, `bktide snapshot`, etc.); these two subcommands close the create-and-monitor loop without leaving the terminal.

## Command Surface Rationale

The new verbs are nested under `bktide build` rather than added as top-level commands. Reasoning:

- A top-level `bktide create` is semantically ambiguous (create what — a pipeline? an agent? a token?). Nested, the noun is in the path.
- Both new verbs operate on builds, so they belong together. `bktide build --help` becomes the canonical place to discover build operations.
- This matches the existing `bktide artifacts list / download` pattern.
- Commander's `isDefault: true` subcommand support preserves the existing `bktide build <ref>` show shorthand without changes.

## CLI Surface

```
bktide build <ref>                          # existing show (default action), unchanged
bktide build show <ref>                     # new: explicit form of show

bktide build create [<org>/<pipeline>] [options]
  -c, --commit <sha>            Commit SHA (default: git HEAD)
  -b, --branch <branch>         Branch (default: current git branch)
  -m, --message <msg>           Build message (default: HEAD commit subject)
  -e, --env <KEY=VAL>           Env var (repeatable)
  -w, --watch                   Watch new build until completion
      --timeout <minutes>       Watch timeout (default: 30)
      --poll-interval <secs>    Watch poll interval (default: 5)
      --format <fmt>            plain | json | alfred (default: plain)

bktide build rebuild <build-ref> [options]
  <build-ref>                   org/pipeline/number OR full Buildkite URL
  -w, --watch                   Watch new build until completion
      --timeout <minutes>       Watch timeout (default: 30)
      --poll-interval <secs>    Watch poll interval (default: 5)
      --format <fmt>            plain | json | alfred (default: plain)
```

### Behavior

- `<org>/<pipeline>` on `build create` is optional. When omitted, auto-detect using the same path as `snapshot`:
  - `getGitContext()` for current branch + `origin` remote URL
  - `parseGitRemoteUrl()` + `generateRepoCandidates()` for URL variants
  - Query Buildkite for pipelines whose `repository` field matches a candidate
  - Exactly one match → use it. Zero matches → error with the parsed candidates. Two or more → print the list of `org/slug` matches and exit 1.
- Flags always win over git auto-detection.
- Without `--watch`, exit 0 as soon as the build is queued.
- With `--watch`, exit 0 only if the build's terminal state is `passed`; otherwise exit 1.

## Architecture

### New REST client methods

`src/services/BuildkiteRestClient.ts` gains:

```typescript
private async post<T>(endpoint: string, body: unknown): Promise<T>
private async put<T>(endpoint: string, body?: unknown): Promise<T>

public async createBuild(
  org: string,
  pipeline: string,
  payload: CreateBuildPayload
): Promise<BuildkiteRestBuild>

public async rebuildBuild(
  org: string,
  pipeline: string,
  buildNumber: number
): Promise<BuildkiteRestBuild>
```

`post`/`put` mirror the existing `get<T>()` helper: same auth, same rate-limit header parsing, same error categorization. Writes never cache and never read cache. Error handling reuses `isAuthenticationError`.

Types:

```typescript
interface CreateBuildPayload {
  commit: string;
  branch: string;
  message?: string;
  env?: Record<string, string>;
}

interface BuildkiteBuildResponse {
  number: number;
  state: string;
  web_url: string;
  pipeline: { slug: string };
  // additional fields exist on the wire; we type only what we consume
}
```

The Buildkite REST shape allows more fields on the request (`meta_data`, `clean_checkout`, `pull_request_*`, `author`). We model only what v1 uses. Adding more later is additive. Existing client methods like `getBuild()` return `any`; we don't retro-type them here, but new write methods use the narrow `BuildkiteBuildResponse` type.

### Restructure existing `bktide build` registration

`src/index.ts` currently registers `bktide build <ref>` directly. Refactor to a command group:

```js
const buildCmd = program.command('build').description('Build operations');

buildCmd
  .command('show <ref>', { isDefault: true })
  .description('Show details for a specific build')
  // ...existing flags from current `bktide build`
  .action(createCommandHandler(ShowBuild));

buildCmd
  .command('create [pipeline-ref]')
  .description('Create a new build')
  // ...flags
  .action(createCommandHandler(CreateBuild));

buildCmd
  .command('rebuild <build-ref>')
  .description('Rebuild an existing build with the same parameters')
  // ...flags
  .action(createCommandHandler(RebuildBuild));
```

`isDefault: true` on `show` makes `bktide build org/pipeline/123` route to `show` automatically when no subcommand is named. Existing user invocations and scripts continue to work without changes.

### New command: `CreateBuild`

`src/commands/CreateBuild.ts`. Extends `BaseCommand`, `static requiresToken = true`.

Responsibilities:

1. Resolve `<org>/<pipeline>` — explicit arg, or git auto-detect via `getGitContext` + `parseGitRemoteUrl` + `generateRepoCandidates` + a new client helper `getPipelinesForRepo(org, candidates)` (variant of `getPipelineBuildsForRepo` that doesn't require an existing build).
2. Resolve commit/branch/message — flags first, fall back to `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`, `git log -1 --format=%s`. If still unresolved, error specifying which flags are required.
3. Parse `--env KEY=VAL` entries into a `Record<string, string>`. Split on the first `=` only.
4. Call `restClient.createBuild(org, pipeline, payload)`.
5. Format the response (plain/JSON/Alfred) and print.
6. If `--watch`, instantiate `BuildPoller` with the new `{org, pipeline, number}` and call `.watch()`. Exit based on terminal state.

### New command: `RebuildBuild`

`src/commands/RebuildBuild.ts`. Extends `BaseCommand`, `static requiresToken = true`.

Responsibilities:

1. Parse the build ref via existing `parseBuildRef`.
2. Call `restClient.rebuildBuild(org, pipeline, number)`.
3. Format and print the new build.
4. If `--watch`, hand to `BuildPoller` like `CreateBuild`.

### New helper: git context for build creation

`src/utils/gitContext.ts` already exposes `getGitContext()`. Two new pure helpers in the same file (or `src/utils/gitBuildContext.ts` if it grows):

```typescript
export function getHeadCommit(): string         // git rev-parse HEAD
export function getHeadCommitMessage(): string  // git log -1 --format=%s
```

Each throws with an actionable message on failure ("not a git repository", "no commits yet"), matching the style of existing `getGitContext`.

### Formatters

`src/formatters/build-create/` with:

- `PlainTextFormatter.ts` — one-line "Created build #4567" plus the web URL. With `--watch`, the poller drives output and this prints nothing.
- `JsonFormatter.ts` — the raw REST build payload (so scripts can pipe into `jq`).
- `AlfredFormatter.ts` — single Alfred item linking to the new build URL.
- `index.ts` — exports.

`FormatterFactory` gains a new entity registration.

### Wiring in `src/index.ts`

See "Restructure existing `bktide build` registration" above. The `build` top-level command becomes a group containing `show` (default), `create`, and `rebuild` subcommands.

The completion-generation script (`bktide completions`) and any docs that enumerate commands need a pass to pick up the new subcommands. Shell completions are generated at runtime from commander metadata, so this should require no manual list edits.

## Data Flow

### `bktide build create`

```
parse args
  ↓
resolve org/pipeline
  ├─ arg provided → use it
  └─ arg omitted
       ↓
       getGitContext() + parseGitRemoteUrl() + generateRepoCandidates()
       ↓
       restClient.getPipelinesForRepo(org, candidates) [new]
       ↓
       1 match → use; 0 → error; 2+ → list + exit 1
  ↓
resolve commit / branch / message
  ├─ flags win
  └─ git rev-parse HEAD / --abbrev-ref / log -1
  ↓
parse --env KEY=VAL entries
  ↓
restClient.createBuild(org, pipeline, payload)
  ↓
format + print
  ↓
if --watch
  → BuildPoller.watch({org, pipeline, number: response.number})
  → exit 0/1 from terminal state
else
  → exit 0
```

### `bktide build rebuild`

```
parse <build-ref> via parseBuildRef
  ↓
restClient.rebuildBuild(org, pipeline, number)
  ↓
format + print
  ↓
if --watch → same poller handoff
```

## Error Handling

- **Not in a git repo, pipeline auto-detect requested** — `Not a git repository. Provide <org>/<pipeline> as an argument to 'bktide build create'.`
- **Detached HEAD, branch auto-detect requested** — `Detached HEAD. Pass --branch or provide a ref explicitly.`
- **Git context found but no Buildkite pipeline matches the remote** — print the parsed remote and candidates, exit 1.
- **Multiple Buildkite pipelines match the remote** — print `org/slug` for each match and exit 1. User can re-run with explicit `<org>/<pipeline>`.
- **API 401 / 403 on create or rebuild** — reuse `isAuthenticationError`. Surface required scopes (likely `write_builds`) via the existing scope-detection plumbing from PR #28.
- **API 404 on rebuild** — `Build not found: <ref>`.
- **API 422 (Buildkite validation)** — surface the `errors[]` array from the response body verbatim — Buildkite's messages are usually actionable (e.g., "commit can't be blank", "branch is invalid").
- **Malformed `--env`** — `Invalid --env entry: "<raw>". Use KEY=VAL.` Fail fast before the API call.
- **Watch errors after the build was created** — the build still exists. Print the new build URL + the watch error separately, exit 1. Do not imply the build itself failed.

## Testing

### Unit tests

- `BuildkiteRestClient.createBuild` — MSW mocks for 200 (build returned), 401 (auth error path), 422 (validation errors surfaced), 5xx.
- `BuildkiteRestClient.rebuildBuild` — MSW mocks for 200, 404, 403.
- `BuildkiteRestClient.post` / `put` generic helpers — cache bypass, rate-limit headers parsed.
- Env parsing — `KEY=VAL`, `KEY=` (empty value allowed), `=VAL` (error), `KEY` (error), `KEY=A=B=C` (split on first `=`, value is `A=B=C`).
- Git helper additions — mocked `execSync` cases for clean repo, no commits, not a git repo.

### Command-level tests

- `CreateBuild` — explicit `<org>/<pipeline>`, git auto-detect happy path, ambiguous-pipeline bail, no-pipeline-match bail, flag overrides, env failure, watch handoff.
- `RebuildBuild` — URL parsing, `org/pipeline/number` parsing, REST call, watch handoff, error paths.

### Watch integration

`BuildPoller` is already covered by existing tests. New tests verify only the handoff: `CreateBuild` / `RebuildBuild` invoke `poller.watch()` with the correct buildRef constructed from the API response. Use a stub `BuildPoller`.

### Fixtures

No new MSW recordings. Synthesize create/rebuild responses from the existing build fixture shape in `test/fixtures/data-patterns.json`.

## Out of Scope (v1)

- `--meta-data` flag (Buildkite supports it; we don't expose it yet).
- `--clean-checkout` flag.
- Author / pull-request fields on `build create`.
- Confirmation prompts before creating builds. bktide is a power-user CLI; no other command prompts.
- `--rebuild-with-overrides` semantics. If you need to change commit/branch/message, use `bktide build create`.

## Exit Codes

| Scenario                                                              | Code |
|-----------------------------------------------------------------------|------|
| Build created (or rebuilt), no `--watch`                              | 0    |
| Build created (or rebuilt), `--watch`, terminal state `passed`        | 0    |
| Build created (or rebuilt), `--watch`, terminal state non-`passed`    | 1    |
| Build created (or rebuilt), `--watch` errored (build still exists)    | 1    |
| Create / rebuild API call failed                                      | 1    |
| Ambiguous pipeline auto-detect                                        | 1    |
| Missing git context when auto-detection was needed                    | 1    |
| Malformed `--env` entry                                               | 1    |
