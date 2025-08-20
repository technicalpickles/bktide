# UI Design System

**Status**: ✅ **Implemented** - This design system is fully implemented in `src/ui/theme.ts` and used throughout the CLI.

## Overview

The bktide CLI uses a comprehensive visual design system that enhances information hierarchy, improves scannability, and maintains accessibility. The system uses color, typography, and formatting strategically to guide user attention and convey meaning quickly.

## Design Principles

### 1. **Progressive Disclosure**
- Primary information (data) is prominent
- Secondary information (tips, hints) is subdued
- Error states demand attention

### 2. **Semantic Color Usage**
- Colors convey meaning, not just decoration
- Consistent color mapping across all commands
- Colorblind-safe palette

### 3. **Visual Hierarchy**
- Bold headings for sections
- Regular weight for data
- Dim/muted for auxiliary information
- High contrast for critical information

### 4. **Accessibility First**
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
