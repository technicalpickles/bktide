## Doctor diagnostics plan (Track A)

Provide a fast way to verify environment readiness from both CLI and Alfred.

### Scope
- Node runtime: resolve and run Node, report version/path, enforce minimum (>= 18).
- Keychain module: load `@napi-rs/keyring`, instantiate `Entry('bktide','default')`, try a read (`getPassword()`), catch load/permission errors.
- Token presence (optional): `CredentialManager.getToken()`; report present/absent.
- API access (optional): if token exists, call GraphQL (`getViewer`) and list orgs; report success/error.

### CLI command
- New command `doctor` in `src/commands/Doctor.ts` (extends `BaseCommand`).
- Flags: `--check-token`, `--check-api`, `--format plain|json|alfred`.
- Token not required unless `--check-api` is used.
- Add formatters under `src/formatters/doctor/`:
  - `PlainTextFormatter.ts`, `JsonFormatter.ts`, `AlfredFormatter.ts` (match existing formatter patterns).

### Alfred integration
- Add `bin/alfred-doctor` (Script Filter entrypoint):
  - Read Alfred Workflow Configuration variables: `NODE_BIN` (default `node`), `EXTRA_PATH` (optional PATH prepend).
  - If Node execution fails, emit Alfred JSON with a single error item and remediation (set `NODE_BIN`/`EXTRA_PATH`).
  - Else exec: `"$NODE_BIN" "$workflow_dir/dist/index.js" doctor --format alfred [--check-token] [--check-api]`.
- Use same PATH/Node logic in `bin/alfred-entrypoint` and `bin/alfred-doctor` for consistency.

### Workflow Configuration (Alfred)
- Define user-editable variables:
  - `NODE_BIN` (text; default `node`)
  - `EXTRA_PATH` (text; optional; colon-separated)
- Prefer these over external `.env` files.

### Packaging & artifacts
- Include `bin/alfred-doctor` in the `.alfredworkflow` bundle alongside:
  - `bin/alfred-entrypoint`, `info.plist`, icons, `dist/**`, prod `node_modules/**`.
- Document the Doctor keyword in the workflow About/README.

### Implementation steps
1) CLI
   - Create `src/commands/Doctor.ts`; wire command in `src/index.ts`.
   - Implement checks; capture results with clear status and messages.
   - Implement doctor formatters in `src/formatters/doctor/`.
2) Alfred
   - Create `bin/alfred-doctor` with config-variable handling and fallback messaging when Node is missing.
   - Add Script Filter in the workflow bound to `bin/alfred-doctor`.
3) Config
   - Add `NODE_BIN`, `EXTRA_PATH` variables in Workflow Configuration UI.
4) Packaging
   - Add `bin/alfred-doctor` to packaging script and artifact list.

### Validation
- CLI: `node dist/index.js doctor` with/without token; `--check-api` with valid/invalid token.
- Alfred: run the Doctor keyword on systems where Node is missing (expect guidance) and where `@napi-rs/keyring` is absent/mismatched (expect clear error).

### Risks
- Keychain read may prompt permissions; acceptable for diagnostics.
- Native module arch mismatches; surfaced clearly by Doctor and addressed by packaging.

### Release notes
- Announce `doctor` command and Alfred “Doctor” keyword.
- Mention Workflow Configuration variables `NODE_BIN` and `EXTRA_PATH` for setup.


