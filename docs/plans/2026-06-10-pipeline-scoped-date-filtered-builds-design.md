# Pipeline-scoped, date-filtered `builds`: Design

**Date:** 2026-06-10
**Status:** Approved, pending implementation plan

## Problem

`bktide builds` is hardwired to list *the current user's* builds.
`ListBuilds.execute()` always injects `creator: userId` into the request and
calls the org-wide `getBuilds()` endpoint. The `--pipeline` flag only filters
within the current user's builds.

This makes a common, legitimate read-only investigation impossible: "list the
builds of pipeline X around date Y." Scheduled builds, bot-triggered builds, and
builds created by other people are invisible, because none of them were created
by the current user. There is no way to discover a build by pipeline plus date.

(Context: hit while tracing AIDEV-583. Needed to find which build of the
scheduled `audit-runner-restore-from-snapshot` pipeline created an orphaned RDS
cluster around 2025-10-22. No bktide path could list that pipeline's builds.)

The REST client already has `getPipelineBuilds()`, which hits the correct
`/organizations/{org}/pipelines/{pipeline}/builds` endpoint with no `creator`
param. But `ListBuilds` never calls it.

## Goal

Let `bktide builds <org>/<pipeline>` list a pipeline's builds from *any* creator,
within an optional date window, without changing the existing "my builds"
default for callers who don't specify a pipeline.

## Behavior

| Invocation | Result |
|---|---|
| `bktide builds` (no pipeline) | **Unchanged.** Current user's builds across their orgs |
| `bktide builds gusto/audit-runner-restore-from-snapshot` | **New.** ALL builds for that pipeline, any creator |
| `... --created-from 2025-10-20 --created-to 2025-10-23` | **New.** Same, filtered to the date window |
| `bktide builds gusto/foo --mine` | Pipeline builds scoped back to the current user (escape hatch) |

### Routing rule

In `ListBuilds.execute()`:

- A pipeline is **resolved** (via the `[reference]` argument or `--pipeline`) AND
  `--mine` is NOT set: route to `getPipelineBuilds(org, pipeline, {...})` with no
  `creator` param.
- Otherwise: today's `getBuilds(org, { creator: userId, ... })`.

When a pipeline is given without an org, the existing org-discovery loop still
runs; each org's pipeline endpoint is queried (slugs not present in an org return
empty or 404 and are skipped, same as today's per-org error tolerance).

### Date input

New options `--created-from <date>` and `--created-to <date>`.

- Accept `YYYY-MM-DD` or full ISO 8601.
- Normalize to RFC3339 before sending (Buildkite's API expects RFC3339), passed
  through as `created_from` and `created_to` query params.
- Unparseable input: exit 1 with an actionable message, consistent with the
  existing `--state` validation in `ListBuilds`.

Date filtering applies in both scoping modes (the REST `builds` and
`pipelines/{slug}/builds` endpoints both accept `created_from` and `created_to`).

### Pagination

Follows the established codebase convention: single page per `--count`, manual
`--page`. No auto-pagination (the unused `parseLinkHeader` in
`src/utils/pagination.ts` stays as-is).

To close the silent-truncation trap for the date-window use case: after fetch, if
a date range is active AND the returned page is full (`length === per_page`),
emit a `reporter.warning(...)` that more builds may exist in the window and
suggest a higher `--count`.

## Changes

All in `repos/bktide`.

1. **`src/index.ts`**: add `--created-from <date>`, `--created-to <date>`,
   `--mine` to the `builds` command. Update its description (drop "for the current
   user" to reflect the dual behavior).
2. **`src/services/BuildkiteRestClient.ts`**: add `created_from?` and
   `created_to?` to the param type of both `getBuilds` and `getPipelineBuilds`.
   The private `get()` already forwards arbitrary params, so this is type surface
   only.
3. **`src/commands/ListBuilds.ts`**: date validation and normalization; branch
   between pipeline-scoped and creator-scoped fetch; thread date params; the
   full-page-plus-date-range truncation warning.
4. **`src/formatters/builds/`**: adjust only the empty-state message so it does
   not say "No builds found for `<userName>`" when in pipeline-scoped mode.

## Testing

bktide uses Vitest plus MSW pattern-based mocking. Add cases:

- pipeline reference: request hits the `pipelines/{slug}/builds` endpoint with no
  `creator` param
- `--created-from` and `--created-to`: `created_from` and `created_to` present in
  the request
- full page returned plus date range active: truncation warning emitted
- `--mine` with a pipeline: falls back to creator-scoped (`getBuilds` with
  `creator`)
- unparseable date: exit 1
- no pipeline (existing behavior): unchanged, still creator-scoped

## Out of scope (YAGNI)

- Auto-pagination across pages (parser stays dead for now; can be a clean
  follow-up since the infra exists).
- `finished_from` and `finished_to` filters.
- The buildkite-plugin hook allowlist and the Buildkite MCP server registration
  (the other two options in bean gt-lhji). This design covers the "improve
  bktide" path only.
