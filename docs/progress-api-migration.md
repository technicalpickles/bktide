# Progress API Migration Examples

## Current vs New API

### Simple Spinner (Most Common - 11 uses)

**Before:**
```typescript
const spinner = createSpinner(format);
spinner.start('Fetching data...');
// ... do work
spinner.stop();
```

**After:**
```typescript
const progress = Progress.spinner('Fetching data...', { format });
// ... do work
progress.stop();
```

Or even simpler:
```typescript
await withProgress(
  async (progress) => {
    // ... do work
  },
  { label: 'Fetching data...', format }
);
```

### Progress Bar (5 uses)

**Before:**
```typescript
const progress = new ProgressBar({
  total: items.length,
  label: 'Processing',
  showPercentage: true,
  showCounts: true,
  format: format
});
progress.start();
for (let i = 0; i < items.length; i++) {
  progress.update(i, `Item ${i}`);
  // ... process item
}
progress.complete('Done');
```

**After:**
```typescript
const progress = Progress.bar({
  total: items.length,
  label: 'Processing',
  format
});
for (let i = 0; i < items.length; i++) {
  progress.update(i, `Item ${i}`);
  // ... process item
}
progress.complete('Done');
```

### Smart Detection

**New capability:**
```typescript
// Automatically chooses bar or spinner based on options
const progress = Progress.create({
  total: items?.length,  // If provided, creates bar
  label: 'Processing',
  format
});
```

### Token Validation Example

**Before:**
```typescript
progress = new ProgressBar({
  total: orgSlugs.length * 3,
  label: 'Validating token access',
  showPercentage: true,
  showCounts: true,
  format: options?.format
});
progress.start();
```

**After:**
```typescript
const progress = Progress.bar({
  total: orgSlugs.length * 3,
  label: 'Validating token access',
  format: options?.format
});
```

### ListBuilds Example

**Before:**
```typescript
if (useProgressBar) {
  progress = new ProgressBar({
    total: orgs.length,
    label: 'Fetching builds from organizations',
    showPercentage: true,
    showCounts: false,
    format: format
  });
  progress.start();
} else {
  spinner = createSpinner(format);
  spinner.start(`Fetching builds from ${org}…`);
}
```

**After:**
```typescript
const progress = Progress.create({
  total: orgs.length > 1 ? orgs.length : undefined,
  label: orgs.length > 1 
    ? 'Fetching builds from organizations' 
    : `Fetching builds from ${orgs[0]}…`,
  format
});
```

### Mixed Progress (ListPipelines)

**Before:**
```typescript
let orgProgress: ProgressBar | null = null;
let pageProgress: IndeterminateProgress | null = null;

if (useProgressBar) {
  orgProgress = new ProgressBar({ ... });
  orgProgress.start();
  // ... later
  pageProgress = new IndeterminateProgress(...);
  pageProgress.start();
}
```

**After:**
```typescript
const orgProgress = orgs.length > 1 
  ? Progress.bar({ total: orgs.length, label: 'Organizations' })
  : null;

// For each org
const pageProgress = Progress.spinner(`Loading from ${org}...`);
```

## Benefits of New API

1. **Cleaner naming**: `Progress.spinner()` and `Progress.bar()` are self-documenting
2. **Consistent interface**: All progress types have same methods
3. **Smart factory**: `Progress.create()` chooses the right type
4. **Less boilerplate**: No need to call `start()` separately
5. **Better types**: Single `Progress` interface instead of multiple classes
6. **Easier testing**: Can easily mock the `Progress` class

## Migration Strategy

1. Keep `createSpinner()` wrapper for backward compatibility
2. Gradually migrate commands to new API
3. Remove old implementations once migrated
