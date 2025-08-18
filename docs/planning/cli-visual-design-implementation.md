# CLI Visual Design - Implementation Roadmap

## Quick Start Guide

This document provides step-by-step implementation instructions for the visual design improvements.

## Phase 1: Theme System Update (Day 1-2)

### Step 1: Backup Current Theme
```bash
cp src/ui/theme.ts src/ui/theme-backup.ts
```

### Step 2: Integrate Enhanced Theme
1. Copy `theme-v2.ts` concepts into `theme.ts`
2. Keep backward compatibility exports
3. Add new semantic color functions

### Step 3: Update Dependencies
```typescript
// Ensure chalk is up-to-date
npm install chalk@latest
```

### Step 4: Test Theme Functions
```typescript
// Create test file: src/ui/theme.test.manual.ts
import { SEMANTIC_COLORS, formatBuildStatus } from './theme.js';

console.log(SEMANTIC_COLORS.heading('Test Heading'));
console.log(formatBuildStatus('PASSED'));
console.log(formatBuildStatus('FAILED'));
// Run: npm run build && node dist/ui/theme.test.manual.js
```

## Phase 2: Build Status Colors (Day 3-4)

### Step 1: Update Build Formatter
```typescript
// src/formatters/builds/PlainTextFormatter.ts

// Add at top
import { formatBuildStatus, SEMANTIC_COLORS } from '../../ui/theme.js';

// Update formatBuilds method:
// Replace: b.state || 'Unknown'
// With: formatBuildStatus(b.state || 'UNKNOWN', { useSymbol: false })
```

### Step 2: Add Header Emphasis
```typescript
// In formatBuilds, update header:
const headers = ['PIPELINE', 'NUMBER', 'STATE', 'BRANCH'].map(
  h => SEMANTIC_COLORS.label(h)
);
```

### Step 3: Test Build Display
```bash
# Test with real data
bin/bktide builds --count 5

# Test without colors
NO_COLOR=1 bin/bktide builds

# Test with debug
bin/bktide builds --debug
```

## Phase 3: Tip Management (Day 5-6)

### Step 1: Move Tips to End
```typescript
// src/commands/ListBuilds.ts

// After formatter output:
logger.console(output);

// THEN show tips (not before):
if (allBuilds.length > 0 && !options.quiet) {
  this.showTips(allBuilds, options);
}
```

### Step 2: Dim Tip Display
```typescript
// src/ui/reporter.ts

tip(message: string): void {
  if (!this.quiet && shouldDecorate(this.format)) {
    // Use dim for tips
    logger.console(SEMANTIC_COLORS.tip(`💡 ${message}`));
  }
}
```

### Step 3: Remove Redundant Messages
```typescript
// In each command's execute method:
// Remove: reporter.success('X retrieved');
// The data display itself is confirmation enough
```

## Phase 4: All Formatters Update (Day 7-10)

### Organizations Formatter
```typescript
// src/formatters/organizations/PlainTextFormatter.ts

formatOrganizations(orgs: Organization[]): string {
  const lines: string[] = [];
  
  // Add section header
  lines.push(SEMANTIC_COLORS.heading('Your Organizations'));
  lines.push('');
  
  // Bold headers
  const headers = ['NAME', 'SLUG', 'PIPELINES'].map(
    h => SEMANTIC_COLORS.label(h)
  );
  
  // ... rest of implementation
}
```

### Pipelines Formatter
```typescript
// Similar pattern:
// - Section header with emphasis
// - Bold column headers
// - Semantic colors for counts
// - Dimmed auxiliary information
```

### Annotations Formatter
```typescript
// Use status symbols for annotation styles:
const ANNOTATION_SYMBOLS = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
  success: '✓'
};
```

## Phase 5: Error Handling (Day 11-12)

### Step 1: Update Error Formatter
```typescript
// src/formatters/errors/PlainTextFormatter.ts

formatError(action: string, error: unknown): string {
  return formatError(error, {
    showHelp: true,
    helpCommand: 'bktide --help',
    suggestions: this.getErrorSuggestions(error)
  });
}
```

### Step 2: Consistent Error Display
```typescript
// In BaseCommand.handleError:
const formatter = this.getFormatter(FormatterType.ERROR, options);
const output = formatter.formatError('executing command', error);
logger.console(output);
```

## Phase 6: Testing & Validation (Day 13-14)

### Automated Tests
```bash
# Create visual regression tests
npm test -- --grep "visual"

# Test color output
npm test -- --grep "theme"

# Test formatters
npm test -- --grep "formatter"
```

