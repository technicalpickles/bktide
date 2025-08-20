# Job Pagination Implementation Checklist

## Quick Start Guide
Follow these steps in order. Each step can be completed, tested, and committed independently.

---

## 📋 Pre-Implementation Setup
- [ ] Create a test build reference list:
  ```bash
  # Find builds with different job counts for testing
  # Small: <100 jobs
  # Medium: 100-200 jobs  
  # Large: 500+ jobs (e.g., gusto/zenpayroll/1290672 has 608 jobs)
  ```
- [ ] Set up test environment:
  ```bash
  export BUILDKITE_API_TOKEN=your-token
  npm run build
  ```

---

## 🔍 Step 1: Detection Only (30 mins)
**Goal**: Show users when data is truncated without fixing it yet.

### Tasks:
- [ ] Update `GET_BUILD_SUMMARY` query:
  ```graphql
  jobs(first: 100) {
    edges { ... }
    pageInfo {
      hasNextPage
      endCursor
    }
    count
  }
  ```
- [ ] Run codegen: `npm run codegen`
- [ ] Update `PlainTextFormatter.formatJobSummary()`:
  ```typescript
  if (jobsData?.pageInfo?.hasNextPage) {
    lines.push('⚠️  Showing first 100 jobs only');
  }
  ```
- [ ] Build and test: `npm run build && bin/bktide build [large-build-ref]`

### Validation:
```bash
# Should see warning on large builds
bin/bktide build gusto/zenpayroll/1290672
# ✓ Shows "⚠️  Showing first 100 jobs only"

# Should NOT see warning on small builds
bin/bktide build [small-build-ref]
# ✓ No warning shown
```

### Commit:
```bash
git add -A
git commit -m "feat: detect and warn about truncated job lists"
```

---

## 🧩 Step 2: GraphQL Fragments (20 mins)
**Goal**: Create reusable field definitions.

### Tasks:
- [ ] Create `src/graphql/fragments/jobs.ts`:
  ```typescript
  export const JOB_SUMMARY_FIELDS = gql`
    fragment JobSummaryFields on JobInterface {
      ... on JobTypeCommand { ... }
    }
  `;
  ```
- [ ] Export from `src/graphql/fragments/index.ts`
- [ ] Update `GET_BUILD_SUMMARY` to use fragment
- [ ] Run codegen: `npm run codegen`
- [ ] Build and verify: `npm run build && npm run lint`

### Validation:
```bash
# Everything should still work exactly the same
bin/bktide build gusto/zenpayroll/1290672
# ✓ Same output as before
```

### Commit:
```bash
git commit -m "refactor: extract job fields into reusable GraphQL fragments"
```

---

## 📄 Step 3: Add Pagination Query (15 mins)
**Goal**: Create the query for fetching additional pages.

### Tasks:
- [ ] Add `GET_BUILD_JOBS_PAGE` query:
  ```typescript
  export const GET_BUILD_JOBS_PAGE = gql`
    query GetBuildJobsPage($slug: ID!, $first: Int!, $after: String) {
      build(slug: $slug) {
        id
        jobs(first: $first, after: $after) {
          edges { node { ...JobSummaryFields } }
          pageInfo { hasNextPage, endCursor }
          count
        }
      }
    }
    ${JOB_SUMMARY_FIELDS}
  `;
  ```
- [ ] Run codegen: `npm run codegen`
- [ ] Create test script to verify query works

### Validation:
```javascript
// test-query.js
import { BuildkiteClient } from './dist/services/BuildkiteClient.js';
// Test fetching a page with the new query
```

### Commit:
```bash
git commit -m "feat: add GraphQL query for paginated job fetching"
```

---

## 🔄 Step 4: Client Pagination Logic (45 mins)
**Goal**: Implement the core pagination method.

### Tasks:
- [ ] Add `fetchRemainingJobs()` to `BuildkiteClient`:
  ```typescript
  public async fetchRemainingJobs(
    buildSlug: string,
    initialJobs: any[],
    initialPageInfo: PageInfo,
    options?: PaginationOptions
  ): Promise<JobsResult>
  ```
