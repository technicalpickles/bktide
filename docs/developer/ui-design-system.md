# UI Design System

**Status**: ✅ **Implemented** - This design system is fully implemented in `src/ui/theme.ts` and used throughout the CLI.

## Overview

The bktide CLI uses a comprehensive visual design system that enhances information hierarchy, improves scannability, and maintains accessibility. The system uses color, typography, and formatting strategically to guide user attention and convey meaning quickly.

**Core question every command should answer:** "What happened? What can I do? What's next?"

---

## CLI UX Principles

These six principles guide all CLI design decisions:

| Principle | What | When Violated | Fix |
|-----------|------|---------------|-----|
| **Familiarity** | Use known conventions | Users relearn basic operations | Follow standards (--help, common flags) |
| **Discoverability** | Guide users to features | Users can't find functionality | Add help text, prompts, examples |
| **Feedback** | Show system state | Users unsure if action worked | Confirmations, progress, state display |
| **Clarity** | Structure information | Output is overwhelming | Spacing, alignment, hierarchy |
| **Flow** | Minimize friction | Users repeatedly interrupted | Shortcuts, defaults, scriptability |
| **Forgiveness** | Handle errors gracefully | Users afraid to experiment | Clear errors, suggestions, undo |

### 1. Familiarity

Use conventions users already know:

```bash
# Standard flags we support
--help, -h        # Always support
--debug           # Detailed output
--format          # Output format (plain/json/alfred)
--no-color        # Disable color
--no-tips         # Disable hints
```

### 2. Discoverability

Users shouldn't need external docs for basic usage:

- **Help text**: Every command supports `--help`
- **Tips**: Contextual hints shown after output
- **Examples**: Real usage in help text
- **Autocomplete**: Shell completions for Fish/Bash/Zsh

### 3. Feedback

Never leave users guessing:

| Operation Duration | Feedback Required |
|-------------------|-------------------|
| <0.5s | Confirmation only |
| 0.5-2s | Simple message ("Processing...") |
| 2-10s | Spinner with status |
| >10s | Progress bar with details |

### 4. Clarity

Structure output for human scanning:

```bash
# Bad - wall of text
Build #123 PASSED main abc1234 2m 30s Josh 5 passed 2 failed

# Good - grouped and spaced
✓ PASSED Fix authentication bug #123  2m 30s
         Josh • main • abc1234 • 5 minutes ago

5 steps: 3 passed, 2 failed
```

### 5. Flow

Support both interactive and scripted usage:

```bash
# Interactive - shows tips, progress
bktide build org/pipeline/123

# Scripted - clean output, proper exit codes
bktide build org/pipeline/123 --format json --no-tips
```

### 6. Forgiveness

Make it safe to experiment:

```bash
# Bad error
Error: invalid

# Good error
Error: Build reference 'foo' not recognized
Valid formats:
  • org/pipeline/123
  • https://buildkite.com/org/pipeline/builds/123
  • Build URL from clipboard
```

---

## Visual Design Principles

### Progressive Disclosure
- Primary information (data) is prominent
- Secondary information (tips, hints) is subdued
- Error states demand attention

### Semantic Color Usage
- Colors convey meaning, not just decoration
- Consistent color mapping across all commands
- Colorblind-safe palette

### Visual Hierarchy
- Bold headings for sections
- Regular weight for data
- Dim/muted for auxiliary information
- High contrast for critical information

### Accessibility First
- Never rely solely on color to convey information
- Always pair colors with symbols/text
- Support NO_COLOR and ASCII modes

## Implementation

The design system is implemented in `src/ui/theme.ts` with the following key components:

### Semantic Colors (`SEMANTIC_COLORS`)

```typescript
export const SEMANTIC_COLORS = {
  // Status colors (colorblind-safe)
  success: (s: string) => colorEnabled() ? chalk.blue(s) : s,
  error: (s: string) => colorEnabled() ? chalk.rgb(255, 140, 0)(s) : s,
  warning: (s: string) => colorEnabled() ? chalk.yellow(s) : s,
  info: (s: string) => colorEnabled() ? chalk.cyan(s) : s,
  
  // Typography emphasis levels
  heading: (s: string) => colorEnabled() ? chalk.bold.underline(s) : `== ${s} ==`,
  subheading: (s: string) => colorEnabled() ? chalk.bold(s) : `** ${s} **`,
  label: (s: string) => colorEnabled() ? chalk.bold(s) : s.toUpperCase(),
  
  // Data type highlighting
  identifier: (s: string) => colorEnabled() ? chalk.cyan(s) : s,
  count: (s: string) => colorEnabled() ? chalk.magenta(s) : s,
  url: (s: string, label?: string) => terminalLink(s, label),
  
  // De-emphasis (auxiliary information)
  dim: (s: string) => colorEnabled() ? chalk.dim(s) : s,
  muted: (s: string) => colorEnabled() ? chalk.gray(s) : s,
  tip: (s: string) => colorEnabled() ? chalk.dim(s) : `(${s})`,
  help: (s: string) => colorEnabled() ? chalk.dim.italic(s) : `[${s}]`,
};
```

