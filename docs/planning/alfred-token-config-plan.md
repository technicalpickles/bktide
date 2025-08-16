## Alfred Token Configuration & Native Module Avoidance Plan

This plan enables the Alfred workflow to "just work" without macOS Gatekeeper warnings by avoiding native module loading under Alfred, while keeping secure keychain storage for the standalone CLI.

### Goals
- Use Alfred 5 User Configuration to store the Buildkite token as an environment variable.
- Avoid loading `@napi-rs/keyring` when the command runs from Alfred to prevent Gatekeeper warnings on `.node` binaries.
- Preserve `@napi-rs/keyring` for the standalone CLI and multi-platform support.
- Provide a clear first-run UX that prompts users to set their token via Alfred.
- Keep packaging simple (continue shipping a plain `.alfredworkflow`).

### Constraints & Assumptions
- Target Alfred 5 (User Configuration + Automation Tasks available).
- Token in Alfred is hidden/not-exported but not Keychain-encrypted. This is acceptable for the workflow.
- Existing CLI already supports `BUILDKITE_API_TOKEN` from environment.
- We will not sign/notarize artifacts for this track.

---

## Approach Overview

1. Alfred stores the token in User Configuration as a secret variable named `BUILDKITE_API_TOKEN`.
2. Runtime detects if the process is running under Alfred (by environment variables) and, if so, uses `process.env.BUILDKITE_API_TOKEN` only.
3. When not running under Alfred (standalone CLI), lazy-import and use `@napi-rs/keyring` for secure storage.
4. First-run UX in Alfred: when the token is missing, the Script Filter shows a single actionable item that opens Alfred's Workflow Configuration (Automation Task) for the user to paste the token.
5. Distribution remains a simple `.alfredworkflow` bundle with no notarization or codesigning requirements.

---

## Implementation Details

### 1) Alfred User Configuration
- Define a new User Configuration field in the workflow:
  - Name: Buildkite API Token
  - Variable: `BUILDKITE_API_TOKEN`
  - Type: Secret / Do not export
- Outcome: Alfred will set `process.env.BUILDKITE_API_TOKEN` for processes launched by the workflow.

### 2) Alfred Runtime Detection
- Detect Alfred by checking one of these environment variables:
  - `process.env.alfred_version`
  - `process.env.ALFRED_VERSION`
  - `process.env.alfred_workflow_bundleid`
- Consider detection true if any are present.

### 3) Credential Strategy
- Under Alfred: read `process.env.BUILDKITE_API_TOKEN` and never import the keyring module.
- Outside Alfred: lazy-import `@napi-rs/keyring` only when required (e.g., on get/set operations) to avoid accidental load in shared code paths.

Pseudo-code outline:

```ts
function isRunningInAlfred(): boolean {
  return Boolean(
    process.env.alfred_version ||
    process.env.ALFRED_VERSION ||
    process.env.alfred_workflow_bundleid
  );
}

export async function getToken(): Promise<string | null> {
  if (isRunningInAlfred()) {
    return process.env.BUILDKITE_API_TOKEN ?? null;
  }
  const keyring = await import('@napi-rs/keyring');
  // ... use keyring for CLI
}

export async function setToken(token: string): Promise<void> {
  if (isRunningInAlfred()) {
    // In Alfred, we do not persist from code; instruct user to set via UI.
    throw new Error('In Alfred, set token via Workflow Configuration.');
  }
  const keyring = await import('@napi-rs/keyring');
  // ... use keyring for CLI
}
```

Notes:
- Use dynamic `import()` to avoid early resolution of the native module by bundlers/runtime when running under Alfred.
- If bundling with esbuild for any reason, mark `@napi-rs/keyring` as external in the Alfred distribution to avoid including it in the bundle; it is acceptable to keep it in `node_modules` without loading.

### 4) First-Run UX (Alfred)
- Script Filter logic when invoked from Alfred:
  - If `BUILDKITE_API_TOKEN` is missing or empty:
    - Return a single Alfred item: "Set Buildkite token"
    - On action, run the Alfred Automation Task: "Open Workflow Configuration" so users can paste the token directly.
- Optional: add a keyword (e.g., `bktide:config`) that always opens the same Automation Task for convenience.

### 5) Distribution
- Continue packaging as `.alfredworkflow` with the current artifact layout.
- No signing/notarization required for this track because the native module is not loaded by Alfred.
- Keep `@napi-rs/keyring` dependency in `package.json` for CLI; ensure Alfred path never imports it.

### 6) Documentation
- Update `README.md` (workflow section) to instruct users:
  - Open the workflow configuration and set the "Buildkite API Token" field.
  - Mention that the token is stored by Alfred and hidden from export.
  - Provide troubleshooting steps if commands show a missing token message.

---

## Testing & Validation

### Alfred Path
1. Fresh import of the workflow with no token set:
   - Script Filter shows the "Set Buildkite token" item.
   - Selecting it opens Workflow Configuration.
2. After setting the token:
   - Commands execute successfully.
   - Debug logs confirm that keyring is never imported.

### CLI Path
1. Run CLI outside Alfred with no env token:
   - Keyring lazy-imports and retrieves/stores token in Keychain (per OS).
2. Multi-platform validation (macOS + Linux + Windows):
   - Ensure `@napi-rs/keyring` functions as expected.

### Packaging
1. Build and package `.alfredworkflow`.
2. Import on a clean macOS profile and verify no Gatekeeper prompts appear during use.

---

## Rollout Plan
- Phase 1 (Alfred-first):
  - Ship workflow using Alfred User Configuration. Announce that token is now set via Workflow Configuration.
- Phase 2 (optional):
  - Consider adding npm-based install with `alfred-link` to avoid quarantine flows.
- Phase 3 (optional, long-term):
  - Revisit signing/notarization for a polished DMG distribution if desired.

---

## Risks & Mitigations
- Token storage is not Keychain-encrypted in Alfred:
  - Acceptable per requirements; clearly document behavior.
- Accidental native module load in Alfred:
  - Use runtime detection + dynamic import only in non-Alfred paths.
  - Add integration tests or debug logging to verify no import under Alfred.
- Bundler unintentionally includes native module:
  - If bundling, mark keyring as external for Alfred builds.

---

## Follow-ups
- Implement runtime detection and lazy import in the credential layer.
- Add Script Filter handling for missing token and wire to the "Open Workflow Configuration" Automation Task.
- Update docs with setup instructions and screenshots (optional).
- Add smoke tests for Alfred path and CLI path.


