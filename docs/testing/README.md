# Testing Strategy for bktide

This document outlines the comprehensive testing strategy for the bktide CLI, which uses a hybrid approach combining schema-first mock generation with patterns learned from real Buildkite data.

## Overview

Our testing approach addresses two key challenges:
1. **Privacy**: Working with private, internal Buildkite data that cannot be exposed
2. **Realism**: Avoiding hard-coded test data that doesn't reflect real-world usage

## Testing Approaches

### 1. 🎭 Pattern-Based Mock Generation (Recommended)

Extract statistical patterns from real data and use them to generate realistic mocks.

**Setup:**
```bash
# One-time: Extract patterns from your real Buildkite instance
BUILDKITE_API_TOKEN=your-token npm run test:extract-patterns

# This creates test/fixtures/data-patterns.json (safe to commit)
```

**Benefits:**
- ✅ Realistic data distributions
- ✅ No sensitive data stored
- ✅ Version-controlled patterns
- ✅ Consistent across team

**Usage:**
```typescript
// Tests automatically use pattern-based mocks
const builds = await client.getBuilds();
// Returns builds with realistic states, branches, messages, etc.
```

### 2. 📼 Record & Replay Testing

Use Polly.js or nock to record real API responses and replay them in tests.

**Recording:**
```bash
# Record new fixtures
RECORD_MODE=true npm test

# Fixtures saved to test/fixtures/recordings/
```

**Sanitization:**
```typescript
polly.server.any().on('beforePersist', (req, recording) => {
  // Remove auth headers
  recording.request.headers = recording.request.headers.filter(
    h => !h.name.toLowerCase().includes('authorization')
  );
  
  // Sanitize response data
  sanitizePersonalData(recording.response);
});
```

### 3. 🎯 Specific Test Overrides

Override pattern-based mocks with specific test data when needed.

```typescript
// Override for a specific test
server.use(
  graphql.query('GetBuilds', (req, res, ctx) => {
    return res(ctx.data({
      viewer: {
        builds: {
          edges: [{
            node: {
              id: 'specific-test-build',
              state: 'FAILED',
              // ... specific test scenario
            }
          }]
        }
      }
    }));
  })
);
```

### 4. 📸 Snapshot Testing

Test output formatting with sanitized snapshots.

```typescript
const output = formatter.format(build);
const sanitized = sanitizeSnapshot(output);
expect(sanitized).toMatchSnapshot();
```

## Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm test:watch

# Coverage report
npm test:coverage

# UI mode for debugging
npm test:ui

# Update snapshots
npm test -- -u

# Run specific test file
npm test -- test/commands/ListBuilds.test.ts
```

## Test Organization

```
test/
├── setup.ts                 # Global test setup with MSW
├── helpers/
│   ├── DataProfiler.ts      # Extracts patterns from real data
│   ├── PatternMockGenerator.ts # Generates mocks from patterns
│   └── sanitizers.ts        # Data sanitization utilities
├── fixtures/
│   ├── data-patterns.json   # Extracted patterns (safe to commit)
│   ├── recordings/          # Polly.js recordings (gitignored)
│   └── snapshots/           # Vitest snapshots
├── unit/
│   ├── commands/            # Command unit tests
│   ├── formatters/          # Formatter unit tests
│   └── utils/               # Utility unit tests
├── integration/
│   └── api/                 # API integration tests
└── example/
    └── hybrid-mocking.test.ts # Example demonstrating approach
```

## Pattern Extraction

The pattern extraction process analyzes real data to extract statistical patterns without storing sensitive information.

### What Gets Extracted

**Build Patterns:**
- State distributions (PASSED: 70%, FAILED: 20%, etc.)
- Branch naming conventions (feature/*, main, release/*)
- Commit message formats (conventional commits, emoji usage)
- Build number ranges
- Duration statistics (min, max, median, p95)
- Job and annotation counts

**Pipeline Patterns:**
- Slug formats (kebab-case, snake_case)
- Name lengths
- Default branches
- Repository providers (GitHub, GitLab, etc.)

**Job Patterns:**
- Exit status distributions (0: 85%, 1: 10%, etc.)
- Retry rates
- Parallel group configurations
- Label patterns

### Running Pattern Extraction

```bash
# Extract with default sample sizes
BUILDKITE_API_TOKEN=your-token npm run test:extract-patterns