### Build Status Theme (`BUILD_STATUS_THEME`)

Maps build states to appropriate colors and symbols:

```typescript
export const BUILD_STATUS_THEME = {
  PASSED: { color: SEMANTIC_COLORS.success, symbol: '✓', ascii: '[OK]' },
  FAILED: { color: SEMANTIC_COLORS.error, symbol: '✖', ascii: '[FAIL]' },
  RUNNING: { color: SEMANTIC_COLORS.info, symbol: '↻', ascii: '[RUN]' },
  // ... etc
};
```

### Icon System

Three display modes for different terminal capabilities:

- **UTF-8 (default)**: Clean symbols like ✓, ✗, ◷
- **Emoji**: Full emoji support (✅, ❌, 🔄) via `BKTIDE_EMOJI=1`
- **ASCII**: Plain text ([OK], [FAIL]) via `BKTIDE_ASCII=1`

### Tip Formatting System

Standardized tip formatting with multiple styles:

```typescript
export enum TipStyle {
  GROUPED = 'grouped',     // Tips: with bullets
  INDIVIDUAL = 'individual', // → Individual arrows
  ACTIONS = 'actions',     // Next steps: with arrows
  FIXES = 'fixes',         // To fix this: numbered
  BOX = 'box'             // Fancy box (wide terminals)
}

export function formatTips(
  tips: string[], 
  style: TipStyle = TipStyle.GROUPED,
  includeTurnOff: boolean = true
): string
```

## Usage Guidelines

### In Formatters

```typescript
import { SEMANTIC_COLORS, formatTips, TipStyle } from '../ui/theme.js';

// Use semantic colors for consistent theming
const output = SEMANTIC_COLORS.heading('Build Results');
const status = SEMANTIC_COLORS.success('✓ Passed');

// Format tips consistently
const tips = ['Use --org <name> to filter results'];
if (tips.length > 0) {
  lines.push('');
  lines.push(formatTips(tips, TipStyle.GROUPED));
}
```

### Icon Usage

```typescript
import { getStateIcon, getAnnotationIcon } from '../ui/theme.js';

// ✅ Good - Use theme functions
const icon = getStateIcon('PASSED');
lines.push(`${icon} Build passed`);

// ❌ Bad - Don't hardcode
lines.push(`✅ Build passed`);
```

### Error Formatting

```typescript
import { formatError } from '../ui/theme.js';

const errorOutput = formatError(error, {
  showHelp: true,
  suggestions: ['Check your token', 'Verify network connection']
});
```

## Accessibility Features

### NO_COLOR Support
- Automatically detected via `NO_COLOR` environment variable
- Falls back to text-only formatting
- Symbols provide visual cues without relying on color

### ASCII Mode
- Enabled via `BKTIDE_ASCII=1` environment variable
- Replaces UTF-8 symbols with ASCII equivalents
- Screen reader compatible

### Terminal Detection
- Automatically detects TTY capabilities
- Disables colors and formatting in pipes
- Respects terminal width for responsive layouts

## Color Palette

### Status Colors (Colorblind-Safe)
- **Success**: Blue (`chalk.blue`) - ✓ Clear success
- **Error**: Orange (`chalk.rgb(255, 140, 0)`) - ✖ Clear failure  
- **Warning**: Yellow (`chalk.yellow`) - ⚠ Needs attention
- **Info**: Cyan (`chalk.cyan`) - ℹ Informational

### Typography Colors
- **Heading**: Bold + underlined
- **Label**: Bold
- **Identifier**: Cyan (URLs, IDs)
- **Count**: Magenta (numbers)
- **Dim**: Dimmed (auxiliary info)
- **Muted**: Gray (less important)

## Best Practices

1. **Always use semantic colors** instead of direct chalk calls
2. **Use theme functions** for icons and symbols
3. **Format tips consistently** with `formatTips()`
4. **Test with NO_COLOR=1** to ensure accessibility
5. **Test with BKTIDE_ASCII=1** for screen reader compatibility
6. **Never rely solely on color** - always pair with symbols or text

## Files

- **Implementation**: `src/ui/theme.ts` - Main theme system
- **Symbols**: `src/ui/symbols.ts` - Icon and symbol definitions
- **Usage**: Throughout `src/formatters/` - Applied in all output formatters

---

## Visual Techniques

Five techniques for effective CLI output:

### 1. Color (Semantic Meaning)

| Color | Meaning | Use For |
|-------|---------|---------|
| Blue | Success | Passed builds, completed tasks |
| Orange | Error | Failed builds, errors |
| Yellow | Warning | Soft failures, cautions |
| Cyan | Info | Identifiers, informational |
| Gray | Secondary | Timestamps, metadata |

**Never color alone** - always pair with symbols:
```bash
# Bad - color only
[blue]success[/blue]

# Good - symbol + color
✓ Success
```

### 2. Spacing (Visual Grouping)

```bash
# Bad - no grouping
Build: #123 Status: PASSED Steps: 5 Duration: 2m

# Good - blank lines group related info
✓ PASSED Fix authentication bug #123  2m 30s
         Josh • main • abc1234 • 5 minutes ago

5 steps: 3 passed, 2 failed
```

