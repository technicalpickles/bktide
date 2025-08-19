# Emoji and Icon Consolidation Plan

## Overview
Consolidate all hard-coded emoji and icons used in the CLI into a centralized theme system. This will provide consistent icon management, support for different display modes (emoji, UTF-8, ASCII), and make future customization easier.

## Current State Analysis

### Hard-coded Emoji Locations

1. **Build Status Icons** (`src/formatters/build-detail/PlainTextFormatter.ts`)
   - Method: `getStatusIcon()` (lines 743-755)
   - Method: `getJobStateIcon()` (lines 757-769)
   - Inline usage in job summaries and messages

2. **Annotation Icons** (`src/formatters/build-detail/PlainTextFormatter.ts`)
   - Method: `getAnnotationIcon()` (lines 771-780)

3. **Debug Logging** 
   - `src/services/BuildkiteClient.ts`: 20+ instances of ✅
   - `src/services/BuildkiteRestClient.ts`: 3 instances of ✅

4. **Alfred Formatters**
   - `src/formatters/token/AlfredFormatter.ts`: ✅ and ❌
   - `src/formatters/build-detail/AlfredFormatter.ts`: ❌

## Proposed Icon System

### Three Display Modes

1. **UTF-8 Mode** (default) - Clean UTF-8 symbols without emoji variants for universal compatibility
2. **Emoji Mode** - Full emoji support for users who prefer colorful icons
3. **ASCII Mode** - Plain ASCII for maximum compatibility with legacy terminals

### Icon Mappings

| Purpose | Emoji | UTF-8 | Unicode | ASCII |
|---------|-------|-------|---------|-------|
| **Build States** |
| Passed | ✅ | ✓ | U+2713 | [OK] |
| Failed | ❌ | ✗ | U+2717 | [FAIL] |
| Running | 🔄 | ↻ | U+21BB | [RUN] |
| Blocked | ⏸️ | ‖ | U+2016 | [BLOCK] |
| Canceled | 🚫 | ⊘ | U+2298 | [CANCEL] |
| Scheduled | 📅 | ⏰ | U+23F0 | [SCHED] |
| Skipped | ⏭️ | » | U+00BB | [SKIP] |
| Unknown | ❓ | ? | U+003F | [?] |
| **Annotations** |
| Error | ❌ | ✗ | U+2717 | [ERR] |
| Warning | ⚠️ | ⚠ | U+26A0 | [WARN] |
| Info | ℹ️ | ⓘ | U+24D8 | [INFO] |
| Success | ✅ | ✓ | U+2713 | [OK] |
| Default | 📝 | ◆ | U+25C6 | [NOTE] |
| **Progress** |
| Timing | ⏱️ | ⧗ | U+29D7 | [TIME] |
| Retry | 🔄 | ↻ | U+21BB | [RETRY] |
| Success Log | ✅ | ✓ | U+2713 | [✓] |

## Implementation Plan

### Phase 1: Add Theme Infrastructure
1. Create new icon structures in `src/ui/theme.ts`
2. Add `STATE_ICONS`, `ANNOTATION_ICONS`, and `PROGRESS_ICONS` objects
3. Implement `getIconMode()` function to detect display mode
4. Create helper functions: `getStateIcon()`, `getAnnotationIcon()`, `getProgressIcon()`
5. Support environment variables: `BKTIDE_EMOJI` and `BKTIDE_ASCII`
6. Support command-line flags: `--emoji` and `--ascii`

### Phase 2: Update Formatters
1. Update `PlainTextFormatter.ts` to use new icon functions
   - Replace `getStatusIcon()` method
   - Replace `getJobStateIcon()` method  
   - Replace `getAnnotationIcon()` method
   - Update inline emoji usage (job summaries, blocked messages, etc.)
2. Update other formatters as needed

### Phase 3: Update Service Classes
1. Update `BuildkiteClient.ts` debug logging
   - Replace hard-coded ✅ with `getProgressIcon('SUCCESS_LOG')`
2. Update `BuildkiteRestClient.ts` debug logging
   - Same replacement for success indicators

### Phase 4: Update Alfred Formatters
1. Consider whether Alfred should always use emoji (GUI context)
2. Update to use centralized definitions even if always in emoji mode

### Phase 5: Testing and Documentation
1. Test all three display modes
2. Update documentation with new environment variables and flags
3. Add examples showing different modes

## Benefits

1. **Centralized Management**: All icons defined in one place
2. **Consistency**: Same icon logic across the entire codebase
3. **Flexibility**: Users can choose their preferred display mode
4. **Accessibility**: ASCII mode for terminals without Unicode support
5. **Maintainability**: Easy to update icons or add new ones
6. **Future-proof**: Can easily add user customization later

## Testing Strategy

```bash
# Default UTF-8 mode (clean symbols)
bin/bktide build org/pipeline/123

# Emoji mode via environment
BKTIDE_EMOJI=1 bin/bktide build org/pipeline/123

# ASCII mode via environment
BKTIDE_ASCII=1 bin/bktide build org/pipeline/123

# Emoji mode via flag
bin/bktide build org/pipeline/123 --emoji

# ASCII mode via flag
bin/bktide build org/pipeline/123 --ascii

# Test with debug logging
bin/bktide builds --debug
BKTIDE_EMOJI=1 bin/bktide builds --debug
BKTIDE_ASCII=1 bin/bktide builds --debug
```

## Migration Safety

- Keep backward compatibility during migration
- Implement new system alongside old code initially
- Remove old code only after thorough testing
- Consider feature flag for rollback if needed

## Success Criteria

- [ ] All hard-coded emoji moved to theme system
- [ ] Three display modes working correctly
- [ ] No visual regressions in default mode
- [ ] UTF-8 and ASCII modes provide readable alternatives
- [ ] Debug logging uses centralized icons
- [ ] Documentation updated with new options
- [ ] Tests pass in all three modes
