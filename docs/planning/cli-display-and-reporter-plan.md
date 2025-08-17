### CLI Display, Reporter, and Theming – Implementation Plan

This plan introduces a reporter layer, centralized theming, and TTY-aware terminal behaviors while preserving the current formatter-driven architecture for machine-readable outputs.

#### Goals
- Establish a clear separation of responsibilities: formatters (data → string) vs reporter (presentation + IO).
- Improve human-readable output (colors, symbols, tables, progress, confirmations) without breaking JSON/Alfred outputs.
- Route messages to correct streams (stdout vs stderr) and add TTY-aware color control.
- Keep the change set incremental, low-risk, and well-tested.

#### Non-Goals
- No change to command semantics or API behavior.
- No breaking changes to JSON or Alfred output schemas.
- No dependency on heavy UI frameworks; keep helpers lightweight.

---****

### Current State (Summary)
- Formatters: Per-entity formatters for `build`, `pipeline`, `viewer`, `organization`, `annotation`, `error` chosen by `FormatterFactory` with `--format plain|json|alfred`.
- Printing: Commands call formatter then print via `logger.console(...)`.
- Errors: `displayCLIError()` chooses error formatter; plain paths use `logger.error`, JSON/Alfred use `logger.console`.
- Colors: Minimal ANSI in error/plain formatters; no centralized theme; `chalk` is installed but unused.
- Streams: Some errors go to logger; not consistently directed to `stderr`.
- TTY: No `--color` flag; `NO_COLOR` not respected; no spinner/progress utility.

---

### Architecture Direction
- Formatters remain responsible for rendering/serialization of result data per format.
- Reporter is introduced for presentation/IO concerns:
  - stdout/stderr routing for info/success/warn/error.
  - TTY-aware coloring and symbols for human-readable output.
  - Shared utilities: aligned tables, optional spinners, lightweight banners.
- Guardrails:
  - Reporter is effectively silent in `json` and `alfred` formats (no extra lines, no spinners, no colors).
  - Reporter is used for human-facing status and confirmations. Formatters still output the main content strings.

---

### Phased Plan

#### Phase 0 – Baseline UX & Safety (small, low-risk)
1) Add command suggestions and color control
   - Enable Commander suggestions (`program.showSuggestionAfterError()`).
   - Add `--color=auto|always|never` flag (default `auto`).
   - Respect `NO_COLOR` environment variable.
2) Error stream routing
   - Update `displayCLIError()` to print plain-formatted errors to `stderr`; keep `json`/`alfred` on `stdout`.
3) Logging safety
   - Ensure debug logs remain off the primary data stream for `json`/`alfred` outputs.

Validation
- Build: `npm run build`
- Lint: `npm run lint`
- Manual test: verify errors go to stderr; `bktide boom --type basic --format plain` vs `--format json`.

#### Phase 1 – Theme and Reporter
1) Introduce centralized theme and symbols
   - `src/ui/theme.ts`: `COLORS` (error/warn/success/info/muted), `SYMBOLS` (✖/⚠︎/✓/ℹ︎).
   - Use `chalk` only when TTY and color enabled.
2) Reporter abstraction
   - `src/ui/reporter.ts`: `info/success/warn/error` methods writing to stdout/stderr appropriately; TTY-aware colorization; guard against `json`/`alfred`.
   - `table(rows: string[][])` helper for aligned columns.
3) Integrate reporter in commands for confirmations
   - Add small success/confirmation lines for human UX in `plain` format (e.g., “✓ Pipelines retrieved”).
   - Do not print confirmations in `json` or `alfred`.

Validation
- Build + lint.
- Run: `bktide pipelines --format plain` → shows confirmation; `--format json` → no extra lines.

Application checklist (Phase 1 breadth)
- Commands to apply reporter confirmations (plain only):
  - `pipelines`: success after rendering.
  - `orgs`: success after rendering; if empty, `info("No organizations found")`.
  - `viewer`: success after rendering.
  - `builds`: success after rendering; skip additional reporter lines in error/empty guidance branches already handled by formatter.
  - `annotations`: success after rendering.
- Commands to skip for now:
  - `token`: formatter-driven UX; avoid duplicate confirmations.
  - Global validation in `preAction`: keep as-is for now.

Reporter usage rules
- Only emit reporter lines when `--format plain` and not in Alfred/JSON.
- Use `success` for positive confirmations; `info` for benign notices; reserve `warn`/`error` for later phases.
- Avoid duplicating messages already produced by formatters (e.g., empty/guidance sections).

#### Phase 2 – Table Utility Adoption
1) Adopt `reporter.table()` in plain formatters/commands for aligned output
   - `builds` and `pipelines` plain outputs get aligned columns for top-level listing views.
   - Keep JSON/Alfred unchanged.
2) Ensure wrapping/truncation is minimal and predictable (no hard wrapping that breaks copy/paste).

Validation
- Manual compare current vs new output (visual readability).
- Check non-TTY contexts (piped to file) remain uncolored and table alignment persists.

#### Phase 3 – TTY-Gated Spinners (Optional, but recommended)
1) `src/ui/spinner.ts`: lightweight wrapper that no-ops for `json`/`alfred` and non-TTY.
2) Use spinner for long operations
   - `pipelines` pagination batches; `builds` multi-org queries; key REST/GraphQL calls.
3) Spinner policy: spinner shows motion only and clears on completion; Reporter prints the single completion line (no duplicate ✓ output).

Validation
- Verify no spinner output appears in `--format json|alfred` or when `stdout`/`stderr` is not a TTY.