# Custom sample sizes
PATTERN_SAMPLE_SIZE=200 PIPELINE_SAMPLE_SIZE=100 \
  BUILDKITE_API_TOKEN=your-token npm run test:extract-patterns
```

### Pattern File Format

```json
{
  "builds": {
    "states": {
      "values": [
        { "value": "PASSED", "frequency": 0.7, "count": 70 },
        { "value": "FAILED", "frequency": 0.2, "count": 20 }
      ]
    },
    "branches": {
      "formats": {
        "feature": 0.3,
        "main": 0.2,
        "release": 0.1
      }
    }
  },
  "extracted": "2024-01-15T10:00:00Z",
  "sampleSize": {
    "builds": 100,
    "pipelines": 50
  }
}
```

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BuildkiteClient } from '../../src/services/BuildkiteClient.js';

describe('Feature', () => {
  let client: BuildkiteClient;

  beforeEach(async () => {
    client = new BuildkiteClient('test-token', {
      caching: false,
      debug: false
    });
    await client.initialize();
  });

  it('should work with pattern-based mocks', async () => {
    // Automatically uses pattern-based mocks
    const result = await client.getBuilds();
    
    expect(result).toBeDefined();
    // Assertions...
  });

  it('should handle specific scenario', async () => {
    // Override with specific test data
    server.use(/* specific mock */);
    
    const result = await client.getBuilds();
    expect(result[0].state).toBe('FAILED');
  });
});
```

### Testing Commands

```typescript
describe('ListBuilds Command', () => {
  it('should format output correctly', async () => {
    const command = new ListBuilds();
    const result = await command.execute({
      org: 'test-org',
      pipeline: 'test-pipeline',
      format: 'plain'
    });
    
    expect(result).toBe(0); // Success exit code
  });
});
```

### Testing Formatters

```typescript
describe('PlainTextFormatter', () => {
  it('should format builds', () => {
    const formatter = new PlainTextFormatter();
    const builds = generateMockBuilds(); // Uses pattern generator
    
    const output = formatter.format(builds);
    
    expect(output).toContain('Build #');
    expect(output).toMatchSnapshot();
  });
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - run: npm ci
      
      - run: npm run build
      
      # Use committed patterns or defaults
      - run: npm test
      
      # Upload coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Best Practices

### ✅ DO

- Extract patterns regularly to keep them current
- Commit `data-patterns.json` (contains no sensitive data)
- Use specific overrides for edge cases
- Sanitize any recorded fixtures before committing
- Test both success and failure paths
- Use snapshot testing for formatters

### ❌ DON'T

- Commit raw API recordings without sanitization
- Hard-code specific build IDs or user data
- Rely solely on default mocks without patterns
- Skip testing error conditions
- Expose API tokens in test files

## Troubleshooting

### Missing Patterns

```bash
⚠️  Using default mock patterns
```

**Solution:** Run `npm run test:extract-patterns` with a valid Buildkite token.

### Mock Execution Errors

```
Mock execution error: Cannot read property 'edges' of undefined
```

**Solution:** Ensure your GraphQL queries match the schema structure.

### Snapshot Mismatches

```bash
# Update snapshots after intentional changes
npm test -- -u
```

### Rate Limiting During Pattern Extraction

```bash
# Use smaller sample sizes
PATTERN_SAMPLE_SIZE=50 npm run test:extract-patterns
```

## Migration from Manual Mocks

If you have existing hard-coded mocks:

1. Extract patterns from real data
2. Gradually replace hard-coded mocks with pattern-based ones
3. Keep specific test scenarios as overrides
4. Remove obsolete fixture files

## Security Considerations

### Safe to Commit ✅
- `test/fixtures/data-patterns.json` - Statistical patterns only
- Sanitized snapshots
- Test code with mock data

### Never Commit ❌
- Raw API recordings
- Real user emails/names
- API tokens
- Unsanitized response data

## Next Steps

1. Run `npm run test:extract-patterns` to generate patterns from your Buildkite instance
2. Write your first test using the example in `test/example/hybrid-mocking.test.ts`
3. Run `npm test` to see pattern-based mocks in action
4. Add specific test overrides as needed for edge cases

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Polly.js Documentation](https://netflix.github.io/pollyjs/)
- [GraphQL Tools Mocking](https://www.graphql-tools.com/docs/mocking)
