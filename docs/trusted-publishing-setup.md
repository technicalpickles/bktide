# Trusted Publishing Setup for bktide

This document outlines the steps to enable npm Trusted Publishing with OIDC for the bktide package.

## Benefits of Trusted Publishing

- **No long-lived tokens**: Eliminates risk of token exposure or compromise
- **Automatic provenance**: Cryptographic proof of build origin
- **Short-lived credentials**: Each publish uses workflow-specific, temporary tokens
- **No manual rotation**: Credentials are automatically managed

## Prerequisites

- [x] Public GitHub repository (technicalpickles/bktide)
- [x] npm package already published (bktide)
- [x] GitHub environment configured (release)
- [x] Repository field in package.json matches GitHub repo
- [x] Workflow has `id-token: write` permission
- [x] Using GitHub-hosted runners (not self-hosted)

## Setup Steps

### 1. Configure Trusted Publisher on npm (npmjs.com)

1. Go to https://www.npmjs.com/package/bktide/access
2. Find the "**Trusted Publisher**" section
3. Click "**Add trusted publisher**"
4. Select "**GitHub Actions**" as the provider
5. Configure with these EXACT values:
   - **Organization or user**: `technicalpickles`
   - **Repository**: `bktide`
   - **Workflow filename**: `release.yml` (just the filename, not the path)
   - **Environment name**: `release` (optional but recommended)
6. Click "**Save**"

### 2. GitHub Repository Settings

No changes needed if you already have:
- [x] `release` environment created (Settings → Environments)
- [x] Repository is public
- [x] Workflow file exists at `.github/workflows/release.yml`

Optional: Add environment protection rules:
- Required reviewers for manual approval
- Deployment branches (restrict to `main` only)

### 3. Code Changes (Already Applied)

✅ **Workflow changes** (`.github/workflows/release.yml`):
- Removed token-based publishing step
- Added npm version update for OIDC support (requires npm 11.5.1+)
- Enabled trusted publishing without explicit `--provenance` flag
- Kept `id-token: write` permission
- Kept `environment: release` setting

✅ **Package.json** (no changes needed):
- Already has `"provenance": true` in publishConfig
- Repository field correctly set to GitHub URL

### 4. Clean Up (Optional)

Once trusted publishing is working:
- Remove `NPM_TOKEN` secret from GitHub repository (Settings → Secrets and variables → Actions)
- Remove commented token validation code from workflow

## How It Works

1. **Workflow triggers** on push to main after CI success
2. **GitHub generates OIDC token** using `id-token: write` permission
3. **npm CLI detects OIDC** environment and exchanges token for temporary npm credentials
4. **Publish occurs** with automatic provenance generation
5. **Provenance is published** to sigstore transparency log

## Testing the Setup

1. Make a small change and push to main
2. Watch the release workflow run
3. Check for successful publish without token errors
4. Verify provenance badge appears on npm package page

## Troubleshooting

### "Unable to authenticate" error
- Verify workflow filename matches exactly (case-sensitive): `release.yml`
- Ensure using GitHub-hosted runners, not self-hosted
- Confirm `id-token: write` permission is set

### 404 Error on publish
- Double-check all Trusted Publisher fields match exactly
- Repository name is just `bktide`, not the full URL
- Workflow filename includes `.yml` extension

### Provenance not generated
- This is automatic with trusted publishing for public packages
- Won't work for private repositories (even if package is public)

## Rollback Plan

If issues occur, quickly rollback to token-based publishing:
1. In workflow, comment out the trusted publishing step
2. Uncomment the token-based publish step (lines 83-87)
3. Ensure NPM_TOKEN secret is still in GitHub
4. Push changes to trigger release

## References

- [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers)
- [GitHub Actions OIDC Documentation](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [OpenSSF Trusted Publishers Specification](https://repos.openssf.org/trusted-publishers)
