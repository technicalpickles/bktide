# Progress API Documentation

## Overview

The Progress API provides a unified interface for displaying progress indicators in the CLI. It supports both determinate (known total) and indeterminate (unknown duration) progress indicators, with automatic handling of non-TTY environments, machine formats, and CI detection.

## Core API

### Factory Methods

```typescript
import { Progress } from './ui/progress.js';

// Create a spinner (indeterminate progress)
const spinner = Progress.spinner(label?, options?);

// Create a progress bar (determinate progress)  
const bar = Progress.bar({
  total: number,
  label?: string,
  format?: string
});

// Smart factory - creates bar if total provided, spinner otherwise
const progress = Progress.create({
  total?: number,
  label?: string,
  format?: string
});
```

### Common Interface

All progress indicators implement the `IProgress` interface:

```typescript
interface IProgress {
  update(value: number | string, label?: string): void;
  stop(): void;
  complete(message?: string): void;
  fail(message?: string): void;
}
```

## Usage Examples

### Spinner (Indeterminate Progress)

Use for operations of unknown duration:

```typescript
const spinner = Progress.spinner('Loading data...', { format: 'plain' });

// Update the label
spinner.update('Still loading...', 'Still loading...');

// Complete with success message
spinner.complete('✓ Data loaded successfully');

// Or fail with error
spinner.fail('✗ Failed to load data');
```

### Progress Bar (Determinate Progress)

Use when you know the total number of items:

```typescript
const progress = Progress.bar({
  total: 100,
  label: 'Processing files',
  format: 'plain'
});

// Update progress
for (let i = 0; i <= 100; i++) {
  progress.update(i, `Processing file ${i}/100`);
  await processFile(i);
}

// Complete with message
progress.complete('✓ All files processed');
```

### With Async Operations

Use the `withProgress` helper for automatic progress management:

```typescript
import { withProgress } from './ui/progress.js';

const result = await withProgress(
  async (progress) => {
    progress.update(0, 'Starting...');
    const data = await fetchData();
    progress.update(50, 'Processing...');
    const processed = await processData(data);
    progress.update(100, 'Finalizing...');
    return processed;
  },
  {
    total: 100,
    label: 'Processing data',
    successMessage: '✓ Data processed successfully'
  }
);
```

## Features

### Automatic Environment Detection

The Progress API automatically detects and adapts to different environments:

- **Non-TTY**: Returns no-op progress indicators when output is piped or redirected
- **CI Environment**: Disables progress indicators when `CI` environment variable is set
- **Machine Formats**: Disables for JSON and Alfred output formats
- **NO_COLOR**: Respects the NO_COLOR environment variable

### Terminal Width Awareness

Progress bars and labels are automatically truncated to fit the terminal width:

```typescript
// Labels are truncated based on available space
// Bar width adjusts to terminal size
[████████████░░░░░░░░] 60% (60/100)
```

### Consistent Styling

All progress indicators use the theme's color palette:

- Spinners use the `info` color (blue)
- Success messages use the `success` color (blue for accessibility)
- Error messages use the `error` color (orange for color-blind safety)

## Migration from Legacy API

### Old Spinner API

```typescript
// OLD
import { createSpinner } from './ui/spinner.js';

const spinner = createSpinner(format);
spinner.start('Loading...');
spinner.setText('Still loading...');
spinner.succeed('Done');

// NEW
import { Progress } from './ui/progress.js';

const spinner = Progress.spinner('Loading...', { format });
spinner.update('Still loading...', 'Still loading...');
spinner.complete('Done');
```

### Old ProgressBar API

```typescript
// OLD
import { ProgressBar } from './ui/progress.js';

const progress = new ProgressBar({
  total: 100,
  label: 'Processing',
  showPercentage: true,
  showCounts: true,
  format: 'plain'
});
progress.start();
progress.update(50, 'Halfway');
progress.complete('Done');

// NEW
import { Progress } from './ui/progress.js';

const progress = Progress.bar({
  total: 100,
  label: 'Processing',
  format: 'plain'
});
progress.update(50, 'Halfway');
progress.complete('Done');
```

### Old IndeterminateProgress API

```typescript
// OLD
import { IndeterminateProgress } from './ui/progress.js';

const progress = new IndeterminateProgress('Loading...', format);
progress.start();
progress.updateLabel('Still loading...');
progress.stop();

// NEW
import { Progress } from './ui/progress.js';

const progress = Progress.spinner('Loading...', { format });
progress.update('Still loading...', 'Still loading...');
progress.stop();
```

## Best Practices

### 1. Choose the Right Type

- Use `Progress.spinner()` for operations of unknown duration
- Use `Progress.bar()` when you know the total count
- Use `Progress.create()` when the type depends on runtime conditions

### 2. Always Clean Up

```typescript
const progress = Progress.spinner('Loading...');
try {
  await doWork();
  progress.complete('✓ Success');
} catch (error) {
  progress.fail('✗ Failed');
  throw error;
}
```

### 3. Provide Meaningful Updates

```typescript
// Good - specific and informative
progress.update(i, `Processing ${file.name} (${i}/${total})`);

// Poor - generic
progress.update(i, 'Processing...');
```

### 4. Use Helper Functions

For common patterns, use the provided helpers:

```typescript
// For async operations with progress
await withProgress(operation, options);

// For processing lists (backward compatibility)
await withCountedProgress(items, processItem, options);
```

### 5. Test Non-Interactive Modes

Always test with:
- Piped output: `bin/bktide command | cat`
- Machine formats: `bin/bktide command --format json`
- CI environment: `CI=1 bin/bktide command`

## Implementation Details

### Architecture

The Progress API uses a unified internal implementation:

1. **Base Classes**: `Spinner` and `Bar` implement the core logic
2. **No-Op Class**: `NoOpProgress` for non-interactive environments
3. **Factory Methods**: `Progress` class provides static factory methods
4. **Environment Detection**: `shouldShowProgress()` handles all detection logic
5. **Backward Compatibility**: Legacy classes wrap the new API

### Performance Considerations

- Spinners update at 80ms intervals (12.5 FPS)
- Progress bars only re-render when `update()` is called
- No-op implementations have zero overhead
- Terminal clearing uses minimal escape sequences

### Thread Safety

Progress indicators are not thread-safe. Use from a single thread/context only.

## Troubleshooting

### Progress Not Showing

Check:
1. Is stdout/stderr a TTY? (`process.stderr.isTTY`)
2. Is `CI` environment variable set?
3. Is output format JSON or Alfred?
4. Is `NO_COLOR` set?

### Garbled Output

Ensure:
1. Only one progress indicator is active at a time
2. Not mixing console.log with progress indicators
3. Using `logger.console()` for output during progress

### Performance Issues

Consider:
1. Reducing update frequency for large datasets
2. Using batch updates instead of per-item updates
3. Disabling progress for very fast operations (<100ms)
