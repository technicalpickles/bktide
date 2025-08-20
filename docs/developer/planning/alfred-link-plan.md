## Alfred Link Integration Plan (Development & Distribution)

**Status**: ❌ **Not Implemented** - This plan has not been implemented yet.

This plan integrates `alfred-link` into local development and optional user installation, reducing manual linking of the workflow.

### Goals
- One-command local linking/unlinking during development.
- Optional: auto-link on global npm install for users (`npm i -g bktide`).
- Safe behavior when Alfred is not installed (scripts should not fail installs/CI).

### Overview
- Add `alfred-link` to the project and wire `package.json` scripts for:
  - Local dev: `alfred:link`, `alfred:unlink`, `alfred:relink`.
  - Optional global install UX: `postinstall` runs `alfred-link` and `preuninstall` runs `alfred-unlink`.
- `alfred-link` updates `info.plist` from `package.json` and symlinks the package into Alfred’s workflows directory.

### Prerequisites
- Alfred 5 installed and a local preferences directory (default is auto-detected by `alfred-link`).
- Package contains workflow assets: `info.plist`, icons, entry scripts (`bin/alfred-entrypoint`), and built JS (`dist/**`).

### Installation
You can add `alfred-link` either as a dependency (ensures binary exists for end users) or as a dev dependency (use with `npx` for dev only):

Option A (recommended for optional end-user auto-link):
```bash
npm install --save alfred-link
```

Option B (dev-only usage with npx):
```bash
npm install --save-dev alfred-link
```

### package.json Scripts

Local development:
```json
{
  "scripts": {
    "alfred:link": "alfred-link",
    "alfred:unlink": "alfred-unlink",
    "alfred:relink": "npm run alfred:unlink || true && npm run alfred:link"
  }
}
```

Optional global-install hooks (so `npm i -g bktide` links into Alfred automatically). The `|| true` ensures installs don’t fail on machines without Alfred:
```json
{
  "scripts": {
    "postinstall": "alfred-link || true",
    "preuninstall": "alfred-unlink || true"
  }
}
```

Notes:
- If you prefer not to add `alfred-link` as a runtime dependency, keep it in `devDependencies` and replace commands with `npx alfred-link` / `npx alfred-unlink`.
- `alfred-link` reads metadata from `package.json` (name, version, description, author, homepage) and syncs into `info.plist`.

### Development Flow
1. Build the project:
   ```bash
   npm run build
   ```
2. Link into Alfred:
   ```bash
   npm run alfred:link
   ```
3. Iterate; when updating metadata or structure, re-link:
   ```bash
   npm run alfred:relink
   ```
4. Unlink when done:
   ```bash
   npm run alfred:unlink
   ```

Verification:
- Open Alfred Preferences → Workflows and confirm the `bktide` workflow is present (symlinked).
- Trigger the workflow and verify it launches `bin/alfred-entrypoint` and runs `dist/index.js`.

### Distribution Options
- Keep shipping a `.alfredworkflow` in GitHub Releases (no change), AND optionally support npm-based installs:
  - Users can run:
    ```bash
    npm i -g bktide
    ```
    which will auto-link the workflow via `postinstall`.
- This npm path typically avoids macOS quarantine and can be friendlier for developer audiences.

### CI Considerations
- Do not run `alfred-link` in CI build jobs (Alfred isn’t present). The `|| true` guard prevents failures during `npm ci`.
- Continue packaging `.alfredworkflow` via existing release scripts.

### Interplay with Token Configuration Plan
- The Alfred token plan uses Alfred’s User Configuration (`BUILDKITE_API_TOKEN`). `alfred-link` does not manage secrets, only installs/symlinks and updates metadata.
- No changes needed—both plans are compatible.

### Troubleshooting
- "alfred-link: command not found": ensure it’s installed (dependency or devDependency) or call via `npx`.
- Workflow not appearing in Alfred:
  - Confirm Alfred 5 is installed and the default preferences path is used.
  - If preferences are synced elsewhere, set `ALFRED_WORKFLOWS_DIR` before running `alfred-link`.
- Changes not reflected: run `npm run alfred:relink` after updating `package.json` or `info.plist`.

### Rollout
- Add scripts and dependency.
- Document in `README.md` a developer section: build → link → iterate.
- Optionally announce npm-based install (`npm i -g bktide`) for users who prefer Terminal installs.


