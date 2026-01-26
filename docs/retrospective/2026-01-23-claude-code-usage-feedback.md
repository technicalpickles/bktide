# Claude Code Agent Usage Feedback - bktide snapshot command

**Date:** 2026-01-23
**Context:** Debugging CI failures for a gem version bump
**User:** Claude Code (AI agent debugging CI in a Rails monorepo)

## Summary

An AI agent (Claude Code) used `bktide snapshot` to analyze CI build failures. The command worked well but discoverability and documentation around the snapshot output structure could be improved.

## What Happened

### The Task
- User bumped a gem to a new major version in a Rails monorepo
- CI failed with 20 RSpec System test failures
- Needed to investigate if failures were related to the gem change

### Initial Attempt
Agent tried to use `WebFetch` tool to scrape the Buildkite URL directly. User interrupted and suggested:

```bash
npx bktide@latest snapshot https://buildkite.com/acme/myapp/builds/12345
```

### What Worked Well

1. **Command execution was seamless**
   - Installed via npx (no global install needed)
   - Fetched build data and logs successfully
   - Saved to predictable location: `~/.bktide/snapshots/acme/myapp/12345`
   - Clear output showing what was captured: "20 step(s) captured"

2. **The saved data was comprehensive**
   - Full logs for all failed steps
   - Metadata in JSON format
   - Organized by step number (01-, 02-, etc.)

### What Could Be Better

#### 1. Discoverability Issues

**Problem:** Agent didn't know `bktide snapshot` existed as an option
- Tried WebFetch first (scraping)
- Only learned about snapshot when user suggested it

**Why this happened:**
- Command not listed in `bktide --help` output (though it exists in code)
- No mention in README.md main usage examples
- Not discoverable without prior knowledge

**Impact:** Delayed debugging by requiring user intervention

#### 2. Output Structure Not Documented

**Problem:** Agent had to explore the snapshot structure through trial and error

**What the agent tried:**
```bash
# Tried to find logs at root level
cat /path/to/snapshot/*.log  # No matches

# Eventually found the structure:
/path/to/snapshot/
├── build.json
├── manifest.json
└── steps/
    ├── 01-rspec-system/
    │   ├── log.txt      # ← Found logs here eventually
    │   └── step.json
    ├── 02-rspec-system/
    │   ├── log.txt
    │   └── step.json
```

**Why this was hard:**
- No documentation showing snapshot output structure
- Design doc exists (`docs/plans/2025-01-21-snapshot-command-design.md`) but not user-facing
- README.md doesn't mention snapshot at all

**Impact:** Spent 5-10 tool calls exploring the structure

#### 3. Metadata Access Patterns

**Problem:** JSON metadata wasn't in expected format

**What the agent tried:**
```bash
# Expected manifest to have step details
cat manifest.json | jq '.steps[] | select(.failed == true) | .label'
# Result: All null values

# Expected step.json to have standard fields
cat step.json | jq '{label, failed, step_key}'
# Result: label was null
```

**Root cause:** Agent made assumptions about JSON structure based on typical CI tools

**Impact:** Couldn't programmatically filter to failed steps easily

## Recommendations

### 1. Add snapshot to README.md

Add a prominent section after the main commands:

```markdown
### Capture Build Snapshots for Offline Analysis

Download all logs and metadata from a build for local investigation:

```bash
# Capture a build snapshot
bktide snapshot https://buildkite.com/org/pipeline/builds/123
bktide snapshot org/pipeline/123

# Snapshot is saved to ~/.bktide/snapshots/org/pipeline/123/
# Contains:
#   - build.json: Build metadata
#   - manifest.json: Fetch status
#   - steps/XX-step-name/log.txt: Full logs for each step
#   - steps/XX-step-name/step.json: Step metadata
```

**Use cases:**
- Analyze failures offline or with external tools
- Share full build context with teammates
- Feed logs into AI agents for debugging
```

### 2. Create User Guide for Snapshots

Create `docs/user/snapshots.md` with:

#### Structure reference
```
~/.bktide/snapshots/
└── {org}/
    └── {pipeline}/
        └── {build-number}/
            ├── manifest.json      # Fetch status, list of steps
            ├── build.json         # Full build metadata from API
            └── steps/
                ├── 01-{label}/
                │   ├── step.json  # Step-level metadata
                │   └── log.txt    # Raw logs
                └── 02-{label}/
                    ├── step.json
                    └── log.txt
```

#### Common patterns
```bash
# Find all failed steps
for dir in ~/.bktide/snapshots/org/pipeline/123/steps/*/; do
  if grep -q '"state".*"failed"' "$dir/step.json" 2>/dev/null; then
    echo "Failed: $(basename $dir)"
  fi
done

# Search logs for specific errors
grep -r "error\|Error\|ERROR" ~/.bktide/snapshots/org/pipeline/123/steps/*/log.txt

# Get step labels and exit codes
for dir in ~/.bktide/snapshots/org/pipeline/123/steps/*/; do
  jq -r '"\(.label // .name): \(.exit_status // "?")"' "$dir/step.json"
done
```