#### Phase 4 – Cleanup & Consistency
1) Reduce scattered ANSI in formatters
   - Route color decisions through theme where needed in `plain` format; keep `json`/`alfred` colorless.
2) Document streams and color behaviors
   - README notes: stdout for results, stderr for errors/prompts; `--color`, `NO_COLOR`, and TTY rules.
3) Add minimal unit/integration checks (where practical) for stream routing and color flags.

---

### File-by-File Changes

New
- `src/ui/theme.ts`
  - Export `COLORS`, `SYMBOLS`, and a small helper `shouldColor(format: string): boolean`.
- `src/ui/reporter.ts`
  - Class `Reporter` with methods: `info/success/warn/error/table`, TTY-aware, color-guarded, streams-correct.
- (Optional) `src/ui/spinner.ts`
  - `startSpinner(text: string, format: string)` → returns `ora` instance or no-op shim.

Updates
- `src/index.ts`
  - Add `program.showSuggestionAfterError()`.
  - Add `--color <mode>` global option with default `auto`.
  - In `preAction`, apply color mode: `auto|always|never` and respect `NO_COLOR`.
- `src/utils/cli-error-handler.ts`
  - Direct plain-formatted errors to `stderr` (`process.stderr.write`); keep `json`/`alfred` on `stdout`.
  - Ensure no extra decoration for machine formats.
- `src/services/logger.ts`
  - Confirm pretty transport isn’t used for data output; maintain debug-only pretty printing.
- `src/commands/*`
  - Instantiate `Reporter` using `options.format`.
  - Add concise success confirmations only for `plain`.
  - Use spinner helper around long-running API calls (Phase 3).
- `src/formatters/*/PlainTextFormatter.ts`
  - Optionally leverage `table()` for aligned listings (Phase 2); avoid direct ANSI—prefer theme, but keep minimal.

---

### CLI Flags & Env
- `--format plain|json|alfred` (existing) – drives formatter choice.
- `--color auto|always|never` (new)
  - `auto`: color only in TTY and when not `json|alfred`.
  - `always`: force color in `plain` (TTY or not), still no color for machine formats.
  - `never`: disable color entirely.
- `NO_COLOR` respected to disable color when present.

---

### Testing & Validation

Manual (baseline)
- `npm run build` and `npm run lint` after each phase.
- Errors to stderr:
  - `bktide boom --type basic --format plain 1>out 2>err` → `out` empty, `err` contains message.
  - `bktide boom --type basic --format json` → JSON on stdout; `err` empty.
- Suggestions:
  - `bktide pipline` → shows “Did you mean ‘pipelines’?”

Human-readable output
- `bktide pipelines --format plain` → confirmation ✓ and aligned table.
- `bktide builds --format plain` with/without `--org` → readable messages with guidance lines.

Testing matrix (Phase 1 confirmations and non-interference)
- Commands × Formats
  - `pipelines`:
    - plain: renders data + shows `✓ Pipelines retrieved`.
    - json/alfred: no extra lines; JSON schema unchanged.
  - `orgs`:
    - plain: renders data + shows `✓ Organizations retrieved`; if empty, shows `ℹ︎ No organizations found`.
    - json/alfred: no extra lines.
  - `viewer`:
    - plain: renders data + shows `✓ Viewer info loaded`.
    - json/alfred: no extra lines.
  - `builds`:
    - plain: renders data + shows `✓ Builds retrieved`; in access/empty cases, do not add extra reporter lines.
    - json/alfred: no extra lines.
  - `annotations`:
    - plain: renders data + shows `✓ Annotations retrieved`.
    - json/alfred: no extra lines.

Machine outputs unchanged
- `bktide pipelines --format json | jq .` – valid JSON, no extra lines.
- `bktide annotations <ref> --format alfred | jq .items[0]` – schema unchanged.

TTY/Color
- Pipe to file: `bktide pipelines --format plain > out.txt` – no color codes if `--color auto`.
- Force color: `bktide pipelines --format plain --color always` – colors appear in file.
- Disable: `--color never` and `NO_COLOR=1` remove colors.

Spinners (Phase 3)
- In TTY: visible spinner; success/failure updates.
- In non-TTY / `json|alfred`: no spinner lines emitted.

Performance & Stability
- Verify no material performance regression.
- Check memory and CPU are stable during large listings.

---

### Acceptance Criteria
- Errors route to stderr in `plain`; `json|alfred` errors remain on stdout.
- `--color` and `NO_COLOR` behave as described; `plain` is TTY-aware.
- Aligned tables in `plain` for `pipelines` and `builds` listings.
- Small success confirmations appear only in `plain`.
- No changes to JSON/Alfred output schemas or extra lines.
- Commander suggestions are enabled for mistyped commands.

---

### Rollout
- Phase 0 and 1 in one PR; Phase 2 and 3 can follow as separate PRs.
- Each PR includes before/after screenshots for `plain` outputs and fixtures for `json`/`alfred`.

---

### Risks & Mitigations
- Risk: Accidental decoration of machine formats → Guard reporter by format and TTY.
- Risk: Color bleed in logs → Respect `--color` and `NO_COLOR`; centralize color decisions.
- Risk: Stream misrouting → Tests explicitly check stdout vs stderr.

---

### References
- clig.dev – Stream usage and color guidelines.
- Yarn Reporter modules – Centralized presentation layer.
- Cargo/npm/gh – Colors: red error, yellow warn, green success; ✓ confirmations; aligned tables; suggestions.