### 3. Layout (Structured Regions)

```bash
# Header region
✓ PASSED Fix auth bug #123

# Details region (indented)
         Josh • main • abc1234

# Stats region (separated)

5 steps: 3 passed, 2 failed

# Tips region (dim, at end)
Tips:
  → Use --all to capture all logs
```

### 4. Symbols (Fast Signifiers)

| Symbol | Meaning | bktide Usage |
|--------|---------|--------------|
| ✓ | Success | Passed builds/jobs |
| ✗ | Failure | Failed builds/jobs |
| ▲ | Warning | Soft failures |
| ↻ | Running | In-progress |
| → | Next/Tip | Suggestions |
| • | Separator | Metadata separator |

### 5. Structured Feedback (Progress Narrative)

```bash
# Checklist pattern
Deployment checklist:
  ✓ Code built
  ✓ Tests passed
  ⏱ Uploading... (30s)
  ○ Deploy to prod

# Phase pattern
=== Fetching build data ===
✓ Build metadata fetched

=== Fetching step logs ===
[████████░░] 8/10 steps
```

---

## Command Audit Checklist

Use this checklist when reviewing or writing commands:

### Test Scenarios
- [ ] No arguments - shows helpful usage
- [ ] Missing required arguments - clear error
- [ ] Invalid arguments - explains what's valid
- [ ] `--help` flag - complete help text
- [ ] Valid usage - correct output

### Output Quality
- [ ] Uses `SEMANTIC_COLORS` not direct chalk
- [ ] Uses `getStateIcon()` not hardcoded symbols
- [ ] Uses `formatTips()` not raw "Tip: ..." strings
- [ ] Errors use `formatError()` with suggestions
- [ ] Progress shown for operations >1 second

### Structure
- [ ] Clear visual hierarchy (header, details, stats)
- [ ] Blank lines separate logical groups
- [ ] Consistent indentation for related info
- [ ] Tips appear at end, dimmed

### Accessibility
- [ ] Tested with `NO_COLOR=1`
- [ ] Tested with `BKTIDE_ASCII=1`
- [ ] Color paired with symbols/text
- [ ] Works in piped output

### Scriptability
- [ ] Exit codes correct (0=success, 1=error)
- [ ] `--format json` produces valid JSON
- [ ] Errors go to stderr
- [ ] `--no-tips` suppresses hints

---

## Anti-Patterns

Common mistakes and fixes:

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| `logger.console(...)` with inline colors | Bypasses theme system | Use formatter + `SEMANTIC_COLORS` |
| `"Tip: ..."` raw string | Inconsistent tip style | Use `formatTips()` |
| Hardcoded `✓` or `✗` | Breaks ASCII mode | Use `getStateIcon()` |
| Direct `chalk.blue()` | Inconsistent colors | Use `SEMANTIC_COLORS.success()` |
| No progress indicator | Users wonder if hung | Use `Progress.spinner()` or `.bar()` |
| Error without suggestions | Users stuck | Use `formatError()` with suggestions |
| Color-only information | Inaccessible | Always pair with symbol/text |

---

## Case Study: Snapshot Command

The `snapshot` command has been refactored to follow the design system patterns.

### Improvements Made

1. **Formatter pattern**: Now uses `PlainTextFormatter` and `JsonFormatter` instead of direct `logger.console()` calls
2. **Shared utilities**: Uses `calculateJobStats()` from `src/utils/jobStats.ts` and `formatBuildDuration()` from `src/utils/formatUtils.ts`
3. **Tip formatting**: Uses `formatTips()` with proper `--no-tips` support
4. **Consistent styling**: Uses `SEMANTIC_COLORS` and `getStateIcon()` throughout

### Files Created

| File | Purpose |
|------|---------|
| `src/formatters/snapshot/Formatter.ts` | Types and interface definitions |
| `src/formatters/snapshot/PlainTextFormatter.ts` | Plain text output formatter |
| `src/formatters/snapshot/JsonFormatter.ts` | JSON output formatter |
| `src/formatters/snapshot/index.ts` | Factory function and exports |
| `src/utils/jobStats.ts` | Shared job statistics calculation and formatting |

### Usage Example

```typescript
import { FormatterFactory, FormatterType, SnapshotData } from '../formatters/index.js';

// Create snapshot data
const snapshotData: SnapshotData = {
  manifest,
  build,
  outputDir,
  scriptJobs,
  stepResults,
  fetchAll,
};

// Get appropriate formatter
const formatter = FormatterFactory.getFormatter(
  FormatterType.SNAPSHOT,
  options.json ? 'json' : 'plain'
);

// Format and output
const output = (formatter as any).formatSnapshot(snapshotData, {
  tips: options.tips !== false
});
logger.console(output);
```

### What It Does Well

1. **Progress feedback**: Uses spinner and progress bar for multi-step operations
2. **Exit codes**: Returns 0 for complete snapshots, 1 for partial
3. **JSON output**: `--json` flag for scripted usage
4. **Formatter pattern**: All output goes through formatters, not direct logger calls
5. **Shared utilities**: Job stats and duration formatting are reusable across commands
