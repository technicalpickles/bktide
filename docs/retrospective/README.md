# Retrospectives

This directory contains real-world usage feedback and learnings from bktide in production.

## Purpose

Capture insights from actual usage to improve:
- **Discoverability** - How users find features
- **Documentation** - What patterns users need
- **UX** - Pain points in real workflows
- **Completeness** - Missing features or gaps

## What Goes Here

### Usage Reports
Real sessions showing:
- What users tried to do
- What worked well
- Where they got stuck
- What documentation would have helped

### Integration Stories
How bktide fits into larger workflows:
- CI/CD debugging
- Team troubleshooting processes
- Automated analysis
- AI agent integration

### Pain Points
Specific issues encountered:
- Confusing behavior
- Missing documentation
- Workflow friction
- Unexpected results

## Format

Use markdown files with descriptive names:

```
YYYY-MM-DD-context-description.md
```

Examples:
- `2026-01-23-claude-code-usage-feedback.md`
- `2026-01-15-debugging-flaky-tests.md`
- `2026-02-01-team-onboarding-feedback.md`

## Structure

Each retrospective should include:

1. **Context** - What were you trying to do?
2. **Experience** - What actually happened?
3. **Friction** - Where did you get stuck?
4. **Success** - What worked well?
5. **Recommendations** - What would improve it?
6. **Action Items** - Concrete next steps

## Why This Matters

Real usage feedback is invaluable:
- Shows actual problems vs theoretical ones
- Reveals documentation gaps
- Identifies missing features
- Proves value of existing features

## Contributing

If you use bktide and have feedback:

1. Create a retrospective document
2. Be specific about what you tried
3. Include examples of commands/errors
4. Suggest concrete improvements
5. Note what worked well too!

Even small feedback helps:
- "This command wasn't in the README"
- "I expected X but got Y"
- "This saved me 2 hours"

## Relationship to Other Docs

- **Plans** (`docs/plans/`) - Design before implementation
- **Retrospectives** (here) - Learnings after use
- **User docs** (`docs/user/`) - How to use features
- **Developer docs** (`docs/developer/`) - How to build features

Retrospectives often lead to:
- New plans
- Updated user documentation
- Bug fixes
- Feature requests

## Recent Retrospectives

<!-- Update this list as new retrospectives are added -->

- [2026-01-23: Claude Code Usage](2026-01-23-claude-code-usage-feedback.md) - AI agent debugging CI failures
- [2025-12-09: Smart Reference Code Review](2025-12-09-smart-reference-code-review.md) - Code review of URL parsing feature
- [2025-12: Reference Format Feedback](2025-12-reference-format-feedback.md) - UX friction with build reference formats
