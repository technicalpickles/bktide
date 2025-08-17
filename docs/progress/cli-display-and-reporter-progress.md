### CLI Display & Reporter – Progress Log

This document tracks changes, deferrals, and next actions while implementing the plan in `docs/planning/cli-display-and-reporter-plan.md`.

#### Phase 0 – Baseline UX & Safety
Status: Completed (with deferral)

Done
- Enabled Commander suggestions for mistyped commands via `program.showSuggestionAfterError()`.
- Added global `--color <mode>` option with `auto|always|never` and environment handling for `NO_COLOR`.
- Built and validated TypeScript compilation.

Deferred
- Change to error routing (plain → stderr). We decided to keep current error handling unchanged for now.

Notes
- `--color` flag is plumbed; actual color usage will be introduced with theme/reporter in Phase 1.

#### Phase 1 – Theme and Reporter
Status: In Progress

Planned
- Add `src/ui/theme.ts` exporting `COLORS` and `SYMBOLS` with TTY-aware color helpers.
- Add `src/ui/reporter.ts` providing `info/success/warn/error` and `table(rows)` utilities, guarded for `json|alfred`.
- Minimal integration: use reporter for a single success confirmation in `pipelines` command when `--format plain`.

Applied so far
- Added `theme.ts` and `reporter.ts`.
- Integrated reporter confirmations into: `pipelines`, `orgs`, `viewer`, `builds`, `annotations` (plain only).
- Verified via `bin/bktide`:
  - `--help` shows `--color` and suggestions enabled.
  - `pipelines --format plain` shows `✓ Pipelines retrieved` and data output.
  - `token --check` works unchanged; reporter remains silent for token command.
  - `boom --type basic --format plain` behavior unchanged.

Out of Scope (Phase 1)
- Spinners and broad retrofits across all commands (Phase 3).
- Rewriting plain formatters; only optional, minimal adoption of `table()` if trivial.

#### Phase 2 – Table Utility Adoption
Status: Not Started

Planned
- Use `reporter.table()` to align columns in `builds` and `pipelines` plain outputs.

#### Phase 3 – TTY-Gated Spinners
Status: Not Started

Planned
- Add `src/ui/spinner.ts` and use on long-running operations, no-op for `json|alfred` and non-TTY.

#### Open Questions / Decisions
- Error routing to stderr will be reconsidered after Phase 1 integration.
- Scope of table integration per formatter vs per command (leaning per command for listings).


