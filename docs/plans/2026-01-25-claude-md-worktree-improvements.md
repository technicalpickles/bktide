# CLAUDE.md Worktree Improvements

> Recommendations from snapshot UX improvements session (2026-01-25)

## Problem

During the snapshot UX improvements implementation, significant time was lost debugging why code changes weren't reflected in the built binary. The root cause: commands were run from the main repo (`/workspace/bktide`) instead of the worktree (`/workspace/bktide/.worktrees/feature/snapshot-ux-improvements`).

This caused:
- `npm run build` to compile from wrong source
- Built binary had old code (manifest v1) despite editing worktree files
- Confusion about why tests passed but runtime behavior differed

## Recommended CLAUDE.md Additions

Add the following to `~/.claude/CLAUDE.md`:

```markdown
## Git Worktrees

When using the `superpowers:using-git-worktrees` skill, prefer creating worktrees in `.worktrees` directory relative to the main repository root.

### CRITICAL: Working in Worktrees

When developing in a worktree:

1. **ALWAYS run build/test commands from the worktree directory**
   - Build commands in the main repo will NOT use worktree source files
   - `npm run build`, `npm test`, etc. compile from their current directory

2. **Before debugging "changes not working"**
   - FIRST verify you're in the correct directory with `pwd`
   - The main repo's `dist/` does NOT reflect worktree changes

3. **Verification pattern**
   ```bash
   # Confirm you're in the worktree before building
   pwd  # Should show .worktrees/<branch>/
   npm run build && npm test
   ```

### Quick Reference
| Task | Run from |
|------|----------|
| Edit code | Worktree |
| Build | Worktree |
| Test | Worktree |
| Git operations | Worktree |
```

## Why This Matters

Each git worktree is a separate working directory with its own:
- Source files
- Build artifacts (`dist/`, `node_modules/`, etc.)
- Git state (branch, staged changes)

Running `npm run build` in `/repo` compiles `/repo/src/*`, NOT `/repo/.worktrees/feature-x/src/*`.

## Action Items

- [ ] Review and apply changes to `~/.claude/CLAUDE.md`
- [ ] Consider adding project-specific `.claude/CLAUDE.md` with similar guidance
