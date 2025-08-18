# CLI Visual Design System

## Executive Summary

This document outlines a comprehensive visual design system for the bktide CLI that enhances information hierarchy, improves scannability, and maintains accessibility. The system uses color, typography, and formatting strategically to guide user attention and convey meaning quickly.

## Design Principles

### 1. **Progressive Disclosure**
- Primary information (data) is prominent
- Secondary information (tips, hints) is subdued
- Error states demand attention

### 2. **Semantic Color Usage**
- Colors convey meaning, not just decoration
- Consistent color mapping across all commands
- Colorblind-safe palette (already implemented)

### 3. **Visual Hierarchy**
- Bold headings for sections
- Regular weight for data
- Dim/muted for auxiliary information
- High contrast for critical information

### 4. **Accessibility First**
- Never rely solely on color to convey information
- Always pair colors with symbols/text
- Support NO_COLOR and ASCII modes

## Color Semantic System

### Build Status Colors

Based on industry standards (Git, GitHub Actions, Jenkins, CircleCI):

```typescript
const BUILD_STATUS_COLORS = {
  // Success states - Blue (colorblind-safe)
  PASSED: chalk.blue,        // ✓ Clear success
  
  // Failure states - Orange (not red, colorblind-safe)  
  FAILED: chalk.rgb(255, 140, 0),  // ✖ Clear failure
  FAILING: chalk.rgb(255, 165, 0), // ⚠ In process of failing
  
  // Warning states - Yellow
  BLOCKED: chalk.yellow,      // ⚠ Needs attention
  CANCELED: chalk.yellow,     // ⚠ User intervention
  
  // Active states - Cyan
  RUNNING: chalk.cyan,        // ↻ In progress
  SCHEDULED: chalk.cyan,      // ⏱ Queued
  
  // Inactive states - Gray
  SKIPPED: chalk.gray,        // - Not relevant
  NOT_RUN: chalk.gray,        // - Not executed
}
```

### Information Type Colors

```typescript
const INFO_COLORS = {
  // Headings & Labels
  heading: chalk.bold.underline,     // **Section Headers**
  label: chalk.bold,                  // Field labels
  
  // Data values
  primary: chalk.reset,               // Main data (default color)
  secondary: chalk.dim,               // Less important data
  
  // Metadata
  count: chalk.magenta,              // Numbers, counts
  identifier: chalk.cyan,            // IDs, URLs, references
  
  // Auxiliary information  
  tip: chalk.dim,                    // Tips, hints
  help: chalk.dim.italic,            // Help text
  
  // Status messages
  success: chalk.blue,               // ✓ Operation succeeded
  warning: chalk.yellow,             // ⚠ Caution needed
  error: chalk.rgb(255, 140, 0),    // ✖ Error occurred
  info: chalk.cyan,                  // ℹ Informational
}
```

## Typography & Formatting Patterns

### 1. Headers and Section Titles

```typescript
// Main section headers
chalk.bold.underline('Your Organizations:')
chalk.bold.underline('Build Results:')
chalk.bold.underline('Pipeline Configuration:')

// Sub-headers (no underline)
chalk.bold('Details:')
chalk.bold('Recent Activity:')
```

### 2. Data Tables

```typescript
// Table headers - Bold for emphasis
['PIPELINE', 'NUMBER', 'STATE', 'BRANCH'].map(h => chalk.bold(h))

// Table data - Colored by semantic meaning
[
  pipeline.slug,                              // Regular
  chalk.cyan(`#${build.number}`),            // Identifier
  BUILD_STATUS_COLORS[build.state](build.state), // Status color
  build.branch || chalk.dim('(no branch)')   // Regular or dim
]
```

### 3. Status Messages

```typescript
// During operation
chalk.cyan('↻') + ' Fetching builds...'

// Success (subtle, not redundant)
chalk.blue('✓') + ' Ready'

// With counts
chalk.blue('✓') + ` Found ${chalk.magenta(count)} ${type}`

// Errors (prominent)
chalk.rgb(255, 140, 0)('✖') + chalk.bold(' Error: ') + message
```

### 4. Tips and Help Text

```typescript
// Tips - dimmed and clearly marked
chalk.dim('💡 Tip: ') + chalk.dim('Use --count 20 to see more')

// Alternative: Box-style tips at the end
chalk.dim('┌─ Tips ────────────────────────────')
chalk.dim('│ • Use --count 20 for more results')  
chalk.dim('│ • Filter with --state failed')
chalk.dim('│ • Try --branch main')
chalk.dim('└────────────────────────────────────')

