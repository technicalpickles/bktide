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
Status: Completed

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
  - `orgs --format plain` shows `✓ Organizations retrieved` and org list.
  - `viewer --format plain` shows `✓ Viewer info loaded` and viewer details.
  - `builds --count 3 --format plain` shows `✓ Builds retrieved` and build list.
  - `token --check` works unchanged; reporter remains silent for token command.
  - `boom --type basic --format plain` behavior unchanged.

Notes
- Planning doc updated with Phase 1 application checklist and a testing matrix covering confirmations across commands and formats.
- Reporter remains silent for `json` and `alfred` formats by design.

#### Phase 2 – Table Utility Adoption
Status: Completed

Applied so far
- Plain pipelines output now uses aligned columns (NAME, SLUG) when a single org is targeted; (ORGANIZATION, NAME, SLUG) when multiple orgs.
- Plain builds output now uses a tabular summary (PIPELINE, NUMBER, STATE, BRANCH) for improved scan-ability.
- Plain organizations output now uses a NAME/SLUG table.

Validation
- `bin/bktide pipelines --format plain | head -n 20` shows aligned headings and rows.
- `bin/bktide builds --count 5 --format plain | head -n 30` shows aligned tabular summary.

Next
- `viewer`: keep as-is; table not beneficial for 2–3 labeled lines.
- `annotations`: keep as-is; content is multi-line text bodies, tables not appropriate.
- Monitor wrapping for extremely long names; consider truncation/ellipsis if needed.

#### Phase 3 – TTY-Gated Spinners
Status: Completed

Applied so far
- Added `src/ui/spinner.ts` (TTY-only, silent for json/alfred).
- Integrated spinner into `pipelines`, `builds`, `orgs`, `viewer`, and `annotations` for long-running fetches.
- Spinner clears on completion (no residual frames); Reporter prints the single success line.

Validation
- Verified spinners are visible only in TTY and do not emit in json/alfred or when piped.

#### Phase 4 – Cleanup & Consistency
Status: Completed

Applied so far
- Centralized table rendering via `src/ui/table.ts`; refactored plain formatters (pipelines/builds/orgs).
- Removed inline ANSI from error paths; plain error formatter uses theme; CLI error helper prints neutral text.
- Adopted error stream routing: plain errors → stderr; json/alfred errors → stdout.

Validation
- `boom --type basic --format plain 1>out 2>err` leaves stdout empty and writes error to stderr.
- `boom --type basic --format json 1>out 2>err` writes JSON to stdout only; stderr empty.

Decisions
- Keep `ManageToken` without reporter/spinner to avoid UX duplication.


