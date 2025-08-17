# CLI UX Improvements Changelog

## Unreleased

### Week 1-2: Core Improvements ✅

#### Added
- **Width-aware tables**: Tables now automatically adjust to terminal width for better readability
- **Structured error templates**: Errors display in clear sections (ERROR, CAUSE, DETAILS, HINTS) 
- **Next-steps hints**: Commands provide helpful suggestions after successful operations
- **Tips system**: `--tips` and `--no-tips` flags for controlling helpful hints
- **TTY detection**: Decorative output automatically hidden when piping

#### Changed
- Error output now includes contextual troubleshooting hints
- Tables use responsive column widths instead of fixed sizes
- Success messages include actionable next steps

### Week 2-3: Polish Phase ✅

#### Added
- **Width-aware help text**: Help output now wraps based on terminal width (max 100 chars)
  - Created custom `WidthAwareHelp` class extending Commander's Help
  - Automatic text wrapping for long descriptions
  
- **Progress bars**: New progress indication system for long operations
  - `ProgressBar` class for determinate progress (with percentage/counts)
  - `IndeterminateProgress` class for operations of unknown duration
  - Helper functions `withProgress()` and `withIndeterminateProgress()`
  - TTY-aware (hidden in pipes, CI, machine formats)
  - Files: `src/ui/progress.ts`

#### Changed
- **Color-blind safe palette**: Updated color scheme for ~8% of users with color blindness
  - Success: Blue instead of green
  - Error: Orange (rgb(255, 140, 0)) instead of red
  - Warnings: Yellow (unchanged, universally visible)
  - Info: Cyan (good contrast)
  - All colored output includes semantic labels (ERROR, SUCCESS, WARNING)
  - Files: `src/ui/theme.ts`

#### Technical Details
- New files created:
  - `src/ui/help.ts` - Width-aware help formatter
  - `src/ui/progress.ts` - Progress bar implementation
  - `src/ui/width.ts` - Terminal width utilities
  - `src/ui/table.ts` - Responsive table rendering
  - `src/ui/reporter.ts` - Unified output reporter
  - `src/ui/spinner.ts` - Loading spinners
  - `src/ui/symbols.ts` - Unicode/ASCII symbols

### Remaining Work

#### Quick Wins (TODO)
- [ ] Unify exit handling (process.exit() vs process.exitCode)
- [ ] Complete ASCII flag integration (`--ascii` flag wiring)
- [ ] Improve CI/spinner detection

#### Week 3: Testing & Documentation (Next)
- [ ] Snapshot testing for output stability
- [ ] Documentation updates
- [ ] README updates
- [ ] Migration guide

#### Week 4: Rollout
- [ ] Integration testing
- [ ] Release preparation
- [ ] Monitoring

## Migration Notes

### For Users
- No breaking changes - all improvements are additive
- Machine formats (JSON, Alfred) remain unchanged
- New flags available: `--quiet`, `--tips`, `--no-tips`, `--color`
- Error messages now include helpful hints
- Tables and help text will look better in narrow terminals

### For Developers
- Progress bars available via `import { ProgressBar, IndeterminateProgress } from './ui/progress.js'`
- Use `withProgress()` helper for async operations with progress tracking
- Color palette in `theme.ts` is now accessibility-focused
- Width utilities available in `ui/width.ts` for responsive displays