### Manual Testing Checklist
```bash
# 1. Test each command with colors
for cmd in orgs pipelines builds annotations viewer token; do
  echo "Testing: $cmd"
  bin/bktide $cmd
done

# 2. Test without colors
NO_COLOR=1 bin/bktide builds

# 3. Test ASCII mode
BKTIDE_ASCII=1 bin/bktide builds

# 4. Test in narrow terminal
printf '\e[8;24;60t' # Resize to 60 columns
bin/bktide builds

# 5. Test with different formats
bin/bktide builds --format json
bin/bktide builds --format plain
```

### Terminal Compatibility Testing
```bash
# Test in different terminals:
# - macOS: Terminal.app, iTerm2
# - Linux: gnome-terminal, konsole  
# - Windows: Windows Terminal, ConEmu
# - VS Code: Integrated terminal

# Test with different themes:
# - Dark: Dracula, One Dark, Nord
# - Light: Solarized Light, GitHub Light
# - High Contrast: Windows High Contrast
```

## Phase 7: Documentation (Day 15)

### Update README
```markdown
## Visual Features

- **Color-coded build statuses** for quick scanning
- **Colorblind-safe palette** with symbols
- **Clear information hierarchy** with emphasis levels
- **Responsive formatting** adapts to terminal width
- **NO_COLOR support** for accessibility
```

### Add to Help Text
```typescript
// In src/ui/help.ts
const colorHelp = `
Status Indicators:
  ✓ PASSED   Success (blue)
  ✖ FAILED   Error (orange)
  ↻ RUNNING  Active (cyan)
  ⚠ BLOCKED  Warning (yellow)
  
Environment Variables:
  NO_COLOR=1         Disable colors
  BKTIDE_ASCII=1     Use ASCII symbols
  BKTIDE_COLOR_MODE  Set to: auto|always|never
`;
```

## Rollback Plan

If issues arise:

### Quick Rollback
```bash
# Revert theme changes
git checkout HEAD~1 src/ui/theme.ts

# Revert formatter changes
git checkout HEAD~1 src/formatters/
```

### Feature Flag Approach
```typescript
// Add feature flag
const USE_ENHANCED_THEME = process.env.BKTIDE_ENHANCED_THEME !== '0';

if (USE_ENHANCED_THEME) {
  // New visual design
} else {
  // Original formatting
}
```

## Performance Monitoring

### Measure Formatting Impact
```typescript
// Add timing to formatters
const start = performance.now();
const output = formatter.format(data);
const duration = performance.now() - start;

if (duration > 50) {
  logger.warn(`Slow formatting: ${duration}ms`);
}
```

### Memory Usage Check
```bash
# Monitor memory usage
/usr/bin/time -l bin/bktide builds --count 100

# Profile with Node.js
node --inspect dist/index.js builds --count 100
```

## Success Validation

### Week 1 Goals
- [ ] Theme system updated
- [ ] Build status colors working
- [ ] Tips moved to end and dimmed
- [ ] Headers emphasized

### Week 2 Goals  
- [ ] All formatters updated
- [ ] Error formatting improved
- [ ] Empty states enhanced
- [ ] Responsive width handling

### Week 3 Goals
- [ ] Documentation complete
- [ ] Testing comprehensive
- [ ] Performance validated
- [ ] User feedback collected

## Common Issues & Solutions

### Issue: Colors Not Showing
```bash
# Check:
echo $TERM  # Should be xterm-256color or similar
echo $NO_COLOR  # Should be empty
echo $BKTIDE_COLOR_MODE  # Should be auto or empty

# Fix:
export TERM=xterm-256color
unset NO_COLOR
```

### Issue: Symbols Show as Boxes
```bash
# Terminal doesn't support Unicode
# Solution: Use ASCII mode
export BKTIDE_ASCII=1
```

### Issue: Text Wrapping Issues
```bash
# Check terminal width
echo $COLUMNS

# Solution: Responsive formatting handles this
# Or manually set:
export COLUMNS=80
```

## Final Checklist

Before marking complete:

- [ ] All commands use new visual system
- [ ] Colors are colorblind-safe
- [ ] Symbols have ASCII fallbacks
- [ ] Tips appear after data
- [ ] No redundant messages
- [ ] Headers are emphasized
- [ ] Errors are prominent
- [ ] Empty states are helpful
- [ ] Performance impact < 50ms
- [ ] Documentation updated
- [ ] Tests pass
- [ ] User feedback positive

## Support & Questions

For implementation questions:
1. Check visual design documents in `docs/planning/`
2. Review examples in `cli-visual-design-examples.md`
3. Test in multiple terminals
4. Gather user feedback early and often
