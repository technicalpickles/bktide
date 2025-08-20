# Tip Display Consistency Proposal

## Current Inconsistencies

We have multiple ways of displaying tips/hints across the codebase:

### 1. Reporter.tip() Method (builds, token commands)
```
→ Use --count 6 to see more builds
→ Filter by state: --state failed
```
- Uses arrow (`→`) prefix
- Each tip is a separate line
- Dimmed text

### 2. Inline Formatter Tips (pipelines command)
```
💡 Tips:
  • Use --filter <text> to search by name or description
  • Results limited to 50 pipelines
```
- Uses lightbulb emoji (`💡`)
- Bullet points (`•`)
- Grouped under "Tips:" header
- All dimmed

### 3. Empty State Suggestions (various formatters)
```
No pipelines found

Check the organization name is correct
Verify you have access to pipelines
Run "bktide orgs" to see available organizations
```
- No icons/bullets
- Just plain dimmed text
- Commands highlighted with reset color

### 4. Error Suggestions (error formatter)
```
To fix this:
  1. Check your organization name is correct
  2. Run "bktide orgs" to see available organizations
  3. Verify your token has the correct permissions
```
- Numbered list format
- Under "To fix this:" header

### 5. Action Instructions (token formatter)
```
To configure a token:
  → Run: bktide token --store
  → Or set: BUILDKITE_API_TOKEN environment variable
```
- Arrow for action items
- Grouped under descriptive header

## Proposed Standardization

### 1. Create a Unified Tip System

#### A. TipFormatter Utility Class
Create `src/ui/tips.ts`:

```typescript
export enum TipStyle {
  HINTS = 'hints',        // General tips and suggestions
  ACTIONS = 'actions',    // Specific actions to take
  FIXES = 'fixes',        // Error recovery suggestions
  NEXT = 'next'          // Next steps after success
}

export interface TipOptions {
  style?: TipStyle;
  grouped?: boolean;      // Group under header vs individual lines
  format?: string;        // plain, json, alfred
  width?: number;         // Terminal width for box formatting
}

export class TipFormatter {
  static format(tips: string[], options?: TipOptions): string {
    const style = options?.style || TipStyle.HINTS;
    const grouped = options?.grouped ?? true;
    
    if (options?.format && options.format !== 'plain') {
      return ''; // No tips in machine formats
    }
    
    switch (style) {
      case TipStyle.HINTS:
        return grouped 
          ? this.formatGroupedHints(tips)
          : this.formatIndividualHints(tips);
          
      case TipStyle.ACTIONS:
        return this.formatActions(tips);
        
      case TipStyle.FIXES:
        return this.formatFixes(tips);
        
      case TipStyle.NEXT:
        return this.formatNextSteps(tips);
    }
  }
  
  private static formatGroupedHints(tips: string[]): string {
    const lines: string[] = [];
    lines.push(SEMANTIC_COLORS.dim('💡 Tips:'));
    tips.forEach(tip => {
      lines.push(SEMANTIC_COLORS.dim(`  • ${tip}`));
    });
    return lines.join('\n');
  }
  
  private static formatIndividualHints(tips: string[]): string {
    return tips
      .map(tip => SEMANTIC_COLORS.dim(`→ ${tip}`))
      .join('\n');
  }
  
  private static formatActions(tips: string[]): string {
    const lines: string[] = [];
    lines.push(SEMANTIC_COLORS.dim('Next steps:'));
    tips.forEach(tip => {
      lines.push(SEMANTIC_COLORS.dim(`  → ${tip}`));
    });
    return lines.join('\n');
  }
  
  private static formatFixes(tips: string[]): string {
    const lines: string[] = [];
    lines.push(SEMANTIC_COLORS.subheading('To fix this:'));
    tips.forEach((tip, i) => {
      lines.push(`  ${i + 1}. ${tip}`);
    });
    return lines.join('\n');
  }
  
  private static formatNextSteps(tips: string[]): string {
    const lines: string[] = [];
    lines.push(SEMANTIC_COLORS.dim('What\'s next:'));
    tips.forEach(tip => {
      lines.push(SEMANTIC_COLORS.dim(`  → ${tip}`));
    });
    return lines.join('\n');
  }
  
  // Fancy box format for wide terminals
  static formatBox(tips: string[], width?: number): string {
    const termWidth = width || process.stdout.columns || 80;
    
    if (termWidth < 80) {
      return this.format(tips, { grouped: true });
    }
    
    const lines: string[] = [];
    const boxWidth = Math.min(termWidth - 4, 60);
    const border = '─'.repeat(boxWidth - 10);
    
    lines.push(SEMANTIC_COLORS.dim(`┌─ Tips ${border}`));
    tips.forEach(tip => {
      lines.push(SEMANTIC_COLORS.dim(`│ • ${tip}`));
    });
    lines.push(SEMANTIC_COLORS.dim(`└${'─'.repeat(boxWidth - 1)}`));
    
    return lines.join('\n');
  }
}
```

