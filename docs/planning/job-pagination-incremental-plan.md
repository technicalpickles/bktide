# Job Pagination: Incremental Implementation Plan

## Overview
This document breaks down the job pagination implementation into small, testable increments that can be developed and validated independently. Each step builds on the previous one and can be tested in isolation.

## Implementation Steps

### Step 1: Detection & Awareness (No Fetching Yet)
**Goal**: Make the system aware of pagination without actually implementing fetching.

#### 1.1 Update GraphQL Query to Include PageInfo
```typescript
// src/graphql/queries.ts
// Modify GET_BUILD_SUMMARY to include pageInfo
jobs(first: 100) {
  edges { ... }
  pageInfo {
    hasNextPage
    endCursor
  }
  count  # Total count if available
}
```

#### 1.2 Pass PageInfo Through to Formatters
```typescript
// Add to build data structure
interface BuildJobsData {
  edges: JobEdge[];
  pageInfo?: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  count?: number;
}
```

#### 1.3 Display Truncation Warning
```typescript
// In PlainTextFormatter
if (jobsData?.pageInfo?.hasNextPage) {
  lines.push(SEMANTIC_COLORS.warning('⚠️  Showing first 100 jobs only (more available)'));
}
```

**Validation**:
```bash
# Test with a build that has >100 jobs
bin/bktide build gusto/zenpayroll/1290672
# Should show: "⚠️  Showing first 100 jobs only (more available)"

# Test with a build that has <100 jobs  
bin/bktide build gusto/zenpayroll/[find-small-build]
# Should NOT show warning
```

---

### Step 2: Create Reusable GraphQL Fragments
**Goal**: Establish consistent job field definitions before adding new queries.

#### 2.1 Create Fragments File
```typescript
// src/graphql/fragments/jobs.ts
export const JOB_SUMMARY_FIELDS = gql`
  fragment JobSummaryFields on JobInterface {
    ... on JobTypeCommand {
      id
      uuid
      label
      state
      exitStatus
      passed
      parallelGroupIndex
      parallelGroupTotal
    }
    ... on JobTypeWait {
      id
      label
    }
    ... on JobTypeTrigger {
      id
      label
      state
    }
  }
`;
```

#### 2.2 Refactor Existing Query to Use Fragment
```typescript
// Update GET_BUILD_SUMMARY
jobs(first: 100) {
  edges {
    node {
      ...JobSummaryFields
    }
  }
  pageInfo { hasNextPage, endCursor }
  count
}
```

**Validation**:
```bash
# Rebuild and verify nothing breaks
npm run build
bin/bktide build gusto/zenpayroll/1290672

# Run codegen to ensure types are consistent
npm run codegen

# Verify TypeScript compilation
npm run lint
```

---

### Step 3: Add Pagination Query (Not Used Yet)
**Goal**: Create the query infrastructure without wiring it up.

