## Releasing and Versioning

This project releases automatically on merges to `main`. Releases use a CalVer+SemVer hybrid:

- Version format: `MAJOR.MINOR.PATCH`
  - **MAJOR.MINOR**: manually curated to communicate compatibility and feature epochs
  - **PATCH**: UTC epoch seconds at release time (monotonic, unique)
  - Example stable: `1.2.1755201800`
  - Example prerelease (from PRs): `1.2.1755201800-pr.42`

Background: See CalVer at `https://calver.org/` and SemVer at `https://semver.org/`.

### What triggers a release

- Every push to `main` creates a GitHub Release with artifacts.
- The workflow ignores docs changes:
  - Ignored paths: `docs/**` (we can extend this list later).

### Artifacts

Each release publishes:
- `pkg/bktide-workflow-<version>.alfredworkflow`
- `pkg/bktide-workflow-<version>.alfredworkflow.sha256`

### Changelog strategy

- The release notes list commit subjects since the previous tag.
- We do not require conventional commits.

### Pre-releases (PR builds)

- On `pull_request` events, CI creates a prerelease:
  - Version: `MAJOR.MINOR.<epoch>-pr.<run_number>`
  - Tag: `vMAJOR.MINOR.<epoch>-pr.<run_number>`
  - Published as a GitHub Pre-Release with the same two artifacts.
  - Handy for testing Alfred imports before merge.

### How MAJOR/MINOR are managed

- MAJOR and MINOR live in `package.json` and are edited manually via PR when you want to start a new compatibility/feature epoch.
- CI reads `package.json.version` to get `MAJOR.MINOR`, then computes `PATCH` at release time.
- Recommended workflow to bump MINOR (example):
  1. Edit `package.json` → set `"version": "1.3.0"`
  2. Commit and open a PR titled "Bump minor to 1.3"
  3. Merge to `main`. Next release will be `1.3.<epoch>`
- For MAJOR, do the same with `"2.0.0"`, etc.

Note: CI does not write the computed `PATCH` back to `package.json`. Tags are the source of truth for the exact released version.

### CI overview

We have two workflows under `.github/workflows/`:

- `release.yml` (main releases)
  - Trigger: `push` to `main` (ignores `docs/**`)
  - Steps:
    - Compute next version: `MAJOR.MINOR.<utc-epoch>`
    - Build and package workflow
    - Create annotated tag `v<version>` and push it
    - Create GitHub Release and attach artifacts

- `pr-prerelease.yml` (PR prereleases)
  - Trigger: `pull_request` (opened, synchronize, reopened)
  - Steps:
    - Compute prerelease version with suffix `-pr.<run_number>`
    - Build and package
    - Create annotated tag and GitHub Pre-Release with artifacts

### Local testing and manual packaging

You can build and package locally at any time:

```bash
npm run build
npm run package
```

By default, packaging uses `package.json.version`. To preview the CI-computed version and bake it into the staged bundle, set `BKTIDE_VERSION`:

```bash
node scripts/compute-version.js
BKTIDE_VERSION=$(node scripts/compute-version.js) npm run package
```

This produces artifacts in `pkg/` and injects the version into the staged `package.json` and `info.plist` inside the workflow bundle.

### How version is computed

- Script: `scripts/compute-version.js`
  - Reads `MAJOR.MINOR` from `package.json.version`
  - Computes `PATCH` as current UTC epoch seconds
  - Ensures no tag collision by incrementing `PATCH` if necessary
  - Supports prereleases: `--pre pr --suffix <number>`

Examples:

```bash
# Stable version string
node scripts/compute-version.js

# PR prerelease version string
node scripts/compute-version.js --pre pr --suffix 42
```

### Bumping rules and guidance

- Bump MINOR when adding notable features or when you want consumers to be able to pin an epoch like `1.3.x`.
- Bump MAJOR for breaking changes.
- No manual action is required for PATCH; it’s always time-based.

### FAQs

- Why not push the exact PATCH back to `package.json`?
  - Avoids CI pushing to protected branches and racing multiple merges. The annotated tag and Release record the exact version. The bundle itself contains the correct version.

- How to skip a release?
  - Currently, any code change (excluding `docs/**`) triggers a release. We can add commit-message gates (e.g., `[skip release]`) later if needed.

- Can we ignore more paths?
  - Yes. Add entries under `paths-ignore` in `.github/workflows/release.yml`.


