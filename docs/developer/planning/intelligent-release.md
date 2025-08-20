# Intelligent Release Strategy

**Status**: ✅ **Implemented but Not Active** - The intelligent release system is fully implemented but we are not using it for releases yet. Currently using standard release-on-every-commit approach.

This document describes the intelligent release system that only creates releases when there are material changes to the npm package or Alfred workflow.

## Overview

Instead of releasing on every commit to `main`, the intelligent release system:
1. Detects which files changed since the last release
2. Determines if any changes are "material" (affect the distributed packages)
3. Only proceeds with a release if material changes are detected

## What Counts as Material Changes?

### Material Files (trigger a release)
- **Source code**: `src/**/*` - Gets compiled to `dist/`
- **Package configuration**: `package.json`, `package-lock.json`
- **Build configuration**: `tsconfig.json`
- **Critical scripts**: 
  - `scripts/package-workflow.js` (builds Alfred workflow)
  - `scripts/compute-version.js` (determines version)
- **Binaries and entry points**: `bin/**/*`
- **Bundled assets**:
  - `icons/**/*`, `icon.png` (Alfred workflow icons)
  - `info.plist` (Alfred workflow metadata)
  - `env.example` (configuration template)
- **Bundled documentation**:
  - `README.md` (npm package)
  - `WORKFLOW_README.md` (Alfred workflow)
  - `LICENSE`
- **GraphQL changes**: 
  - `src/graphql/queries.ts` (query definitions)
  - `src/graphql/generated/**/*` (generated types and SDK - affect runtime)*
  - `codegen.mjs` (generation config)

> *Note: While GraphQL files in `src/graphql/generated/` are generated, they're considered material because they:
> - Are checked into version control
> - Contain runtime TypeScript types and functions
> - Must be in sync with the API schema
> - Are included in the published npm package

### Non-Material Files (skip release)
- **Documentation**: `docs/**/*`, other `*.md` files
- **GitHub workflows**: `.github/**/*`
- **Development tooling**: 
  - `lefthook.yml`, `mise.toml`
  - `.cursor/**/*`
  - Non-critical scripts in `scripts/`
- **Compiled output**: `dist/**/*` (TypeScript build artifacts, rebuilt during publish)
- **Build artifacts**: `pkg/**/*`, `.stage/**/*`
- **Development directories**: `bk-cli/**/*`, `log/**/*`

## How It Works

### 1. Change Detection Script
The `scripts/detect-material-changes.js` script:
- Finds the last release tag (`v*`)
- Gets list of changed files since that tag
- Filters changes through material/non-material patterns
- Returns exit code 0 if release needed, 1 if not

### 2. GitHub Workflow
The workflow has two jobs:
1. **check-changes**: Runs change detection and determines if release is needed
2. **release**: Only runs if material changes detected

## Migration Path

### Option 1: Replace Existing Workflow
```bash
# Rename the new workflow to replace the old one
mv .github/workflows/release-intelligent.yml .github/workflows/release-on-main.yml
```

### Option 2: Run Both in Parallel (Testing)
Keep both workflows and compare their behavior. The intelligent workflow won't create duplicate releases due to version computation.

### Option 3: Gradual Migration
1. Keep current workflow disabled: Add `if: false` to the release job
2. Run intelligent workflow in parallel
3. Monitor for a few releases
4. Remove old workflow when confident

## Manual Release Override

Sometimes you may want to force a release even without material changes (e.g., for security updates in dependencies).

### Option 1: Workflow Dispatch
Add this to the intelligent release workflow:

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types:
      - completed
  workflow_dispatch:
    inputs:
      force-release:
        description: 'Force a release even without material changes'
        required: false
        type: boolean
        default: false
```

Then update the check:
```yaml
should-release: ${{ steps.detect.outputs.should-release == 'true' || github.event.inputs.force-release == 'true' }}
```

### Option 2: Commit Message Flag
Detect `[force-release]` in commit messages:

```bash
# In the detection step
FORCE_RELEASE=false
if git log -1 --pretty=%B | grep -q "\[force-release\]"; then
  FORCE_RELEASE=true
fi
```

### Option 3: Manual Tag
Create a tag manually to trigger a release:
```bash
git tag -a v1.2.3 -m "Manual release"
git push origin v1.2.3
```

## Testing the Detection Script

Test the detection script locally:

```bash
# Check current state
node scripts/detect-material-changes.js --verbose

# See JSON output
node scripts/detect-material-changes.js --json

# Test with no previous tags (simulates first release)
git tag -d $(git tag -l)  # Dangerous! Only in test repo
node scripts/detect-material-changes.js
```

## Monitoring Releases

The workflow provides detailed information:
- **GitHub Actions Summary**: Shows why release was triggered or skipped
- **Release Notes**: Include the reason for release
- **Workflow Logs**: Detailed file change information

## Common Scenarios

### Documentation-Only Changes
- Changes to `docs/**/*` or `*.md` files (except README.md)
- **Result**: No release

### Bug Fix in Source
- Changes to `src/**/*.ts` files
- **Result**: Release triggered

### CI/CD Updates
- Changes to `.github/workflows/*.yml`
- **Result**: No release (unless force-release)

### Dependency Updates
- Changes to `package-lock.json` only
- **Result**: Release triggered (dependencies affect the build)

### Icon Updates
- Changes to `icons/*.png`
- **Result**: Release triggered (icons are bundled)

## Troubleshooting

### Release Not Triggered When Expected
1. Check the workflow summary for which files were detected
2. Verify the file is in the material patterns list
3. Check if the file might be excluded by non-material patterns

### Release Triggered Unexpectedly
1. Review the material files list in the workflow summary
2. Consider if the file pattern is too broad
3. Update `scripts/detect-material-changes.js` patterns if needed

### Detection Script Fails
- Ensure you have full git history: `fetch-depth: 0` in checkout
- Verify git tags exist: `git tag -l 'v*'`
- Check git is available in the environment

## Future Enhancements

Consider these improvements:
1. **Semantic versioning**: Detect major/minor/patch based on changed files
2. **Change categories**: Group changes (features, fixes, deps) for better release notes
3. **Preview mode**: Dry-run to see what would be released
4. **Dependency-only releases**: Special handling for security updates
5. **Caching**: Cache detection results for faster subsequent checks
