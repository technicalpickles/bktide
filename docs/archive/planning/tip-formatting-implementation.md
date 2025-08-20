# Tip Formatting Implementation in theme.ts

## Why theme.ts is the Right Place

1. **Already the formatting hub**: Contains all other formatting utilities
2. **Has existing `formatTipBox`**: We can enhance/expand it
3. **Single source of truth**: Keep all UI formatting together
4. **Semantic fit**: Tips are a theme/UI concern
5. **Already imported everywhere**: No new dependencies

## Proposed Implementation

### 1. Enhance Existing formatTipBox

```typescript
// In src/ui/theme.ts

export enum TipStyle {
  GROUPED = 'grouped',     // 💡 Tips: with bullets
  INDIVIDUAL = 'individual', // → Individual arrows
  ACTIONS = 'actions',     // Next steps: with arrows
  FIXES = 'fixes',         // To fix this: numbered
  BOX = 'box'             // Fancy box (wide terminals)
}

/**
 * Format tips with consistent styling based on context
 */
export function formatTips(
  tips: string[], 
  style: TipStyle = TipStyle.GROUPED
): string {
  if (tips.length === 0) return '';
  
  switch (style) {
    case TipStyle.GROUPED:
      return formatGroupedTips(tips);
    case TipStyle.INDIVIDUAL:
      return formatIndividualTips(tips);
    case TipStyle.ACTIONS:
      return formatActionTips(tips);
    case TipStyle.FIXES:
      return formatFixTips(tips);
    case TipStyle.BOX:
      return formatTipBox(tips); // Use existing function
    default:
      return formatGroupedTips(tips);
  }
}

function formatGroupedTips(tips: string[]): string {
  const lines: string[] = [];
  lines.push(SEMANTIC_COLORS.dim('💡 Tips:'));
  tips.forEach(tip => {
    lines.push(SEMANTIC_COLORS.dim(`  • ${tip}`));
  });
  return lines.join('\n');
}

function formatIndividualTips(tips: string[]): string {
  return tips
    .map(tip => SEMANTIC_COLORS.dim(`→ ${tip}`))
    .join('\n');
}

function formatActionTips(tips: string[]): string {
  const lines: string[] = [];
  lines.push(SEMANTIC_COLORS.dim('Next steps:'));
  tips.forEach(tip => {
    lines.push(SEMANTIC_COLORS.dim(`  → ${tip}`));
  });
  return lines.join('\n');
}

function formatFixTips(tips: string[]): string {
  const lines: string[] = [];
  lines.push(SEMANTIC_COLORS.subheading('To fix this:'));
  tips.forEach((tip, i) => {
    lines.push(`  ${i + 1}. ${tip}`);
  });
  return lines.join('\n');
}

// Keep existing formatTipBox for fancy formatting
```

### 2. Update formatError to Use It

```typescript
export function formatError(
  error: string | Error, 
  options?: { 
    showHelp?: boolean; 
    helpCommand?: string;
    suggestions?: string[];
  }
): string {
  const lines: string[] = [];
  const symbols = getSymbols();
  
  // Error header
  lines.push(`${SEMANTIC_COLORS.error(symbols.error)} ${chalk.bold('Error')}`);
  lines.push('');
  
  // Error message
  const message = typeof error === 'string' ? error : error.message;
  lines.push(message);
  
  // Use new formatTips for suggestions
  if (options?.suggestions && options.suggestions.length > 0) {
    lines.push('');
    lines.push(formatTips(options.suggestions, TipStyle.FIXES));
  }
  
  // Help command
  if (options?.showHelp && options?.helpCommand) {
    lines.push('');
    lines.push(SEMANTIC_COLORS.help(`Need help? Run: ${options.helpCommand}`));
  }
  
  return lines.join('\n');
}
```

### 3. Update Reporter to Use theme.ts

```typescript
// In src/ui/reporter.ts
import { formatTips, TipStyle, SEMANTIC_COLORS } from './theme.js';

export class Reporter {
  tip(message: string | string[]): void {
    if (!this.shouldShowTips()) return;
    
    const tips = Array.isArray(message) ? message : [message];
    // Reporter uses individual style by default
    const formatted = formatTips(tips, TipStyle.INDIVIDUAL);
    this.writeStdout(formatted);
  }
  
  // New method for grouped tips
  tips(messages: string[], style?: TipStyle): void {
    if (!this.shouldShowTips()) return;
    
    const formatted = formatTips(messages, style || TipStyle.GROUPED);
    this.writeStdout(formatted);
  }
}
```

### 4. Update Formatters to Use It

```typescript
// In pipelines formatter
import { formatTips, TipStyle } from '../../ui/theme.js';

// Instead of manual formatting:
if (hints.length > 0) {
  output.push('');
  output.push(formatTips(hints, TipStyle.GROUPED));
}
```

## Migration Path

### Phase 1: Add to theme.ts (Non-breaking)
1. Add `TipStyle` enum
2. Add `formatTips()` function
3. Add helper functions
4. Keep existing functions working

### Phase 2: Update High-Traffic Commands
1. Update pipelines formatter (already has grouped tips)
2. Update builds command (via reporter)
3. Update token command

### Phase 3: Gradual Migration
1. Update other formatters as touched
2. Deprecate direct SEMANTIC_COLORS.dim() for tips
3. Eventually remove duplication

## Benefits of Using theme.ts

1. **No new files**: Everything stays in the existing structure
2. **Backwards compatible**: Existing code continues to work
3. **Centralized**: All formatting in one place
4. **Consistent imports**: Everyone already imports from theme.ts
5. **Type safety**: Single source for TipStyle enum

## Example Usage After Implementation

```typescript
// Simple tips
output.push(formatTips(['Use --count 20 to see more']));

// Action items
output.push(formatTips([
  'Run: bktide token --check',
  'Run: bktide orgs'
], TipStyle.ACTIONS));

// Error recovery
throw formatError('Access denied', {
  suggestions: [
    'Check your token',
    'Verify permissions'
  ]
});

// Fancy box (auto-detects terminal width)
output.push(formatTips(hints, TipStyle.BOX));
```

## Testing Considerations

1. Test all TipStyle variations
2. Test with NO_COLOR=1
3. Test in non-TTY environments
4. Test empty tips array
5. Test single vs multiple tips
