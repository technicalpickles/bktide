# Pipelines Command Hints Implementation Plan

## Current State Analysis

The `bktide pipelines` command currently has minimal hints:
- Only shows `Use --org to filter to a specific organization` when displaying multiple organizations (line 125)
- Empty state shows basic suggestions about checking organization name and permissions
- No hints about available actions or advanced features

## Proposed Hints Structure

Based on the visual design system and patterns from other commands (builds, annotations, token), here are the applicable hints for pipelines:

### 1. **Empty State Hints** (No pipelines found)

#### When filtering by specific organization:
```typescript
formatEmptyState(
  `No pipelines found in organization ${SEMANTIC_COLORS.label(organizations[0])}`,
  [
    'Check the organization name is correct',
    'Verify you have access to pipelines in this organization',
    'Run "bktide orgs" to see available organizations'
  ]
)
```

#### When searching across all organizations:
```typescript
formatEmptyState(
  'No pipelines found across any accessible organizations',
  [
    'Check your API token has the correct permissions', 
    'Run "bktide token --check" to verify your access',
    'Some organizations may not have any pipelines configured'
  ]
)
```

#### When filter returns no results:
```typescript
formatEmptyState(
  `No pipelines match filter '${options.filterText}'`,
  [
    'Try a broader search term',
    'The filter searches pipeline names, slugs, and descriptions',
    'Remove the filter to see all pipelines'
  ]
)
```

### 2. **Data State Hints** (Pipelines displayed)

After the table/list, add contextual hints based on the results:

#### When showing many pipelines (>20):
```typescript
// After summary line
lines.push('');
lines.push(SEMANTIC_COLORS.dim('💡 Tips:'));
lines.push(SEMANTIC_COLORS.dim(`  • Use --filter <text> to search by name or description`));
lines.push(SEMANTIC_COLORS.dim(`  • Use --count ${Math.min(pipelines.length * 2, 100)} to see more pipelines`));
```

#### When showing pipelines from multiple organizations:
```typescript
lines.push('');
lines.push(SEMANTIC_COLORS.dim('💡 Tips:'));
lines.push(SEMANTIC_COLORS.dim('  • Use --org <name> to focus on a specific organization'));
lines.push(SEMANTIC_COLORS.dim('  • Pipeline slugs are unique within each organization'));
```

#### When filter is active:
```typescript
if (options.filterActive) {
  lines.push(SEMANTIC_COLORS.dim(`  • Showing pipelines matching '${options.filterText}'`));
  lines.push(SEMANTIC_COLORS.dim('  • Remove --filter to see all pipelines'));
}
```

#### When results are truncated (--count limit reached):
```typescript
if (options.truncated) {
  const nextCount = Math.min(parseInt(options.count) * 2, 500);
  lines.push(SEMANTIC_COLORS.dim(`  • Results limited to ${options.count} pipelines`));
  lines.push(SEMANTIC_COLORS.dim(`  • Use --count ${nextCount} to see more`));
}
```

### 3. **Error State Hints**

#### Access denied:
```typescript
formatError('Access denied to organization pipelines', {
  showHelp: true,
  helpCommand: 'bktide pipelines --help',
  suggestions: [
    'Check your organization name is correct',
    'Run "bktide orgs" to see available organizations',
    'Verify your token has the correct permissions'
  ]
})
```

#### API errors:
```typescript
formatError('Failed to fetch pipelines from Buildkite', {
  showHelp: true,
  helpCommand: 'bktide pipelines --help',
  suggestions: [
    'This might be a temporary issue. Try again in a moment.',
    'Check your network connection',
    'Run "bktide token --check" to verify API access'
  ]
})
```

## Implementation Changes Required

### 1. Update PlainTextFormatter (src/formatters/pipelines/PlainTextFormatter.ts)

- Enhance empty state messages with context-aware suggestions
- Add tips section after data display (similar to builds formatter)
- Pass additional context through FormatterOptions

### 2. Update ListPipelines Command (src/commands/ListPipelines.ts)

- Pass more context to formatter:
  - `filterActive`: whether filter was applied
  - `filterText`: the filter text used
  - `truncated`: whether results were limited by --count
  - `totalBeforeFilter`: count before filter applied
  - `hasError`: for error handling
  - `errorType`: specific error type
  - `errorMessage`: detailed error message

### 3. Update Formatter Interface (src/formatters/pipelines/Formatter.ts)

Add PipelineFormatterOptions interface:
```typescript
export interface PipelineFormatterOptions extends FormatterOptions {
  filterActive?: boolean;
  filterText?: string;
  truncated?: boolean;
  totalBeforeFilter?: number;
  organizationsCount?: number;
  orgSpecified?: boolean;
  hasError?: boolean;
  errorType?: 'access' | 'not_found' | 'api' | 'generic';
  errorMessage?: string;
}
```

## Priority Order

1. **High Priority** (improves discoverability):
   - Add filter hints when many pipelines shown
   - Add --count hints when results truncated
   - Enhance empty state messages

2. **Medium Priority** (improves context):
   - Add organization-specific hints
   - Show filter context when active
   - Add error state handling

3. **Low Priority** (nice to have):
   - Add hints about pipeline URLs
   - Suggest related commands (builds, annotations)

## Testing Scenarios

1. **Empty states:**
   - No pipelines in specific org
   - No pipelines across all orgs
   - Filter returns no results

2. **Data states:**
   - Single org with few pipelines (< 10)
   - Single org with many pipelines (> 20)
   - Multiple orgs with pipelines
   - Filter active with results
   - Results truncated by --count

3. **Error states:**
   - Invalid organization name
   - API connection issues
   - Token permission issues

## Success Criteria

- [ ] Hints appear after data, not before
- [ ] Hints are contextually relevant to the results shown
- [ ] Hints use SEMANTIC_COLORS.dim() for de-emphasis
- [ ] Empty states provide actionable suggestions
- [ ] Error states guide users to resolution
- [ ] No redundant or obvious hints
- [ ] Hints follow the visual design system

## Example Output

### Many pipelines from multiple orgs:
```
PIPELINES                                                                
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ORGANIZATION    NAME                        SLUG
gusto           Frontend App                frontend-app
gusto           Backend API                 backend-api
gusto           Mobile App                  mobile-app
[... 47 more rows ...]

50 pipelines across 3 organizations

💡 Tips:
  • Use --org <name> to focus on a specific organization
  • Use --filter <text> to search by name or description
  • Results limited to 50 pipelines. Use --count 100 to see more
```

### Filtered results:
```
PIPELINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NAME                        SLUG
Frontend App                frontend-app
Frontend Tests              frontend-tests

2 pipelines in gusto matching 'frontend'

💡 Tips:
  • Remove --filter to see all pipelines
  • The filter searches names, slugs, and descriptions
```
