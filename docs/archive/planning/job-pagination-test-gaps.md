# Job Pagination Testing Gaps

Based on the job pagination implementation completed in this conversation, here are the testing gaps that need to be addressed:

## 1. GraphQL Query Tests

### GET_BUILD_SUMMARY Query
- [ ] Verify query includes `pageInfo` fields (hasNextPage, endCursor)
- [ ] Verify query includes `count` field for total job count
- [ ] Verify query uses `JOB_SUMMARY_FIELDS` fragment correctly

### GET_BUILD_JOBS_PAGE Query
- [ ] Verify query accepts `$first`, `$after` variables
- [ ] Verify query returns consistent job structure with GET_BUILD_SUMMARY
- [ ] Verify query uses the same fragment for consistency

### Fragment Tests
- [ ] Verify `JOB_SUMMARY_FIELDS` includes all necessary fields
- [ ] Verify `JOB_DETAIL_FIELDS` extends summary fields correctly
- [ ] Verify fragments are properly imported and composed

## 2. BuildkiteClient Tests

### fetchRemainingJobs Method
```typescript
describe('fetchRemainingJobs', () => {
  it('should return initial jobs when no more pages', async () => {
    // Test with hasNextPage: false
  });

  it('should fetch all pages when multiple pages exist', async () => {
    // Mock 3 pages of results
    // Verify all pages are fetched
  });

  it('should handle progress callback correctly', async () => {
    // Verify callback is called with correct counts
  });

  it('should handle empty pages gracefully', async () => {
    // Test with empty job edges
  });

  it('should handle API errors during pagination', async () => {
    // Test network failure on page 2
  });
});
```

### getBuildSummaryWithAllJobs Method
```typescript
describe('getBuildSummaryWithAllJobs', () => {
  it('should return initial data when fetchAllJobs is false', async () => {
    // Verify no additional fetching occurs
  });

  it('should fetch all pages when fetchAllJobs is true', async () => {
    // Verify fetchRemainingJobs is called
  });

  it('should merge job data correctly', async () => {
    // Verify final structure has all jobs
    // Verify pageInfo shows hasNextPage: false
  });
});
```

## 3. ShowBuild Command Tests

### Command Flag Processing
```typescript
describe('ShowBuild Command', () => {
  it('should not paginate without --jobs flag', async () => {
    // Verify only getBuildSummary is called
  });

  it('should paginate with --jobs flag', async () => {
    // Verify getBuildSummaryWithAllJobs is called
  });

  it('should paginate with --failed flag', async () => {
    // Verify pagination occurs for failure analysis
  });

  it('should show progress indicator in plain format', async () => {
    // Verify progress callback is provided
  });

  it('should not show progress in JSON format', async () => {
    // Verify no progress output in JSON mode
  });
});
```

## 4. PlainTextFormatter Tests

### Truncation Warning Display
```typescript
describe('PlainTextFormatter - Job Summary', () => {
  it('should show truncation warning when hasNextPage is true', () => {
    const jobsData = {
      edges: Array(100).fill({ node: { state: 'BROKEN' } }),
      pageInfo: { hasNextPage: true, endCursor: 'cursor' },
      count: 608
    };
    // Verify output includes "Showing 100 of 608 steps"
    // Verify warning message appears
  });

  it('should not show warning when all jobs are present', () => {
    const jobsData = {
      edges: Array(100).fill({ node: { state: 'PASSED' } }),
      pageInfo: { hasNextPage: false, endCursor: null },
      count: 100
    };
    // Verify no truncation warning
  });

  it('should suggest --jobs flag in tips when truncated', () => {
    // Verify tips include pagination hint
  });
});
```

### Job Statistics Calculation
```typescript
describe('PlainTextFormatter - Job Statistics', () => {
  it('should correctly count BROKEN jobs as skipped', () => {
    // Test with BROKEN state jobs
  });

  it('should identify FINISHED jobs with passed=false as failed', () => {
    // Test with FINISHED state but passed=false
  });

  it('should handle mixed job states correctly', () => {
    // Test with realistic job distribution
  });
});
```

## 5. Integration Tests