- [ ] Add progress callback support
- [ ] Add debug logging
- [ ] Handle edge cases (empty pages, invalid cursors)

### Validation:
```javascript
// test-pagination.js
// Test fetching all pages for a large build
// Verify progress callbacks work
// Check total count matches
```

### Commit:
```bash
git commit -m "feat: implement job pagination in BuildkiteClient"
```

---

## 🎛️ Step 5: Wire Up Command (30 mins)
**Goal**: Connect pagination to user-facing commands.

### Tasks:
- [ ] Add `--jobs` flag to build command:
  ```typescript
  .option('--jobs', 'Fetch all jobs (may be slow for large builds)')
  ```
- [ ] Update `ShowBuild.fetchBuildData()`:
  ```typescript
  const needsAllJobs = options.jobs || options.failed || options.full;
  ```
- [ ] Integrate `fetchRemainingJobs()` when needed
- [ ] Test with various flags

### Validation:
```bash
# Without flag - shows truncated
bin/bktide build gusto/zenpayroll/1290672
# ✓ Shows "100 of 608" with warning

# With --jobs flag - fetches all
bin/bktide build gusto/zenpayroll/1290672 --jobs
# ✓ Shows "608 steps" without warning

# With --failed flag - also fetches all
bin/bktide build gusto/zenpayroll/1290672 --failed
# ✓ Shows failures from complete set
```

### Commit:
```bash
git commit -m "feat: add --jobs flag for complete job fetching"
```

---

## 🎨 Step 6: Polish Formatters (20 mins)
**Goal**: Improve how partial vs complete data is displayed.

### Tasks:
- [ ] Update job summary formatting:
  - Show "X of Y jobs" when partial
  - Show tips about using --jobs flag
  - Clear indication when all jobs are shown
- [ ] Add progress indicator during fetching
- [ ] Test visual output

### Validation:
```bash
# Check all display variations
bin/bktide build [small]   # Full data, no warning
bin/bktide build [large]   # Partial with tip
bin/bktide build [large] --jobs  # Full data after fetch
```

### Commit:
```bash
git commit -m "feat: improve job pagination UX with clear indicators"
```

---

## ✅ Step 7: End-to-End Testing (30 mins)
**Goal**: Validate complete implementation.

### Tasks:
- [ ] Test matrix of build sizes (50, 100, 200, 600+ jobs)
- [ ] Test all flag combinations (--jobs, --failed, --full)
- [ ] Test error scenarios (network interruption)
- [ ] Performance testing (measure fetch times)
- [ ] Cache behavior validation

### Test Script:
```bash
#!/bin/bash
# Run comprehensive test suite
for size in small medium large; do
  echo "Testing $size build..."
  bin/bktide build $BUILD_REF
  bin/bktide build $BUILD_REF --jobs
  bin/bktide build $BUILD_REF --failed
done
```

### Performance Targets:
- [ ] <100 jobs: No performance change
- [ ] 200 jobs: <1s additional time with --jobs
- [ ] 600 jobs: <3s additional time with --jobs

---

## 🚀 Deployment

### Final Checklist:
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] Error handling tested
- [ ] Cache working correctly

### Release Notes:
```markdown
### Features
- Detect when job lists are truncated in large builds
- Add --jobs flag to fetch complete job lists
- Show accurate job statistics for builds with >100 jobs
- Display clear indicators when showing partial vs complete data

### Fixes
- Fix incorrect job counts for builds with >100 jobs
- Fix --failed flag missing failures beyond first 100 jobs
```

---

## 🔄 Rollback Plan

If issues arise, each step can be reverted independently:

```bash
# Revert specific step
git revert HEAD  # Revert last commit

# Or revert to before pagination
git checkout main
git checkout -b revert-pagination
git revert [first-pagination-commit]..[last-pagination-commit]
```

---

## 📊 Success Metrics

Track these after deployment:
- Error rate for pagination queries
- Average time to fetch large builds
- User feedback on --jobs flag usage
- Memory usage for very large builds (1000+ jobs)