// Inline help
chalk.dim.italic('(use --help for more options)')
```

### 5. Empty States

```typescript
// No results - Clear but not alarming
chalk.dim('No builds found.')
chalk.dim(`Try ${chalk.reset('--org gusto')} to specify an organization`)

// With context
`No builds found for ${chalk.bold(userName)}`
chalk.dim('Try adjusting your filters or time range')
```

## Implementation Examples

### Example 1: Builds List

```
Builds                                    <- chalk.bold.underline
─────────────────────────────────────────

PIPELINE     NUMBER   STATE      BRANCH    <- chalk.bold (headers)
payments     #1234    ✓ PASSED   main      <- chalk.blue for PASSED
api-server   #5678    ✖ FAILED   fix-bug   <- chalk.rgb(255,140,0) for FAILED  
frontend     #9101    ↻ RUNNING  develop   <- chalk.cyan for RUNNING

Found 3 builds                            <- chalk.dim

💡 Use --count 20 to see more             <- chalk.dim
💡 Filter by state with --state failed    <- chalk.dim
```

### Example 2: Organization View

```
Your Organizations                        <- chalk.bold.underline
──────────────────────────────────────────

NAME                  SLUG       PIPELINES <- chalk.bold
Gusto                 gusto      42        <- regular, chalk.magenta(42)
Personal Workspace    personal   3         <- regular, chalk.magenta(3)

2 organizations accessible                <- chalk.dim
```

### Example 3: Error State

```
✖ Error: Authentication Failed            <- chalk.rgb(255,140,0) + chalk.bold

The provided token is invalid or expired.

To fix this:
  1. Get a new token from Buildkite
  2. Run: bktide token --store
  3. Try your command again

Need help? Run: bktide token --help      <- chalk.dim.italic
```

## Visual Hierarchy Levels

### Level 1: Critical (Highest Priority)
- **Use:** Errors, failures, urgent warnings
- **Style:** `chalk.rgb(255, 140, 0)` (orange) + `chalk.bold`
- **Symbol:** ✖ or ⚠

### Level 2: Primary Information
- **Use:** Main data, headings, key results
- **Style:** `chalk.bold.underline` for headers, `chalk.bold` for labels
- **Symbol:** None needed

### Level 3: Standard Information  
- **Use:** Regular data values, normal text
- **Style:** Default terminal color
- **Symbol:** Contextual (✓, •, →)

### Level 4: Secondary Information
- **Use:** Supplementary data, counts, metadata
- **Style:** Semantic colors (cyan for IDs, magenta for counts)
- **Symbol:** None

### Level 5: Auxiliary (Lowest Priority)
- **Use:** Tips, hints, help text, empty states
- **Style:** `chalk.dim` or `chalk.gray`
- **Symbol:** 💡 for tips (also dimmed)

## Responsive Design Considerations

### Terminal Width Awareness

```typescript
// Adapt formatting based on terminal width
const width = process.stdout.columns || 80;

if (width < 60) {
  // Compact mode - fewer colors, simpler layout
  return compactFormatter(data);
} else if (width < 100) {
  // Standard mode - balanced
  return standardFormatter(data);  
} else {
  // Wide mode - can show more columns, use more decoration
  return wideFormatter(data);
}
```

### Color Mode Detection

```typescript
// Already implemented in theme.ts
const colorEnabled = !process.env.NO_COLOR && 
                     process.env.BKTIDE_COLOR_MODE !== 'never' &&
                     process.stdout.isTTY;

