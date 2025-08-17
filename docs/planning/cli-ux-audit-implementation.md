# CLI UX Audit - Implementation Plan

## Current Status (Updated)

### ✅ Completed (Week 1-3)
- **Core Improvements**: All 3 core improvements completed (Week 1-2)
  - Width-aware tables for responsive layouts
  - Structured error templates with contextual hints
  - Next-steps hints for better discoverability
- **Polish Phase**: All 3 polish improvements completed (Week 2-3)
  - Width-aware help text with terminal width detection
  - Color-blind safe palette (blue/orange instead of green/red)
  - Progress bars for long operations (determinate and indeterminate)
  - **Progress API Refactoring**: Unified Progress class with factory methods
  - **Command Migration**: All commands migrated to Progress API
  - **Cleanup**: Removed obsolete spinner.ts and test files
- **Bonus Features**: 
  - TTY detection fix for clean piped output
  - `--tips`/`--no-tips` flags for fine-grained control
- **Phase 0**: Baseline UX partially complete
  - `--quiet` flag implemented
  - Commander suggestions enabled

### 🚀 Next Priorities
1. **Quick Wins** (remaining): Exit handling unification, ASCII flag integration, CI detection
2. **Testing** (Week 3): Snapshot tests, documentation updates
3. **Rollout** (Week 4): Integration testing, release preparation

## Executive Summary

This plan addresses critical UX improvements identified in the CLI audit, prioritizing high-impact/low-effort changes that improve developer experience without breaking existing functionality. The implementation is structured in 4 weeks of incremental improvements, focusing on exit handling, width-aware displays, accessibility, and automation safety.

**Progress Update**: Week 1-2 Core Improvements and Week 2-3 Polish phase are now complete. The CLI has significantly improved UX with responsive layouts, accessible colors, structured errors, and progress indicators. Remaining work focuses on testing, documentation, and final quick wins.

## Bonus Improvements (Not in Original Plan)

These improvements were discovered and implemented during development:

1. **TTY Detection for Piped Output** ✅
   - Fixed decorative output appearing in pipes
   - Ensures clean automation-friendly output
   - Files: `reporter.ts`

2. **Tips System (`--tips`/`--no-tips`)** ✅  
   - Fine-grained control over helpful hints
   - Smart interaction with `--quiet` flag
   - Files: `index.ts`, `reporter.ts`, all commands

## Impact vs Effort Matrix

### Quick Wins (High Impact, Low Effort) - Week 1
1. **Unify exit handling** - Currently mixed `process.exit()` vs `process.exitCode`
   - Status: ⏳ TODO
   - Impact: HIGH - Improves testability, cleanup handling
   - Effort: LOW - Simple refactor, ~2 hours
   - Files: `cli-error-handler.ts`, `index.ts`

2. **Add `--quiet` flag** - Suppress non-error output for automation
   - Status: ✅ COMPLETED (Phase 0)
   - Impact: HIGH - Essential for CI/automation
   - Effort: LOW - Flag + reporter gating, ~2 hours
   - Files: `index.ts`, `reporter.ts`

3. **ASCII symbol fallback** - Support limited terminals
   - Status: 🔄 PARTIAL (symbols exist, need --ascii flag integration)
   - Impact: MEDIUM - Accessibility improvement
   - Effort: LOW - Simple toggle, ~1 hour
   - Files: `ui/symbols.ts`, `theme.ts`

4. **Improve CI/spinner detection** - Add explicit CI env check
   - Status: ⏳ TODO
   - Impact: MEDIUM - Cleaner CI logs
   - Effort: LOW - Add env checks, ~1 hour
   - Files: `spinner.ts`

### Core Improvements (High Impact, Medium Effort) - Week 1-2
5. **Width-aware tables** - Prevent broken layouts in narrow terminals
   - Status: ✅ COMPLETED
   - Impact: HIGH - Critical for usability
   - Effort: MEDIUM - Truncation/wrapping logic, ~4 hours
   - Files: `ui/width.ts`, `ui/table.ts`, `reporter.ts`

6. **Structured error templates** - Sectioned errors with hints
   - Status: ✅ COMPLETED
   - Impact: HIGH - Better error UX
   - Effort: MEDIUM - Template system, ~3 hours
   - Files: `formatters/errors/PlainTextFormatter.ts`

7. **Next-steps hints** - Success messages with follow-up actions
   - Status: ✅ COMPLETED (with bonus tips system)
   - Impact: MEDIUM - Improves discoverability
   - Effort: LOW - Add to success paths, ~2 hours
   - Files: `ManageToken.ts`, `ListBuilds.ts`

### Polish (Medium Impact, Medium Effort) - Week 2-3
8. **Width-aware help** - Responsive help text
   - Status: ✅ COMPLETED
   - Impact: MEDIUM - Better readability
   - Effort: MEDIUM - Commander customization, ~3 hours
   - Files: `ui/help.ts`, `index.ts`

