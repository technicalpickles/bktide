## Distribution plan for Alfred + Node.js CLI

This plan documents how to distribute the Alfred workflow that wraps the Node.js-based `bktide` CLI. It prioritizes a simple user experience while keeping development friction low.

### Goals
- Keep install friction minimal for Alfred users.
- Make builds reproducible with locked dependencies.
- Allow advanced users to customize PATH/Node resolution without editing the workflow bundle.
- Keep the codebase GraphQL-first and TypeScript with strict settings.

### Constraints
- Alfred workflows are file bundles; shipping extra files increases size but is acceptable.
- Node is not guaranteed to be installed on end-user machines.
- `@napi-rs/keyring` is a native dependency; if bundling, handle appropriately.

### Approaches considered
- Track A (lightweight default): Compile to a single JS entry (or current `dist/index.js`), ship compiled output plus runtime deps, and call `node` from PATH. Provide an opt-in env file to control PATH/NODE_BIN.
- Track B (bundled Node, optional): Package the CLI with `pkg` into a single macOS binary, codesign/notarize, and call the binary from the workflow. Best UX but more release overhead.

---

## Track A: Single JS + external Node (default)

High-level: Build `dist/index.js` (or a single-bundle JS), include `node_modules` prod deps if needed, and have `bin/alfred-entrypoint` call `node` from PATH or a user-defined `NODE_BIN` from an env file.

### Step 1: Build output
1. Keep current `tsc` output (`npm run build`) producing `dist/index.js`.
2. Optional: Switch to a single-file JS bundle using esbuild (only if desired):
   - Add devDependency: `esbuild`.
   - Add script:
     ```bash
     npx esbuild src/index.ts \
       --bundle --platform=node --format=esm \
       --outfile=dist/index.js \
       --external:@napi-rs/keyring
     ```
   - Note: Native deps like `@napi-rs/keyring` must remain external and be available at runtime.

Validation:
- Run `npm run build`.
- Run `npm run start -- viewer --format plain`.

### Step 2: Alfred entrypoint
1. Use `bin/alfred-entrypoint` to:
   - Avoid system-specific PATH changes.
   - Optionally source an env file for PATH/NODE_BIN overrides:
     - `$XDG_CONFIG_HOME/bktide/env` (or `~/.config/bktide/env`)
     - Fallback: `./.env` in the workflow dir
   - Default to `NODE_BIN=node` if not set.
2. Ensure logging to `$HOME/.local/state/bktide/logs/alfred.log`.

Status: Implemented.

Validation:
- `npm run build` then manual call:
  ```bash
  bin/alfred-entrypoint viewer
  ```
- Create `~/.config/bktide/env` with custom PATH/NODE_BIN and verify it takes effect.

### Step 3: Runtime dependencies
1. If using plain `tsc`, include `node_modules` prod dependencies inside the workflow bundle.
2. If using esbuild, most JS deps are bundled; keep native or externalized modules present:
   - Make sure `node_modules/@napi-rs/keyring` binaries are available at runtime.

Validation:
- Move the built workflow to a temp directory, run via `bin/alfred-entrypoint`, and confirm it works offline from the repo.

### Step 4: Workflow packaging
1. Prepare a packaging script (future): `scripts/package-workflow.sh` to assemble:
   - `info.plist`, `icon.png`, `bin/alfred-entrypoint`, `dist/**`, and required `node_modules`.
   - Produce `bktide.alfredworkflow`.
2. Ensure all paths in the workflow are relative.

Validation:
- Import the `.alfredworkflow` into Alfred and test with typical commands (e.g., `bktide viewer`, `bktide pipelines`, `bktide builds`).

### Step 5: Documentation updates
1. In `docs/` and the workflow About pane, document:
   - Node requirement (if not bundled), recommended versions.
   - Env file support and sample content:
     ```bash
     # ~/.config/bktide/env
     export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
     export NODE_BIN="/opt/homebrew/bin/node"
     ```
   - Troubleshooting tips if Node is missing.

Validation:
- Fresh user can install and follow docs without external assistance.

