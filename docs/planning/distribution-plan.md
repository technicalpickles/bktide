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