9. **Color-blind safe palette** - Semantic colors + labels
   - Status: ✅ COMPLETED
   - Impact: MEDIUM - Accessibility
   - Effort: LOW - Update color choices, ~1 hour
   - Files: `theme.ts`

10. **Progress bars** - For long operations
    - Status: ✅ COMPLETED
    - Impact: MEDIUM - Better feedback
    - Effort: MEDIUM - Progress tracking, ~4 hours
    - Files: `ui/progress.ts` (created)

### Testing & Documentation (Critical, Medium Effort) - Week 3
11. **Snapshot testing** - Ensure output stability
    - Status: ⏳ TODO
    - Impact: HIGH - Prevents regressions
    - Effort: MEDIUM - Test setup, ~4 hours
    - Files: New test files

12. **Documentation updates** - Flag docs, troubleshooting
    - Status: ⏳ TODO
    - Impact: MEDIUM - User success
    - Effort: LOW - Doc updates, ~2 hours
    - Files: README.md, docs/

## Detailed Implementation Plan

### Week 1: Foundation (Quick Wins + Core Start)

#### Day 1-2: Exit and Flags
```typescript
// 1. Unify exit handling
// cli-error-handler.ts - REMOVE process.exit(), just set exitCode
export function displayCLIError(error: unknown, debug = false, format?: string): void {
  // ... existing formatting ...
  process.exitCode = 1; // Don't call process.exit()
}

// 2. Add --quiet flag
// index.ts
program.option('-q, --quiet', 'Suppress non-error output (plain format only)');

// reporter.ts
export class Reporter {
  constructor(private format: string = 'plain', private quiet = false) {}
  
  private shouldSuppress(): boolean {
    return this.quiet || this.isMachine();
  }
  
  info(message: string): void {
    if (this.shouldSuppress()) return;
    // ... existing implementation
  }
}
```

#### Day 2-3: Accessibility Basics
```typescript
// 3. ASCII symbols
// ui/symbols.ts (NEW)
export function useAscii(): boolean {
  return process.env.BKTIDE_ASCII === '1' || 
         process.argv.includes('--ascii');
}

export const SYMBOLS = useAscii() 
  ? { success: '[OK]', warn: '[!]', error: '[X]', info: '[i]' }
  : { success: '✓', warn: '⚠︎', error: '✖', info: 'ℹ︎' };

// 4. Better CI detection
// ui/spinner.ts
function shouldDisableSpinner(): boolean {
  return !process.stderr.isTTY || 
         !!process.env.CI ||
         !!process.env.NO_COLOR ||
         !!process.env.BKTIDE_NO_SPINNER ||
         isMachineFormat(format);
}
```

#### Day 3-4: Width-Aware Tables
```typescript
// 5. Width utilities
// ui/width.ts (NEW)
export function termWidth(): number {
  return Math.max(40, process.stdout.columns || 80);
}

export function truncate(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, Math.max(0, maxWidth - 1)) + '…';
}

export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxWidth) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines;
}

// Update reporter.ts
table(rows: string[][], options?: TableOptions): void {
  if (!rows.length || this.shouldSuppress()) return;
  
  const width = termWidth();
  const cols = rows[0].length;
  const colWidth = Math.floor((width - 2 * (cols - 1)) / cols);
  
  const formatted = rows.map(row => 
    row.map(cell => truncate(cell ?? '', colWidth))
       .join('  ')
  );
  
  this.writeStdout(formatted.join('\n'));
}
```

### Week 2: Enhanced UX

#### Day 5-6: Error Templates
```typescript
// 6. Structured errors
// formatters/errors/PlainTextFormatter.ts
formatError(error: unknown, options?: ErrorFormatterOptions): string {
  const sections: string[] = [];
  
  // Title section
  sections.push(COLORS.error(`ERROR   ${this.getErrorMessage(error)}`));
  
  // Cause section
  const cause = this.getErrorCause(error);
  if (cause) {
    sections.push(COLORS.muted(`CAUSE   ${cause}`));
  }
  
  // Stack (debug only)
  if (options?.debug && this.getStackTrace(error)) {
    sections.push(COLORS.muted('STACK'));
    sections.push(this.getStackTrace(error));
  }
  
  // Hints section
  sections.push('');
  sections.push(COLORS.info('HINT    Try these:'));
  sections.push('        • Run with --debug for stack trace');
  sections.push('        • Check token: bktide token --check');
  sections.push('        • See help: bktide --help');
  
  return sections.join('\n');
}
```