### Step 6: Testing matrix
- macOS: last two releases.
- Alfred: current stable.
- With Node installed vs. not installed.
- Env file present vs. absent.
- Token present in keychain vs. not.

Validation:
- Execute smoke tests for `viewer`, `orgs`, `pipelines`, `builds`, `annotations`.

### Step 7: Release process
1. CI jobs:
   - `npm ci` (respect `package-lock.json`), `npm run build`.
   - Package `.alfredworkflow` artifact (see Step 4).
2. GitHub Release with `.alfredworkflow` and changelog.
3. Optional: checksums for integrity.

Validation:
- Download the release artifact and import into Alfred successfully.

### Risks and mitigations
- Node not installed: Document requirement, provide env file support for custom `NODE_BIN`.
- Native deps when bundling JS: Keep native modules external and included in the bundle.
- Large workflow size: Keep dependencies lean; audit regularly.

### Distributed artifacts (GitHub Releases)

Primary artifact: `.alfredworkflow` bundle
- Filename: `bktide-workflow-${version}.alfredworkflow`
- Contents (minimum):
  - `info.plist` (Alfred workflow metadata)
  - `icon.png` and `icons/` (state icons)
  - `bin/alfred-entrypoint` (entry script; sources env file if present)
  - `bin/alfred-doctor` (Script Filter entry for diagnostics)
  - `dist/index.js` (compiled CLI entry)
  - `dist/**` (additional compiled files, if not single-file bundle)
  - `node_modules/` (production dependencies only; include any native binaries like `@napi-rs/keyring`)
  - `README.md` (brief usage + troubleshooting), optional
  - `.env.example` (optional example for PATH/NODE_BIN overrides)

Optional secondary artifacts:
- `bktide-workflow-${version}.alfredworkflow.sha256` (checksum)
- `CHANGELOG.md` excerpt in Release notes

Versioning:
- Use semver; tag repo with `vX.Y.Z`.
- Keep `package.json.version` in sync.
- Consider adding a workflow version in `info.plist` if desired.

Release notes should include:
- Requirements when Node is not bundled (e.g., Node 18+ on PATH).
- How to override Node path via `~/.config/bktide/env`.
- Notable changes and migration notes.

### Packaging process for Track A (proposed)

High-level: Build, stage required files, install prod deps into the staging area, and zip as `.alfredworkflow`.

Staging layout example:
```
.stage/workflow/
  info.plist
  icon.png
  icons/
  bin/alfred-entrypoint
  dist/**
  node_modules/** (prod)
  package.json
  package-lock.json
  README.md (optional)****
  .env.example (optional)
```

Suggested steps:
1. Clean and build
   - `npm ci`
   - `npm run build`
2. Create staging dir
   - `rm -rf .stage && mkdir -p .stage/workflow`
3. Copy workflow assets
   - `cp -R info.plist icon.png icons bin/alfred-entrypoint bin/alfred-doctor dist package.json package-lock.json .stage/workflow/`
4. Install production deps into staging
   - `npm ci --omit=dev --prefix .stage/workflow`
5. Package
   - `cd .stage/workflow && zip -r ../../bktide-workflow-${version}.alfredworkflow .`
6. Generate checksum (optional)
   - `shasum -a 256 bktide-workflow-${version}.alfredworkflow > bktide-workflow-${version}.alfredworkflow.sha256`
7. Upload artifact(s) to GitHub Release for tag `v${version}`.

Notes:
- Ensure all paths inside `info.plist` and scripts are relative.
- Verify native module presence for target architectures (darwin-arm64/darwin-x64). `@napi-rs/keyring` publishes prebuilt binaries; confirm they are included under `node_modules`.
- If switching to a single-file JS bundle via esbuild, keep native deps external and present in `node_modules`.

### Verification for Releases
- Import the `.alfredworkflow` into Alfred on:
  - A machine with Node installed (PATH default)
  - A machine/user profile where `~/.config/bktide/env` sets `NODE_BIN`
- Run representative commands:
  - `viewer`, `orgs`, `pipelines`, `builds`, `annotations <known-build>`
