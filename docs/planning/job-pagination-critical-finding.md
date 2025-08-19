# Critical Finding: Job Statistics Are Wrong Without Pagination

## Discovery
While implementing job pagination, we discovered that the current implementation shows **completely incorrect statistics** for builds with >100 jobs.

## Example: Build gusto/zenpayroll/1290672
This build perfectly demonstrates the problem:

### What Currently Shows (WRONG)
```
✗ Showing 100 of 608 steps: 100 skipped
```

### What Should Show (CORRECT)
```
✗ Showing 100 of 608 steps: 2 failed, 416 passed, 165 broken
⚠️  Showing first 100 jobs only (more available)
```

### The Actual Failed Jobs
- `:rspec: RSpec` (1 instance) - job #101-608
- `:tapioca: Tapioca DSL Verify` (1 instance) - job #101-608

## Root Cause
1. **Failed jobs aren't always in the first 100**: The GraphQL API returns jobs in a specific order, and failed jobs might be anywhere in the list
2. **Job states are complex**: Failed jobs have `state=FINISHED` with `passed=false`, not `state=FAILED`
3. **BROKEN != FAILED**: The first 100 jobs are BROKEN (didn't run due to dependencies), not failed

## Job State Distribution (All 608 Jobs)
- **FINISHED**: 419 jobs
  - 416 passed (passed=true)
  - 2 failed (passed=false) ← The actual failures!
  - 1 unknown (passed=null)
- **BROKEN**: 165 jobs (conditionally skipped, like Jest tests)
- **SKIPPED**: 22 jobs
- **UNKNOWN**: 2 jobs

## Why This Matters
Without fetching all jobs:
1. **Users don't see what actually failed** - Critical for debugging
2. **Statistics are meaningless** - "100 skipped" vs "2 failed" is a huge difference
3. **CI/CD decisions are wrong** - Teams might think different things failed

## Solution
The job pagination implementation is **critical** and should be prioritized:
1. Fetch all jobs when needed (--jobs, --failed flags)
2. Show clear warnings when data is truncated
3. Eventually consider always fetching all jobs for failed builds

## Lessons Learned
1. **Pagination isn't just a performance issue** - it's a correctness issue
2. **Job ordering from the API isn't predictable** - can't assume failures are first
3. **State handling is complex** - FINISHED with passed=false is a failure
4. **Testing with real data is essential** - this wouldn't be caught with mocked data