#### Day 7-8: Success Hints
```typescript
// 7. Next-steps in commands
// commands/ManageToken.ts
if (action === 'store') {
  // ... existing store logic ...
  const reporter = new Reporter(options.format, options.quiet);
  reporter.success('Token stored successfully');
  reporter.info('Next: Verify with "bktide token --check"');
}

// commands/ListBuilds.ts
// After successful listing
const reporter = new Reporter(options.format, options.quiet);
if (builds.length > 0) {
  reporter.success(`Found ${builds.length} builds`);
  if (builds.length === options.count) {
    reporter.info(`Tip: Use --count ${options.count * 2} to see more`);
  }
}
```

### Week 3: Testing & Polish

#### Day 9-10: Snapshot Tests
```typescript
// tests/output-snapshots.test.ts (NEW)
import { describe, it, expect } from 'vitest';
import { PlainTextFormatter } from '../src/formatters/builds/PlainTextFormatter';

describe('Output Snapshots', () => {
  it('formats builds correctly', () => {
    const formatter = new PlainTextFormatter();
    const builds = [/* test data */];
    const output = formatter.format(builds);
    expect(output).toMatchSnapshot();
  });
  
  it('formats errors with hints', () => {
    const formatter = new PlainTextErrorFormatter();
    const error = new Error('Test error');
    const output = formatter.formatError(error, { debug: false });
    expect(output).toMatchSnapshot();
  });
});
```

#### Day 11: Color & Accessibility
```typescript
// 9. Color-blind safe palette
// ui/theme.ts
export const COLORS = {
  // Use blue instead of pure green (better for red-green colorblind)
  success: (s: string) => colorEnabled() ? chalk.blue(s) : s,
  // Use orange instead of pure red
  error: (s: string) => colorEnabled() ? chalk.rgb(255, 140, 0)(s) : s,
  // Keep yellow for warnings
  warn: (s: string) => colorEnabled() ? chalk.yellow(s) : s,
  // Cyan for info
  info: (s: string) => colorEnabled() ? chalk.cyan(s) : s,
  // Gray for muted
  muted: (s: string) => colorEnabled() ? chalk.gray(s) : s
};

// Always include semantic labels with colors
// "ERROR" not just red text
// "SUCCESS" not just blue text
```

#### Day 12-14: Documentation
```markdown
# docs/cli-ux.md (NEW)

## CLI Behavior

### Output Streams
- **STDOUT**: Command results, JSON/Alfred output
- **STDERR**: Errors (plain format), warnings, prompts

### Color Control
- `--color auto` (default): Color in TTY, no color in pipes
- `--color always`: Force color output
- `--color never`: Disable all color
- `NO_COLOR=1`: Environment variable to disable color

### Quiet Mode
- `--quiet` or `-q`: Suppress info/success messages
- Errors still display
- No effect on JSON/Alfred formats

### Accessibility
- `--ascii`: Use ASCII symbols instead of Unicode
- `BKTIDE_ASCII=1`: Environment variable for ASCII mode
- Color-blind safe palette with semantic labels

### CI/Automation
- Spinner auto-disabled in CI environments
- Machine formats (JSON/Alfred) never include decorations
- Exit codes: 0 = success, 1 = error
```

### Week 4: Rollout & Monitoring

#### Day 15-16: Integration Testing
- Test all commands with new flags
- Verify machine format stability
- Check CI behavior
- Validate accessibility modes

#### Day 17-18: Release Prep
- Update CHANGELOG.md
- Create migration guide for users
- Prepare release notes highlighting UX improvements
- Tag release candidate

#### Day 19-20: Release & Monitor
- Release minor version (non-breaking)
- Monitor issue tracker
- Gather feedback
- Plan follow-up improvements

## Risk Mitigation

### Backward Compatibility
- All changes are additive (new flags, new behavior)
- Machine formats (JSON/Alfred) remain unchanged
- Default behavior preserved where possible

### Testing Strategy
- Snapshot tests prevent output regression
- Matrix testing: TTY/non-TTY × formats × color modes
- CI validation before merge
- Manual testing checklist

### Rollback Plan
- Changes are incremental and isolated
- Each week's work can be released independently
- Feature flags for major changes if needed

## Success Metrics

### Quantitative
- Zero regression in machine format outputs
- Exit codes remain consistent
- Performance within 5% of baseline

### Qualitative
- Improved readability in narrow terminals
- Better error messages with actionable hints
- Cleaner CI logs (no spinner artifacts)
- Accessibility for color-blind users

## Follow-up Opportunities

After this implementation:
1. Interactive mode with prompts/confirmations
2. Configurable output columns for tables
3. Shell completion scripts
4. Localization support
5. Custom themes via config file
6. Pager integration for long outputs
7. Structured logging with levels

## Conclusion

This plan delivers significant UX improvements through incremental, low-risk changes. Week 1 focuses on critical fixes and quick wins. Week 2 enhances the user experience with better errors and hints. Week 3 ensures quality through testing and documentation. Week 4 validates and releases the improvements.

The modular approach allows for adjustments based on feedback and ensures each phase delivers value independently. Machine format stability is preserved throughout, maintaining backward compatibility for automation users.