- Check log at `$HOME/.local/state/bktide/logs/alfred.log` for errors.

---

## Setup validation (Doctor)

Purpose: Provide a quick way to verify the environment is ready, both from CLI and within Alfred.

### Checks
- Node runtime: resolve binary (via `bin/alfred-doctor`), report `process.version`, `process.execPath`, enforce minimum Node version (e.g., >= 18).
- Keychain module: attempt `import('@napi-rs/keyring')`, instantiate `new Entry('bktide','default')`, and call `getPassword()`; catch load/permission errors.
- Token presence (optional `--check-token`): use `CredentialManager.getToken()`; report present/absent only.
- API access (optional `--check-api`): if a token is available, call `BuildkiteClient.getViewer()` and list orgs; report success/error reason.

### CLI command
- Add `src/commands/Doctor.ts` extending `BaseCommand` (no token required unless `--check-api`).
- Options: `--check-token`, `--check-api`, `--format plain|json|alfred`.
- Output formatters: `formatters/doctor/{PlainTextFormatter,JsonFormatter,AlfredFormatter}.ts` mirroring existing patterns.

### Alfred integration
- Add `bin/alfred-doctor` Script Filter that:
  - Applies Alfred Workflow Configuration variables if present: `EXTRA_PATH` (prepend to PATH), `NODE_BIN` (path to Node, default `node`).
  - If Node execution fails, emit Alfred JSON with a single error item describing remediation (set `NODE_BIN`/`EXTRA_PATH` in Workflow Configuration).
  - Otherwise exec: `$NODE_BIN "$workflow_dir/dist/index.js" doctor --format alfred [--check-token] [--check-api]`.

### Workflow Configuration
- Define user-editable variables in Alfred:
  - `NODE_BIN` (text; default `node`)
  - `EXTRA_PATH` (text; optional)
- Use these in both `bin/alfred-entrypoint` and `bin/alfred-doctor`.

### Packaging
- Include `bin/alfred-doctor` in the `.alfredworkflow` bundle (see artifact list and copy step above).

### Risks
- Keychain permissions may prompt on first access; acceptable for diagnostics.
- Native module arch mismatches surface as clear load errors in Doctor.

### Validation
- CLI: run `node dist/index.js doctor` with and without token; with `--check-api` using valid/invalid tokens.
- Alfred: run the Doctor keyword on systems where Node is missing (expect helpful guidance) and where `@napi-rs/keyring` is absent/mismatched (expect clear error).

---

## Track B: Bundled Node (optional, best UX)

High-level: Build a self-contained macOS binary with `pkg` and ship it within the workflow. Entry script calls the binary directly. Consider codesigning and notarization.

### Step 1: Add `pkg` build
1. Add `pkg` as a devDependency and `package.json` config for targets (e.g., `node18-macos-x64`, `node18-macos-arm64`).
2. Build binaries:
   ```bash
   npx pkg . --targets node18-macos-x64,node18-macos-arm64 --out-path dist/bin
   ```
3. Update workflow to call `dist/bin/bktide` directly from `alfred-entrypoint`.

Validation:
- Run the produced binary from a clean macOS user without Node installed.

### Step 2: Codesigning and notarization (recommended)
1. Codesign the binary with your Developer ID.
2. Notarize the binary with Apple to avoid Gatekeeper warnings.

Validation:
- Downloaded artifact runs without unidentified developer warnings.

### Step 3: Packaging
1. Package `.alfredworkflow` with the signed binary and assets.
2. Release via GitHub with changelog and checksums.

Risks:
- `pkg` compatibility with native deps; may need to bundle external files.
- Release complexity (signing/notarization).

---

## Rollout and rollback
- Rollout: Ship Track A first. Gather feedback. If support burden around Node is high, consider Track B.
- Rollback: Users can re-import previous `.alfredworkflow` releases.

## Follow-ups
- Add packaging script for `.alfredworkflow` (Step 4).
- Add CI to build and attach artifacts on tag pushes.
- Consider auto-update mechanism for workflows.