#### 3.1 Create GET_BUILD_JOBS_PAGE Query
```typescript
// src/graphql/queries.ts
export const GET_BUILD_JOBS_PAGE = gql`
  query GetBuildJobsPage($slug: ID!, $first: Int!, $after: String) {
    build(slug: $slug) {
      id
      jobs(first: $first, after: $after) {
        edges {
          node {
            ...JobSummaryFields
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        count
      }
    }
  }
  ${JOB_SUMMARY_FIELDS}
`;
```

#### 3.2 Generate Types
```bash
npm run codegen
```

**Validation**:
```javascript
// Create test script: test-pagination-query.js
import { BuildkiteClient } from './dist/services/BuildkiteClient.js';
import { GET_BUILD_JOBS_PAGE } from './dist/graphql/queries.js';

async function test() {
  const client = new BuildkiteClient(process.env.BUILDKITE_API_TOKEN);
  
  // Test the query directly
  const result = await client.query(
    GET_BUILD_JOBS_PAGE.toString(),
    {
      slug: 'gusto/zenpayroll/1290672',
      first: 10,
      after: null
    }
  );
  
  console.log('Jobs fetched:', result.build?.jobs?.edges?.length);
  console.log('Has more:', result.build?.jobs?.pageInfo?.hasNextPage);
}

test().catch(console.error);
```

---

### Step 4: Implement Client Pagination Method
**Goal**: Add the core pagination logic to BuildkiteClient.

#### 4.1 Add fetchRemainingJobs Method
```typescript
// src/services/BuildkiteClient.ts
public async fetchRemainingJobs(
  buildSlug: string,
  initialJobs: any[],
  initialPageInfo: { hasNextPage: boolean; endCursor: string },
  options?: { onProgress?: (fetched: number, total?: number) => void }
): Promise<{ jobs: any[], totalCount: number }>
```

#### 4.2 Test in Isolation
```javascript
// test-fetch-remaining.js
import { BuildkiteClient } from './dist/services/BuildkiteClient.js';

async function test() {
  const client = new BuildkiteClient(process.env.BUILDKITE_API_TOKEN);
  
  // First get initial data
  const buildData = await client.getBuildSummary('gusto/zenpayroll/1290672');
  const initialJobs = buildData.build.jobs.edges;
  const pageInfo = buildData.build.jobs.pageInfo;
  
  console.log('Initial jobs:', initialJobs.length);
  console.log('Has more pages:', pageInfo.hasNextPage);
  
  if (pageInfo.hasNextPage) {
    // Test the new method
    const result = await client.fetchRemainingJobs(
      'gusto/zenpayroll/1290672',
      initialJobs,
      pageInfo,
      {
        onProgress: (fetched, total) => {
          console.log(`Progress: ${fetched}/${total || '?'}`);
        }
      }
    );
    
    console.log('Total jobs fetched:', result.jobs.length);
  }
}

test().catch(console.error);
```

**Validation Checklist**:
- [ ] Fetches all pages correctly
- [ ] Progress callback works
- [ ] Handles builds with exactly 100, 200, 600+ jobs
- [ ] Handles cursor properly
- [ ] Stops when no more pages

---

### Step 5: Wire Up Command Flag
**Goal**: Connect pagination to the ShowBuild command with a flag.

#### 5.1 Add --jobs Flag
```typescript
// src/index.ts (in build command definition)
.option('--jobs', 'Fetch and display all jobs (may be slow for large builds)')
```

#### 5.2 Update ShowBuild Command
```typescript
// Only fetch all jobs if flag is set
const needsAllJobs = options.jobs || options.failed || options.full;

if (needsAllJobs && buildData.build?.jobs?.pageInfo?.hasNextPage) {
  // Fetch remaining pages
  const { jobs } = await this.client.fetchRemainingJobs(...);
  // Merge into buildData
}
```

**Progressive Testing**:
```bash
# Test 1: Without flag (should show first 100 only)
bin/bktide build gusto/zenpayroll/1290672
# Expected: Shows "100 of 608 steps" with warning

# Test 2: With --jobs flag (should fetch all)
bin/bktide build gusto/zenpayroll/1290672 --jobs
# Expected: Shows "608 steps" without warning

# Test 3: With --failed flag (should also fetch all)
bin/bktide build gusto/zenpayroll/1290672 --failed
# Expected: Shows all failed jobs from complete set

# Test 4: Debug mode to see pagination
bin/bktide build gusto/zenpayroll/1290672 --jobs --debug
# Expected: Shows "Fetching additional jobs page" messages
```

---

### Step 6: Update Formatters for Better UX
**Goal**: Improve how partial/complete data is displayed.

#### 6.1 Show Partial Data Indicators
```typescript
// Enhanced job summary formatting
if (isPartial) {
  const showing = jobs.length;
  const total = totalCount || `${showing}+`;
  lines.push(`${icon} Showing ${showing} of ${total} steps: ${countParts.join(', ')}`);
  lines.push(SEMANTIC_COLORS.dim('  → Use --jobs to fetch all'));
} else {
  lines.push(`${icon} ${jobStats.total} steps: ${countParts.join(', ')}`);
}
```

#### 6.2 Add Loading Indicator (if interactive)
```typescript
// During pagination
if (options.onProgress) {
  process.stderr.write(`\rFetching jobs: ${fetched}/${total || '?'}...`);
}
```

**Visual Testing**:
```bash
# Test different scenarios
bin/bktide build [small-build]     # <100 jobs
bin/bktide build [medium-build]    # ~200 jobs  
bin/bktide build [large-build]     # 600+ jobs

# Each should show appropriate messaging
```

---

### Step 7: Comprehensive Testing
**Goal**: Validate the complete implementation.

#### 7.1 Create Test Matrix
```bash
# test-pagination-matrix.sh
#!/bin/bash

echo "Testing Job Pagination Implementation"
echo "======================================"

# Test builds of different sizes
BUILDS=(
  "small:gusto/zenpayroll/[50-jobs]"
  "exact-100:gusto/zenpayroll/[100-jobs]"
  "medium:gusto/zenpayroll/[200-jobs]"
  "large:gusto/zenpayroll/1290672"
)

for build in "${BUILDS[@]}"; do
  IFS=':' read -r size slug <<< "$build"
  echo ""
  echo "Testing $size build: $slug"
  echo "---"
  
  # Test without pagination
  echo "1. Default view:"
  bin/bktide build "$slug" | grep -E "(steps|jobs)"
  
  # Test with --jobs flag
  echo "2. With --jobs flag:"
  bin/bktide build "$slug" --jobs | grep -E "(steps|jobs)"
  
  # Test with --failed flag
  echo "3. With --failed flag:"
  bin/bktide build "$slug" --failed | head -n 5
done
```

#### 7.2 Performance Testing
```javascript
// test-performance.js
async function measurePaginationPerformance() {
  const scenarios = [
    { jobs: 100, expected: 'single query' },
    { jobs: 200, expected: '1 initial + 1 page' },
    { jobs: 600, expected: '1 initial + 5 pages' }
  ];
  
  for (const scenario of scenarios) {
    const start = Date.now();
    // Fetch build with pagination
    const duration = Date.now() - start;
    console.log(`${scenario.jobs} jobs: ${duration}ms (${scenario.expected})`);
  }
}
```

---

## Rollback Plan

Each step can be rolled back independently:

1. **Step 1**: Remove pageInfo from query
2. **Step 2**: Revert to inline field definitions
3. **Step 3**: Delete new query
4. **Step 4**: Remove pagination method
5. **Step 5**: Remove flag and logic
6. **Step 6**: Revert formatter changes

## Success Criteria

- [ ] Builds with ≤100 jobs: No change in behavior
- [ ] Builds with >100 jobs: Show clear truncation warning
- [ ] `--jobs` flag: Fetches all jobs successfully
- [ ] `--failed` flag: Shows all failures (not just first 100)
- [ ] Performance: <2s for 500 jobs on good connection
- [ ] Debug output: Clear pagination progress
- [ ] Error handling: Graceful partial failures

## Risk Mitigation

1. **Rate Limiting**: Add delay between page fetches if needed
2. **Memory**: Stream results for very large builds (>1000 jobs)
3. **Timeout**: Add configurable timeout for total pagination time
4. **Cache**: Cache individual pages to avoid re-fetching
