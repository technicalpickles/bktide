# Snapshot Color & Formatting Gaps

**Status**: Follow-up idea from iteration 2 review
**Date**: 2026-01-27

## Summary

The snapshot UX iteration 2 plan focused on structural improvements (spacing, location, change detection) but did not address color/formatting for the output. This document captures the gaps identified for a future iteration.

## Current State

### What's Colored
- `displayBuildSummary()` uses colors properly:
  - Status icon via `BUILD_STATUS_THEME`
  - Build number and duration via `SEMANTIC_COLORS.dim()`
  - Branch via `SEMANTIC_COLORS.identifier()`
  - Job stats via `success/error/warning/info/muted`

### What's Not Colored
- "Snapshot saved to..." message
- "Snapshot already up to date" message
- "Next steps:" header
- Tip arrows (→)
- Paths in tips
- Command examples in tips
- Captured counts ("N step(s) captured")

## Identified Gaps

### 1. Plan Did Not Specify Color Usage

The iteration 2 plan only mentioned `SEMANTIC_COLORS.dim()` once (for manifest.json line). No guidance for:
- Status message colors (success vs info)
- Header formatting (bold? underlined?)
- Tip/command de-emphasis

### 2. Not Using Existing `formatTips()` System

`ui-design-system.md` documents a standardized tip formatting system:

```typescript
export enum TipStyle {
  GROUPED = 'grouped',     // Tips: with bullets
  INDIVIDUAL = 'individual', // → Individual arrows
  ACTIONS = 'actions',     // Next steps: with arrows
  FIXES = 'fixes',         // To fix this: numbered
}

formatTips(tips: string[], style: TipStyle)
```

Current implementation manually outputs tips via `logger.console()` instead.

### 3. Missing Semantic Color Application

Per design system conventions:
- `SEMANTIC_COLORS.success()` - for "Snapshot saved" (blue)
- `SEMANTIC_COLORS.info()` - for "already up to date" (cyan)
- `SEMANTIC_COLORS.count()` - for numbers like "3 step(s)" (magenta)
- `SEMANTIC_COLORS.dim()` - for tip text (de-emphasized)
- `SEMANTIC_COLORS.subheading()` - for "Next steps:" (bold)

### 4. "Already Up to Date" Missing Context

Current output:
```
Snapshot already up to date: ./tmp/bktide/snapshots/...
```

Doesn't show build state (PASSED/FAILED). User may want to know what build this snapshot represents.

### 5. Tip Accessibility

Design system specifies fallbacks when color disabled:
```typescript
tip: (s: string) => colorEnabled() ? chalk.dim(s) : `(${s})`,
```

Current tips don't use this pattern.

## Proposed Changes

### Option A: Minimal Color Enhancement

Add semantic colors to key messages only:

```typescript
// Success case
logger.console(SEMANTIC_COLORS.success(`Snapshot saved to ${path}`));

// Already up to date case
logger.console(SEMANTIC_COLORS.info(`Snapshot already up to date: ${path}`));

// Counts
logger.console(`  ${SEMANTIC_COLORS.count(String(count))} step(s) captured`);

// Next steps header
logger.console(SEMANTIC_COLORS.subheading('Next steps:'));

// Tip text
logger.console(SEMANTIC_COLORS.dim(`  → ${tip}`));
```

### Option B: Full `formatTips()` Integration

Refactor `displayNavigationTips()` to use the standard tip system:

```typescript
const tips = [
  `List failures: jq -r '...' ${manifestPath}`,
  `View annotations: jq -r '...' ${annotationsPath}`,
  // ...
];

logger.console('');
logger.console(formatTips(tips, TipStyle.ACTIONS));
```

This would require extending `formatTips()` to support the command-style tips with labels.

### Option C: Hybrid Approach

- Use semantic colors for status messages and counts (Option A)
- Keep manual tip output but apply `SEMANTIC_COLORS.dim()` to tip text
- Add `SEMANTIC_COLORS.subheading()` to "Next steps:" header

## Gap Summary Table

| Aspect | Plan Coverage | Implementation | Recommendation |
|--------|--------------|----------------|----------------|
| Visual delimiter | ✅ | ✅ | Done |
| Section spacing | ✅ | ✅ | Done |
| Change detection | ✅ | ✅ | Done |
| **Status message colors** | ❌ | ❌ | Add success/info |
| **Next steps header** | ❌ | ❌ | Add subheading |
| **Tip text coloring** | ❌ | ❌ | Add dim |
| **Count highlighting** | ❌ | ❌ | Add count() |
| **formatTips() usage** | ❌ | ❌ | Consider for v2 |

## Decision Needed

1. **Scope**: Minimal (just key messages) vs full formatting system integration?
2. **Build summary in "up to date" case**: Show it or keep minimal?
3. **Priority**: Is this worth a dedicated iteration or fold into next feature work?

## Related Files

- `src/commands/Snapshot.ts` - Current implementation
- `src/ui/theme.ts` - Color and formatting utilities
- `docs/developer/ui-design-system.md` - Design conventions
- `docs/plans/2026-01-27-snapshot-ux-iteration-2-implementation.md` - Iteration 2 plan