// Graceful degradation
if (!colorEnabled) {
  // Use symbols and formatting only
  return '[PASSED]' instead of colored 'PASSED'
  return '**Heading**' instead of bold.underline
}
```

## Testing & Validation

### Accessibility Testing

1. **Colorblind Simulation**
   - Test with `NO_COLOR=1` environment variable
   - Ensure all information is conveyed without color
   - Verify symbols provide sufficient distinction

2. **Screen Reader Compatibility**
   - ASCII mode (`--ascii`) for screen readers
   - Clear, descriptive text without relying on Unicode

3. **Terminal Compatibility**
   - Test in different terminals (iTerm2, Terminal.app, Windows Terminal)
   - Verify in both light and dark themes
   - Test with different color schemes (Solarized, Dracula, etc.)

### User Testing Checklist

- [ ] Can users quickly identify build failures?
- [ ] Are tips clearly secondary to main content?
- [ ] Do headings create clear sections?
- [ ] Is the hierarchy clear without colors?
- [ ] Do status colors match user expectations?
- [ ] Are errors immediately noticeable?
- [ ] Is auxiliary information appropriately de-emphasized?

## Migration Strategy

### Phase 1: Foundation (Immediate)
1. Update `theme.ts` with semantic color mappings
2. Add typography helpers (bold, underline, dim)
3. Implement BUILD_STATUS_COLORS

### Phase 2: Core Commands (Week 1)
1. Update build formatters with status colors
2. Add bold headers to all formatters
3. Dim all tips and auxiliary text
4. Remove redundant success messages

### Phase 3: Polish (Week 2)
1. Add responsive width handling
2. Implement fancy tip boxes for wide terminals
3. Add subtle animations for spinners
4. Fine-tune color values based on feedback

### Phase 4: Advanced (Future)
1. Theme customization support
2. User-defined color mappings
3. Export color schemes for other tools
4. Integration with terminal theme detection

## Code Examples

### Updated Theme Module

```typescript
// src/ui/theme.ts
import chalk from 'chalk';

// Semantic colors for different information types
export const SEMANTIC_COLORS = {
  // Status colors (colorblind-safe)
  success: (s: string) => chalk.blue(s),
  error: (s: string) => chalk.rgb(255, 140, 0)(s),
  warning: (s: string) => chalk.yellow(s),
  info: (s: string) => chalk.cyan(s),
  
  // Typography emphasis
  heading: (s: string) => chalk.bold.underline(s),
  label: (s: string) => chalk.bold(s),
  
  // Data types
  identifier: (s: string) => chalk.cyan(s),
  count: (s: string) => chalk.magenta(s),
  
  // De-emphasis
  dim: (s: string) => chalk.dim(s),
  muted: (s: string) => chalk.gray(s),
  tip: (s: string) => chalk.dim(s),
};

// Build status specific colors
export const BUILD_STATUS_THEME = {
  PASSED: SEMANTIC_COLORS.success,
  FAILED: SEMANTIC_COLORS.error,
  FAILING: (s: string) => chalk.rgb(255, 165, 0)(s),
  BLOCKED: SEMANTIC_COLORS.warning,
  CANCELED: SEMANTIC_COLORS.warning,
  RUNNING: SEMANTIC_COLORS.info,
  SCHEDULED: SEMANTIC_COLORS.info,
  SKIPPED: SEMANTIC_COLORS.muted,
  NOT_RUN: SEMANTIC_COLORS.muted,
};
```

### Updated Build Formatter

```typescript
// src/formatters/builds/PlainTextFormatter.ts
formatBuilds(builds: Build[]): string {
  const lines: string[] = [];
  
  // Section header with emphasis
  lines.push(SEMANTIC_COLORS.heading('Build Results'));
  lines.push(''); // spacing
  
  // Table with colored elements
  const headers = ['PIPELINE', 'NUMBER', 'STATE', 'BRANCH'].map(
    h => SEMANTIC_COLORS.label(h)
  );
  
  const rows = builds.map(build => [
    build.pipeline?.slug || SEMANTIC_COLORS.dim('unknown'),
    SEMANTIC_COLORS.identifier(`#${build.number}`),
    BUILD_STATUS_THEME[build.state]?.(build.state) || build.state,
    build.branch || SEMANTIC_COLORS.dim('(no branch)')
  ]);
  
  lines.push(renderTable([headers, ...rows]));
  lines.push('');
  
  // Summary in dimmed text
  lines.push(SEMANTIC_COLORS.dim(`Found ${builds.length} builds`));
  
  // Tips at the end, clearly auxiliary
  if (builds.length >= 10) {
    lines.push('');
    lines.push(SEMANTIC_COLORS.tip('💡 Tip: Use --count 20 to see more'));
  }
  
  return lines.join('\n');
}
```

## Success Metrics

1. **Scannability**: Users can identify key information in < 2 seconds
2. **Error Recognition**: Failed builds spotted immediately 
3. **Hierarchy Clarity**: 90% of users correctly identify primary vs auxiliary info
4. **Accessibility**: 100% functionality without color
5. **Consistency**: Same patterns across all commands
6. **Performance**: No noticeable delay from formatting

## References

- [Chalk Documentation](https://github.com/chalk/chalk)
- [WCAG Color Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum)
- [Terminal Color Standards](https://en.wikipedia.org/wiki/ANSI_escape_code)
- [Colorblind-Safe Palettes](https://colorbrewer2.org)
- [CLI Design Guidelines](https://clig.dev)