### 2. Standardized Usage Patterns

#### Pattern A: Data Display Tips (after showing results)
```typescript
// In formatters when showing data
const hints = [];
if (pipelines.length > 20) {
  hints.push('Use --filter <text> to search by name');
}
if (options?.truncated) {
  hints.push(`Results limited to ${count}. Use --count ${count * 2} to see more`);
}

if (hints.length > 0) {
  output.push('');
  output.push(TipFormatter.format(hints, { 
    style: TipStyle.HINTS,
    grouped: true  // Use grouped format with header
  }));
}
```

#### Pattern B: Empty State Suggestions
```typescript
// In formatEmptyState
return formatEmptyState(message, [
  'Check the organization name is correct',
  'Run "bktide orgs" to see available organizations'
]);
// These remain as-is (no icons, just dimmed text)
```

#### Pattern C: Error Recovery
```typescript
// In error formatters
return formatError(message, {
  suggestions: [
    'Check your token permissions',
    'Run "bktide token --check" to verify'
  ]
});
// Uses numbered "To fix this:" format
```

#### Pattern D: Success Next Steps
```typescript
// After successful operations
const nextSteps = [
  'Verify access with: bktide token --check',
  'Explore your organizations: bktide orgs'
];
output.push(TipFormatter.format(nextSteps, {
  style: TipStyle.NEXT
}));
```

### 3. Migration Strategy

#### Phase 1: Create TipFormatter utility
- Implement the new TipFormatter class
- Add unit tests for all formatting styles
- Keep existing code working

#### Phase 2: Update Reporter class
```typescript
// Update reporter.tip() to use TipFormatter
tip(message: string | string[], options?: TipOptions): void {
  if (!this.shouldShowTips()) return;
  
  const tips = Array.isArray(message) ? message : [message];
  const formatted = TipFormatter.format(tips, {
    ...options,
    format: this.format,
    grouped: false  // Reporter shows individual tips by default
  });
  
  this.writeStdout(formatted);
}
```

#### Phase 3: Update formatters progressively
- Start with pipelines (already has grouped tips)
- Update builds to use grouped format
- Update other commands as needed

### 4. Icon/Symbol Guidelines

| Context | Icon/Symbol | Usage |
|---------|------------|-------|
| General hints | `💡` | Tips about features, options |
| Action items | `→` | Commands to run, steps to take |
| Bullet points | `•` | List items within grouped tips |
| Error fixes | `1. 2. 3.` | Numbered steps to resolve |
| Success | `✓` | Confirmation (not for tips) |
| Warning | `⚠` | Caution (not for tips) |

### 5. Formatting Rules

1. **Grouping**: 
   - Group related tips under a header when showing 3+ tips
   - Use individual lines for 1-2 tips
   
2. **Placement**:
   - Tips appear AFTER data display
   - Empty state suggestions are part of the empty message
   - Error suggestions are part of error display
   
3. **Color**:
   - All tips use `SEMANTIC_COLORS.dim()` for de-emphasis
   - Commands within tips can use `chalk.reset()` for emphasis
   
4. **Suppression**:
   - No tips in JSON/Alfred formats
   - No tips when piped/redirected
   - Respect --quiet flag

## Benefits

1. **Consistency**: Users see predictable tip formatting
2. **Flexibility**: Different styles for different contexts
3. **Maintainability**: Single source of truth for tip formatting
4. **Accessibility**: Clear visual hierarchy
5. **Extensibility**: Easy to add new tip styles

## Implementation Priority

1. **High**: Create TipFormatter utility (enables consistency)
2. **Medium**: Update commands with most tips (builds, pipelines)
3. **Low**: Update remaining commands over time

## Questions to Consider

1. Should we use emoji in ASCII mode? (Currently we don't)
2. Should grouped tips have a max width for readability?
3. Should we support tip categories (e.g., "Performance Tips", "Navigation Tips")?
4. Should tips be collapsible in future interactive mode?