### End-to-End Pagination Flow
```typescript
describe('Job Pagination E2E', () => {
  it('should show incorrect stats without pagination', async () => {
    // Mock build with 608 jobs, first 100 are BROKEN
    // Verify shows "100 skipped" without --jobs
  });

  it('should show correct stats with pagination', async () => {
    // Same mock but with --jobs flag
    // Verify shows "2 failed, 416 passed, 187 skipped"
  });

  it('should handle very large builds (1000+ jobs)', async () => {
    // Test performance and memory usage
  });

  it('should handle pagination interruption gracefully', async () => {
    // Simulate network failure mid-pagination
  });
});
```

## 6. Mock Data Patterns

### Pattern Extraction Updates
```typescript
// Add to DataProfiler.ts
profileJobPagination(builds: Build[]): JobPaginationPatterns {
  return {
    jobCountDistribution: this.getDistribution(
      builds.map(b => b.jobs?.count || b.jobs?.edges?.length || 0)
    ),
    truncatedBuilds: builds.filter(b => b.jobs?.pageInfo?.hasNextPage).length,
    averageJobsPerBuild: // calculate average,
    maxJobsInBuild: // find maximum,
    jobStateDistributions: {
      // Distribution of states across all jobs
      BROKEN: // percentage of BROKEN jobs,
      FINISHED: // percentage of FINISHED jobs,
      FAILED: // percentage of FAILED state jobs
    }
  };
}
```

### Mock Generator Updates
```typescript
// Add to PatternMockGenerator.ts
Build: () => ({
  // ... existing fields ...
  jobs: () => {
    const totalJobs = this.selectByDistribution(
      this.patterns.builds.jobCountDistribution
    );
    const shouldPaginate = totalJobs > 100;
    
    return {
      edges: new MockList(shouldPaginate ? 100 : totalJobs),
      pageInfo: {
        hasNextPage: shouldPaginate,
        endCursor: shouldPaginate ? faker.string.alphanumeric(20) : null
      },
      count: totalJobs
    };
  }
})
```

## 7. Performance Tests

```typescript
describe('Pagination Performance', () => {
  it('should complete within reasonable time for 500 jobs', async () => {
    const start = Date.now();
    // Fetch build with 500 jobs
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000); // 3 seconds
  });

  it('should not exceed memory limits for 1000 jobs', async () => {
    // Monitor memory usage during large pagination
  });

  it('should handle concurrent pagination requests', async () => {
    // Test multiple builds being paginated simultaneously
  });
});
```

## 8. Error Handling Tests

```typescript
describe('Pagination Error Handling', () => {
  it('should handle invalid cursor gracefully', async () => {
    // Test with corrupted endCursor
  });

  it('should handle rate limiting during pagination', async () => {
    // Simulate 429 response on page 3
  });

  it('should handle partial failure (some pages succeed)', async () => {
    // Test recovery when page 2 of 5 fails
  });
});
```

## 9. Cache Integration Tests

```typescript
describe('Pagination with Caching', () => {
  it('should cache individual pages separately', async () => {
    // Verify each page query is cached
  });

  it('should invalidate cache when data changes', async () => {
    // Test cache invalidation strategy
  });

  it('should handle mixed cached/fresh pages', async () => {
    // Page 1 cached, page 2 fresh
  });
});
```

## Test Implementation Priority

### High Priority (Critical Path)
1. BuildkiteClient pagination methods
2. Job statistics calculation with BROKEN/FINISHED states
3. Truncation warning display
4. Command flag processing

### Medium Priority (User Experience)
5. Progress indicator behavior
6. Tips and hints display
7. Performance benchmarks
8. Cache integration

### Low Priority (Edge Cases)
9. Error recovery scenarios
10. Concurrent pagination
11. Memory usage tests

## Running the Tests

```bash
# Run all pagination tests
npm test -- job-pagination

# Run with coverage
npm test -- --coverage job-pagination

# Run specific test suite
npm test -- BuildkiteClient.test.ts

# Run in watch mode during development
npm test -- --watch job-pagination
```

## Test Data Requirements

For realistic testing, we need:
1. Mock build with exactly 100 jobs (no pagination)
2. Mock build with 101 jobs (minimal pagination)
3. Mock build with 608 jobs (matches real example)
4. Mock build with 1000+ jobs (stress test)
5. Mock build with various job state distributions

## Coverage Goals

- Line coverage: >90% for pagination code
- Branch coverage: >85% for pagination logic
- Function coverage: 100% for public API methods
- Edge cases: All identified error scenarios tested