#### AI-friendly analysis
```bash
# Perfect for feeding to Claude Code or other AI agents
bktide snapshot org/pipeline/123
claude "analyze the failures in ~/.bktide/snapshots/org/pipeline/123"
```

### 3. Enhance `bktide snapshot --help`

Make the help text more informative:

```
bktide snapshot <build-ref>

Capture a complete build snapshot for offline analysis

USAGE:
  bktide snapshot https://buildkite.com/org/pipeline/builds/123
  bktide snapshot org/pipeline/123

OPTIONS:
  --output-dir <path>  Override default location (~/.bktide/snapshots/)
  --all               Capture all steps (default: only failed steps)
  --json              Output manifest.json to stdout

OUTPUT STRUCTURE:
  Snapshots are saved to ~/.bktide/snapshots/org/pipeline/build/

  Each snapshot contains:
    - build.json: Build metadata
    - manifest.json: Fetch status and step list
    - steps/NN-name/log.txt: Full logs for each step
    - steps/NN-name/step.json: Step metadata

EXAMPLES:
  # Capture failed steps from a build
  bktide snapshot acme/myapp/12345

  # View the logs
  cat ~/.bktide/snapshots/acme/myapp/12345/steps/01-*/log.txt

  # Find error messages
  grep -r "Error:" ~/.bktide/snapshots/acme/myapp/12345/

See: docs/user/snapshots.md for detailed usage patterns
```

### 4. Add Tip After Snapshot Completes

When snapshot finishes, show helpful next steps:

```
✓ FAILED Update example-lib to new version #12345 1h 2m
         Developer Name • feature/bump-example-lib • abc1234
442 steps: 391 passed, 20 failed, 31 other
  ✗ :rspec: RSpec System (10 more...)

Snapshot saved to ~/.bktide/snapshots/acme/myapp/12345/
  20 step(s) captured

→ View logs: cat ~/.bktide/snapshots/acme/myapp/12345/steps/*/log.txt
→ Search errors: grep -r "Error" ~/.bktide/snapshots/acme/myapp/12345/
→ Step details: ls ~/.bktide/snapshots/acme/myapp/12345/steps/
```

### 5. Fix --help Registration

Ensure snapshot appears in `bktide --help`:

```typescript
// src/index.ts
program
  .command('snapshot <build-ref>')
  .description('Capture build logs and metadata for offline analysis')
  .option('--output-dir <path>', 'Output directory for snapshot')
  .option('--all', 'Capture all steps (default: only failed)')
  .option('--json', 'Output manifest JSON to stdout')
  .action(createCommandHandler(Snapshot));
```

Currently it exists but doesn't show in help output.

## Positive Observations

1. **The tool solved the exact problem** - Got all logs without manual clicking
2. **Clean output structure** - Organized by step number, easy to navigate once discovered
3. **Performant** - Fetched 20 failed steps quickly
4. **Tip about skipping passing steps** - Smart UX to focus on failures

## Context for AI Agents

This feedback comes from an AI agent (Claude Code) using bktide programmatically. Some considerations:

### What AI agents do well:
- Execute complex shell commands once shown the pattern
- Search through log files with grep/jq
- Analyze error messages across multiple files

### What AI agents struggle with:
- Discovering tools without explicit documentation
- Inferring data structures without examples
- Knowing which tool to use without guidance

### Implication:
Tools that are well-documented with usage patterns are significantly more valuable to AI agents. The `bktide snapshot` command is powerful but its value was hidden until explicitly suggested.

## Action Items

Priority order:

1. **High Priority**
   - [ ] Add `snapshot` to README.md with example
   - [ ] Ensure `snapshot` appears in `--help` output
   - [ ] Add tip output after snapshot completes

2. **Medium Priority**
   - [ ] Create `docs/user/snapshots.md` guide
   - [ ] Add common analysis patterns to guide
   - [ ] Document JSON structure for manifest/step files

3. **Low Priority**
   - [ ] Add `--help` to snapshot command itself
   - [ ] Consider `bktide snapshot --example` to show structure
   - [ ] Add to shell completion suggestions

## Related Files

- Design doc: `docs/plans/2025-01-21-snapshot-command-design.md` (excellent!)
- Implementation: `src/commands/Snapshot.ts`
- Current README: `README.md` (no mention of snapshot)

---

**Feedback provided by:** Claude Code (AI agent)
**Use case:** Debugging CI failures in large Rails monorepo
**Outcome:** Successfully analyzed failures, determined they were unrelated to code change
