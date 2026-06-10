# Pipeline-scoped, date-filtered `builds`: Design

**Date:** 2026-06-10
**Status:** Approved, pending implementation plan

## Problem

`bktide builds` is hardwired to list *the current user's* builds.
`ListBuilds.execute()` always injects `creator: userId` into the request and
calls the org-wide REST `getBuilds()` endpoint. The `--pipeline` flag only filters
within the current user's builds.

This makes a common, legitimate read-only investigation impossible: "list the
builds of pipeline X around date Y." Scheduled builds, bot-triggered builds, and
builds created by other people are invisible, because none of them were created
by the current user. There is no way to discover a build by pipeline plus date.

(Context: hit while tracing AIDEV-583. Needed to find which build of the
scheduled `audit-runner-restore-from-snapshot` pipeline created an orphaned RDS
cluster around 2025-10-22. No bktide path could list that pipeline's builds.)

## Approach: GraphQL

Use Buildkite's GraphQL API for the pipeline-scoped path, not REST. Reasons:

1. **Repo convention.** `CLAUDE.md` says to prefer GraphQL.
2. **It is not user-scoped.** The `Pipeline.builds` connection lists all builds for
   a pipeline regardless of creator.
3. **Native date and state filtering.** `PipelineBuildsArgs` accepts `createdAtFrom`,
   `createdAtTo`, `state: [BuildStates!]`, `branch: [String!]` (confirmed in the
   generated schema). No client-side filtering needed.
4. **Accurate truncation signal.** The connection returns `pageInfo.hasNextPage`,
   so we know precisely whether more builds exist, instead of guessing from a full
   page.
5. **Richer provenance.** `Build.createdBy` exposes the trigger source (a user, a
   bot, or a scheduled trigger), which is exactly what the AIDEV-583
   investigation needed and what the `creator` REST filter was hiding.

The codebase already has most of this: a GraphQL `GET_BUILDS` query
(`src/graphql/queries.ts`) and a `BuildkiteClient.getBuilds(pipelineSlug,
organizationSlug, first)` method. Neither is wired into the `builds` command
(which reaches for the REST client instead), and the query is missing the date,
state, branch, and `createdBy` selections. The GraphQL `getBuilds` has no command
callers today, so its signature can change freely.

The creator-scoped default path (no pipeline given) stays on the existing REST
`getBuilds` with `creator: userId`. We are not rewriting that.

## Goal

Let `bktide builds <org>/<pipeline>` list a pipeline's builds from *any* creator,
within an optional date window, without changing the existing "my builds"
default for callers who don't specify a pipeline.

## Behavior

| Invocation | Result |
|---|---|
| `bktide builds` (no pipeline) | **Unchanged.** Current user's builds across their orgs (REST, creator-scoped) |
| `bktide builds gusto/audit-runner-restore-from-snapshot` | **New.** ALL builds for that pipeline, any creator (GraphQL) |
| `... --created-from 2025-10-20 --created-to 2025-10-23` | **New.** Same, filtered to the date window |
| `bktide builds gusto/foo --mine` | Pipeline builds scoped back to the current user (REST creator path, escape hatch) |

### Routing rule

In `ListBuilds.execute()`:

- A pipeline is **resolved** (via the `[reference]` argument or `--pipeline`) AND
  `--mine` is NOT set: route to the GraphQL `BuildkiteClient.getBuilds()` with no
  creator concept; map the returned nodes to the formatter's Build shape.
- Otherwise: today's REST `getBuilds(org, { creator: userId, ... })`.

When a pipeline is given without an org, the existing org-discovery loop still
runs; each org's GraphQL query is attempted (orgs without that pipeline yield no
edges and are skipped, same as today's per-org error tolerance).

### Date input

New options `--created-from <date>` and `--created-to <date>`.

- Accept `YYYY-MM-DD` or full ISO 8601.
- Normalize to RFC3339 before sending (GraphQL `DateTime` expects RFC3339), passed
  as the `createdAtFrom` and `createdAtTo` query variables.
- Unparseable input: exit 1 with an actionable message, consistent with the
  existing `--state` validation in `ListBuilds`.

Date filtering applies only in the pipeline-scoped (GraphQL) path. In the
creator-scoped REST path it is out of scope for this change (the default "my
builds" view is small and date-filtering it adds no value for the investigation
use case). If `--created-from`/`--created-to` are passed without a pipeline, exit
1 with a message directing the user to specify a pipeline.

### State filtering

The CLI `--state` value is lowercase (`passed`, `failing`, `not_run`, etc.). The
GraphQL `BuildStates` enum is the uppercase form (`PASSED`, `FAILING`,
`NOT_RUN`). The pipeline-scoped path maps the validated lowercase value to its
uppercase enum (`value.toUpperCase()`) and passes it as a single-element
`[BuildStates!]` array.

### Pagination

Single page per `--count` (mapped to GraphQL `first`), consistent with the rest
of the CLI. No auto-pagination.

Truncation signal uses the GraphQL connection's `pageInfo.hasNextPage`: when a
date range is active and `hasNextPage` is true, emit a `reporter.warn(...)` that
more builds exist in the window and suggest a higher `--count`.

## Changes

All in `repos/bktide`.

1. **`src/graphql/queries.ts`**: extend `GET_BUILDS` with `$createdAtFrom`,
   `$createdAtTo`, `$state`, `$branch` variables passed to `builds(...)`, add a
   `createdBy` selection (trigger source), and select `pageInfo.hasNextPage`.
   Regenerate types with `npm run codegen` (introspects the live Buildkite schema;
   needs a token and network, run unsandboxed).
2. **`src/services/BuildkiteClient.ts`**: change `getBuilds(pipelineSlug,
   organizationSlug, first?)` to accept an options object
   (`{ first?, createdAtFrom?, createdAtTo?, state?, branch? }`).
3. **`src/commands/ListBuilds.ts`**: add the three CLI options to the options
   interface; date validation and normalization; the "date range without
   pipeline" guard; branch between the GraphQL pipeline-scoped path and the REST
   creator-scoped path; map GraphQL nodes to the Build shape (inject the known
   pipeline slug); the `hasNextPage` truncation warning.
4. **`src/index.ts`**: register `--created-from`, `--created-to`, `--mine`; update
   the command description.
5. **`src/formatters/builds/`**: pipeline-aware empty-state message; surface
   `created_by` in the JSON formatter so programmatic consumers get the trigger
   source.

## Testing

bktide uses Vitest plus MSW pattern-based mocking; command tests spy on
`BuildkiteClient.prototype` / `BuildkiteRestClient.prototype`. Add cases:

- pipeline reference: routes to the GraphQL `BuildkiteClient.getBuilds`, REST
  `getBuilds` not called
- `--created-from` / `--created-to`: normalized RFC3339 values reach
  `createdAtFrom` / `createdAtTo`
- date range with `hasNextPage: true`: truncation warning emitted
- `--mine` with a pipeline: falls back to REST creator-scoped path
- `--created-from` without a pipeline: exit 1 with guidance
- unparseable date: exit 1
- no pipeline (existing behavior): unchanged, still REST creator-scoped
- GraphQL node mapping: nodes render in the table (pipeline slug injected, state,
  branch, number)

## Out of scope (YAGNI)

- Auto-pagination across pages (single page only; `hasNextPage` just warns).
- Date filtering on the creator-scoped (no-pipeline) REST path.
- `finished` (finishedAtFrom/To) and `metaData` filters.
- The buildkite-plugin hook allowlist and the Buildkite MCP server registration
  (the other two options in bean gt-lhji). This design covers the "improve
  bktide" path only.
