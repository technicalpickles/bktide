# Extract SmartShow Subcommands Plan

**Date:** 2025-12-10  
**Status:** Planning  
**Related:** PR #2 Smart Reference Command

## Problem

PR #2 introduces SmartShow which implements two new capabilities:
1. **Pipeline detail view** - Shows pipeline metadata + recent builds
2. **Step log viewing** - Fetches and displays logs for specific steps

However, these capabilities are only accessible via smart references (URLs, `org/pipeline` format). They lack dedicated subcommands, making them:
- Hard to discover (`bktide --help` doesn't show them)
- Inconsistent with existing CLI design (every other resource has explicit commands)
- Difficult to document and explain

## Goal

Extract the embedded functionality into proper subcommands while maintaining SmartShow's smart reference routing capability.

## Solution Architecture

### New Command Structure

```bash
# Explicit subcommands (new)
bktide pipeline <reference>                 # Pipeline detail view
bktide logs <build-ref> [step-id]          # Step logs

# Smart references (existing SmartShow, now routes to above)
bktide org/pipeline                        # Routes to: pipeline command
bktide https://buildkite.com/org/pipeline/builds/123?sid=abc  # Routes to: logs command
bktide org/pipeline/123                    # Routes to: build command (already exists)
```

### Key Principle

**SmartShow becomes a router, not an implementer.**

All actual functionality lives in dedicated commands. SmartShow's job is to:
1. Parse the reference
2. Determine which command to invoke
3. Map options and invoke the appropriate command

## Implementation Plan

### Phase 1: Extract ShowPipeline Command

**New file:** `src/commands/ShowPipeline.ts`

**Signature:**
```typescript
export interface ShowPipelineOptions extends BaseCommandOptions {
  reference: string;  // org/pipeline or URL
  count?: number;     // Number of recent builds (default: 20)
}

export class ShowPipeline extends BaseCommand {
  static requiresToken = true;
  async execute(options: ShowPipelineOptions): Promise<number>
}
```

**Functionality:**
- Parse reference to extract org/pipeline
- Fetch pipeline metadata via GraphQL
- Fetch recent builds via REST API
- Format and display using existing pipeline-detail formatters

**CLI Registration:**
```bash
bktide pipeline <reference>
  --count <n>     # Number of recent builds (default: 20)
  # Standard options: --format, --debug, --token, etc.
```

**Examples:**
```bash
bktide pipeline acme/example-pipeline
bktide pipeline https://buildkite.com/acme/example-pipeline
bktide pipeline acme/example-pipeline --count 50
```

---

### Phase 2: Extract ShowLogs Command

**New file:** `src/commands/ShowLogs.ts`

**Signature:**
```typescript
export interface ShowLogsOptions extends BaseCommandOptions {
  buildRef: string;     // org/pipeline/build
  stepId?: string;      // Step/job ID
  full?: boolean;       // Show all lines
  lines?: number;       // Show last N lines (default: 50)
  save?: string;        // Save to file path
}

export class ShowLogs extends BaseCommand {
  static requiresToken = true;
  async execute(options: ShowLogsOptions): Promise<number>
}
```

**Functionality:**
- Parse buildRef to extract org/pipeline/build
- Fetch build details to get step/job information
- Match stepId to find the specific job
- Fetch logs via REST API
- Handle display options (--full, --lines, --save)
- Format and display using existing step-logs formatters

**CLI Registration:**
```bash
bktide logs <build-ref> [step-id]
  --full          # Show all log lines
  --lines <n>     # Show last N lines (default: 50)
  --save <path>   # Save logs to file
  # Standard options: --format, --debug, --token, etc.
```

**Step ID Resolution:**
- If `step-id` provided as argument: use it
- If `build-ref` is URL with `?sid=`: extract from query param
- If neither: error with helpful message listing available steps (future enhancement)

**Examples:**
```bash
# With explicit step ID
bktide logs acme/example-pipeline/123 019adb19-bd83-4149-b2a7-ece1d7a41c9d

# With URL containing step ID
bktide logs "https://buildkite.com/acme/example-pipeline/builds/123?sid=019adb19-bd83-4149-b2a7-ece1d7a41c9d"

# With options
bktide logs acme/example-pipeline/123 019adb19... --full
bktide logs acme/example-pipeline/123 019adb19... --lines 100
bktide logs acme/example-pipeline/123 019adb19... --save logs.txt
```

---

### Phase 3: Refactor SmartShow to Route

**Changes to:** `src/commands/SmartShow.ts`

**Before (current PR #2):**
```typescript
private async showPipeline(ref, options) {
  // 60+ lines of implementation
  // Fetches data, formats, displays
}

private async showBuildWithStep(ref, options) {
  // 80+ lines of implementation
  // Fetches build, finds step, gets logs, formats, displays
}
```

**After (refactored):**
```typescript
private async showPipeline(ref, options) {
  const pipelineCommand = new ShowPipeline();
  return await pipelineCommand.execute({
    ...options,
    reference: `${ref.org}/${ref.pipeline}`,
    count: 20,  // Default for smart references
  });
}

private async showBuildWithStep(ref, options) {
  const logsCommand = new ShowLogs();
  return await logsCommand.execute({
    ...options,
    buildRef: `${ref.org}/${ref.pipeline}/${ref.buildNumber}`,
    stepId: ref.stepId,
  });
}
```

**SmartShow's job becomes:**
1. Parse reference using `parseBuildkiteReference()`
2. Route to appropriate command based on reference type
3. Map parsed components to command options

---

### Phase 4: Update CLI Registration

**File:** `src/index.ts`

**Add new commands:**
```typescript
program
  .command('pipeline')
  .description('Show pipeline details and recent builds')
  .argument('<reference>', 'Pipeline reference (org/pipeline or URL)')
  .option('-n, --count <n>', 'Number of recent builds to show', '20')
  .action(createCommandHandler(ShowPipeline));

program
  .command('logs')
  .description('Show logs for a build step')
  .argument('<build-ref>', 'Build reference (org/pipeline/build or URL)')
  .argument('[step-id]', 'Step/job ID (or include in URL with ?sid=)')
  .option('--full', 'Show all log lines')
  .option('--lines <n>', 'Show last N lines', '50')
  .option('--save <path>', 'Save logs to file')
  .action(createCommandHandler(ShowLogs));
```

**Note:** These need to be registered BEFORE the `command:*` handler that routes unknown commands to SmartShow, otherwise they won't be recognized as explicit commands.

---

## File Changes Summary

### New Files
1. `src/commands/ShowPipeline.ts` - Pipeline detail command
2. `src/commands/ShowLogs.ts` - Step logs command
3. `test/commands/ShowPipeline.test.ts` - Pipeline tests
4. `test/commands/ShowLogs.test.ts` - Logs tests

### Modified Files
1. `src/commands/SmartShow.ts` - Refactor to route instead of implement
2. `src/commands/index.ts` - Export new commands
3. `src/index.ts` - Register new commands
4. `README.md` - Document new commands
5. `docs/user/smart-reference.md` - Update to show both approaches

### Unchanged Files (reused)
- `src/formatters/pipeline-detail/*` - Already implemented
- `src/formatters/step-logs/*` - Already implemented
- `src/utils/parseBuildkiteReference.ts` - Already implemented
- `src/services/BuildkiteClient.ts` - Already has needed methods
- `src/services/BuildkiteRestClient.ts` - Already has log fetching

---

## Benefits

### Discoverability
```bash
$ bktide --help
Commands:
  viewer                          Show logged in user information
  orgs                           List organizations
  pipelines                      List pipelines for an organization
  pipeline <reference>           Show pipeline details and recent builds  ← NEW
  builds                         List builds for the current user
  build <build>                  Show details for a specific build
  logs <build-ref> [step-id]     Show logs for a build step              ← NEW
  annotations <build>            Show annotations for a build
  token                          Manage API tokens
```

### Consistency
Every resource type now has explicit commands:
- Organizations → `orgs`
- Pipelines → `pipelines` (list), `pipeline` (show)
- Builds → `builds` (list), `build` (show)
- Logs → `logs` (show)
- Annotations → `annotations` (show)

### Flexibility
Users can choose their preferred approach:
```bash
# Explicit commands (discoverable, documented)
bktide pipeline acme/example-pipeline
bktide logs acme/example-pipeline/123 <step-id>

# Smart references (convenient, copy-paste URLs)
bktide acme/example-pipeline
bktide "https://buildkite.com/acme/example-pipeline/builds/123?sid=<step-id>"
```

### Future-Proofing
Each command can grow independently:
```bash
# Future enhancements to logs command
bktide logs <build-ref> --list              # List available steps
bktide logs <build-ref> <step-id> --follow  # Stream logs
bktide logs <build-ref> <step-id> --grep "ERROR"  # Filter logs
```

---

## Testing Strategy

### Unit Tests
- `ShowPipeline.test.ts` - Test pipeline fetching and formatting
- `ShowLogs.test.ts` - Test log fetching with various options
- Update `SmartShow.test.ts` - Verify routing logic

### Integration Tests
- End-to-end test for each command
- Verify SmartShow routes to correct commands
- Test all format options (plain, json, alfred)

### Manual Testing
- [ ] `bktide pipeline org/pipeline` works
- [ ] `bktide logs org/pipeline/123 step-id` works
- [ ] SmartShow still routes correctly
- [ ] Help text is clear and accurate
- [ ] Error messages are helpful

---

## Documentation Updates

### README.md
Add sections:
- "Show Pipeline Details" (under pipeline operations)
- "View Step Logs" (new section)

### docs/user/smart-reference.md
Update to explain:
- Smart references are shortcuts
- Explicit commands are also available
- Show examples of both approaches

---

## Migration Path for PR #2

1. **Merge PR #2 as-is** - Gets smart references working
2. **Follow-up PR** - Extract to subcommands (this plan)

OR

1. **Pause PR #2** - Implement this plan first
2. **Updated PR #2** - Include extracted subcommands

**Recommendation:** Merge PR #2, then immediately do extraction. This allows smart references to be tested while we refactor.

---

## Success Criteria

✅ `bktide pipeline <ref>` shows pipeline details  
✅ `bktide logs <ref> <step-id>` shows step logs  
✅ `bktide --help` lists both new commands  
✅ SmartShow still works for all reference types  
✅ All tests pass  
✅ Documentation updated  
✅ No code duplication (logic in commands, routing in SmartShow)

---

## Future Enhancements (Out of Scope)

- `bktide logs <build-ref> --list` - List available steps in a build
- `bktide logs <build-ref> <step-id> --follow` - Stream logs for running builds
- `bktide logs <build-ref> <step-id> --grep <pattern>` - Filter log content
- `bktide pipeline <ref> --edit` - Open pipeline settings in browser
