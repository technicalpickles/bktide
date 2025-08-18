# CLI Visual Design - Before & After Examples

## Overview

This document shows concrete before/after examples of the visual design improvements, demonstrating how color, typography, and formatting enhance the CLI user experience.

## Build List Command

### Before (Current)
```
✓ Builds retrieved                     
ℹ︎ TIP: Use --count 20 to see more builds
ℹ︎ TIP: Filter by state: --state failed
ℹ︎ TIP: Filter by branch: --branch main
Found 3 builds:
PIPELINE               NUMBER                 STATE                  BRANCH              
payments               1234                   PASSED                 main
api-server             5678                   FAILED                 fix-bug
frontend               9101                   RUNNING                develop

Showing 3 builds. Use --count and --page options to see more.
```

### After (With Visual Design)
```
Build Results
─────────────────────────────────────────

PIPELINE     BUILD    STATUS       BRANCH    CREATED BY
payments     #1234    ✓ PASSED     main      John Doe
api-server   #5678    ✖ FAILED     fix-bug   Jane Smith
frontend     #9101    ↻ RUNNING    develop   Bot

Showing 3 builds across 2 organizations

┌─ Tips ────────────────────────────
│ • Use --count 20 to see more builds
│ • Filter by state: --state failed
│ • Use --org to focus on a specific organization
└────────────────────────────────────
```

**Visual Improvements:**
- **Bold underlined heading** makes section clear
- **Build numbers** in cyan as identifiers (#1234)
- **Status colors**: Blue for PASSED, Orange for FAILED, Cyan for RUNNING
- **Status symbols**: ✓, ✖, ↻ provide quick visual cues
- **Tips in dimmed box** at the end, clearly auxiliary
- **Summary line dimmed** to not compete with data

## Organization List

### Before (Current)
```
✓ Organizations retrieved          
Your organizations:
NAME                                          SLUG                                       
Gusto                                         gusto
Personal Workspace                            personal
```

### After (With Visual Design)
```
Your Organizations
──────────────────────────────────────────

NAME                  SLUG       PIPELINES
Gusto                 gusto      42
Personal Workspace    personal   3

2 organizations accessible
```

**Visual Improvements:**
- **Bold underlined heading** creates clear section
- **Bold column headers** improve scannability
- **Pipeline counts** in magenta to stand out
- **Summary dimmed** as auxiliary information

## Error States

### Before (Current)
```
Error: Authentication failed. Your token may be invalid or expired.
```

### After (With Visual Design)
```
✖ Error: Authentication Failed

The provided token is invalid or expired.

To fix this:
  1. Get a new token from Buildkite
  2. Run: bktide token --store
  3. Try your command again

Need help? Run: bktide token --help
```

**Visual Improvements:**
- **Orange error symbol** (✖) immediately visible
- **Bold "Error"** emphasizes severity
- **Clear structure** with problem → solution → help
- **Numbered steps** for actionable guidance
- **Dimmed help text** as auxiliary information

## Empty States

### Before (Current)
```
No builds found.
Try specifying an organization with --org to narrow your search.
```

### After (With Visual Design)
```
No builds found

Try specifying an organization with --org gusto
Try a different branch or remove the --branch filter
Use --count 20 to increase the number of results
```

**Visual Improvements:**
- **Main message dimmed** (not an error, just empty)
- **Commands highlighted** within suggestions (--org stands out)
- **Multiple suggestions** without overwhelming

## Pipeline Details

### Before (Current)
```
Pipeline: payments
Organization: gusto
Repository: github.com/gusto/payments
Default Branch: main
```

### After (With Visual Design)
```
Pipeline Details
────────────────────────────────────

Pipeline:        payments
Organization:    gusto
Repository:      github.com/gusto/payments
Default Branch:  main
Build Count:     1,234

Recent Activity
────────────────────────────────────

#1236  ✓ PASSED   main       2 min ago
#1235  ✖ FAILED   fix-bug    15 min ago
#1234  ✓ PASSED   develop    1 hour ago
```

**Visual Improvements:**
- **Section headers** with underlines create clear divisions
- **Labels in bold** for easy scanning
- **URLs in cyan** with underline (clickable appearance)
- **Numbers in magenta** (1,234) stand out
- **Time in dim** as secondary information

## Build Annotation

### Before (Current)
```
Annotations for build #1234:
Context: test-results
Style: error
Deployment failed: Database migration error on line 42
```

### After (With Visual Design)
```
Build #1234 Annotations
────────────────────────────────────

✖ test-results (error)
  
  Deployment failed: Database migration error on line 42
  
  Stack trace:
    at migrate() line 42
    at deploy() line 15
    at main() line 3

⚠ code-coverage (warning)
  
  Coverage dropped below threshold: 78% (minimum: 80%)

ℹ security-scan (info)
  
  All security checks passed
```

**Visual Improvements:**
- **Status symbols** match annotation style (✖, ⚠, ℹ)
- **Context in bold** with style in parentheses
- **Indented content** for clear hierarchy
- **Code/stack traces** with consistent indentation

## Interactive Token Setup

### Before (Current)
```
Enter your Buildkite API token: 
Token stored successfully.
```

### After (With Visual Design)
```
Buildkite Token Setup
────────────────────────────────────

To get your API token:
  1. Go to https://buildkite.com/user/api-access-tokens
  2. Click "New API Token"
  3. Add these permissions:
     • read_builds
     • read_organizations
     • read_pipelines
  4. Copy the generated token

Enter your Buildkite API token: **********************

✓ Token validated and stored securely

Your access:
  • Organizations: 2 (gusto, personal)
  • GraphQL API: ✓ Enabled
  • REST API: ✓ Enabled
```

**Visual Improvements:**
- **Step-by-step instructions** before input
- **URL in cyan** appears clickable
- **Permissions bulleted** for clarity
- **Success symbol** (✓) confirms action
- **Access summary** shows what token enables

## Color Legend (Help Display)

### In Help Text
```
Status Colors:
  ✓ PASSED     Success (blue)
  ✖ FAILED     Error (orange) 
  ↻ RUNNING    Active (cyan)
  ⚠ BLOCKED    Warning (yellow)
  − SKIPPED    Inactive (gray)

Typography:
  Bold Headers    Primary sections
  Regular Text    Standard information
  Dimmed Text     Tips and auxiliary info
  #123           Identifiers (cyan)
  42             Counts (magenta)
```

## Responsive Design Examples

### Wide Terminal (120+ columns)
```
Build Results
────────────────────────────────────────────────────────────────────────────

PIPELINE           BUILD    STATUS       BRANCH        COMMIT        CREATED BY      TIME
payments-service   #1234    ✓ PASSED     main         a3f2b1c       John Doe        2 min ago
api-gateway        #5678    ✖ FAILED     feature/auth  d4e5f6g       Jane Smith      15 min ago
frontend-app       #9101    ↻ RUNNING    develop       h7i8j9k       Deploy Bot      just now

Showing 3 builds across 2 organizations

┌─ Tips ──────────────────────────────────────────────────────────
│ • Use --count 20 to see more builds
│ • Filter by state: --state failed
│ • Use --org to focus on a specific organization
└─────────────────────────────────────────────────────────────────
```

### Narrow Terminal (60 columns)
```
Build Results
─────────────────────────────────

PIPELINE      BUILD   STATUS    
payments      #1234   ✓ PASSED  
api-server    #5678   ✖ FAILED  
frontend      #9101   ↻ RUNNING 

3 builds (2 orgs)

💡 Use --count 20 for more
💡 Filter: --state failed
💡 Focus: --org <name>
```

### No Color Mode (NO_COLOR=1)
```
== Build Results ==

PIPELINE     BUILD    STATUS       BRANCH    
payments     #1234    [OK] PASSED  main      
api-server   #5678    [FAIL] FAILED fix-bug  
frontend     #9101    [RUN] RUNNING develop   

(Showing 3 builds)

(Tip: Use --count 20 to see more builds)
(Tip: Filter by state: --state failed)
```

## ASCII Mode (--ascii flag)
```
Build Results
============================================

PIPELINE     BUILD    STATUS           BRANCH    
payments     #1234    [OK] PASSED      main      
api-server   #5678    [FAIL] FAILED    fix-bug   
frontend     #9101    [RUN] RUNNING    develop   

Showing 3 builds

[i] Tips:
  * Use --count 20 to see more builds
  * Filter by state: --state failed
  * Use --org to focus on organization
```

## Implementation Priority

### Phase 1: Core Visual Improvements
1. **Build status colors** - Immediate impact on usability
2. **Bold headers** - Better section separation
3. **Dimmed tips** - Reduce visual noise
4. **Status symbols** - Quick visual scanning

### Phase 2: Enhanced Formatting
1. **Tip boxes** - Better visual grouping
2. **Identifier colors** - Distinguish data types
3. **Empty state improvements** - Better guidance
4. **Error formatting** - Clearer problem/solution

### Phase 3: Advanced Features
1. **Responsive layouts** - Adapt to terminal width
2. **Theme customization** - User preferences
3. **Animation effects** - Smooth transitions
4. **Color scheme detection** - Match terminal theme

## Testing Considerations

### Accessibility Testing
```bash
# Test without colors
NO_COLOR=1 bin/bktide builds

# Test with ASCII mode
bin/bktide builds --ascii

# Test in narrow terminal
resize -s 24 60; bin/bktide builds

# Test with screen reader
# Should announce: "Build Results. Table with 4 rows..."
```

### Visual Testing
```bash
# Test in different terminals
# - iTerm2 (macOS)
# - Terminal.app (macOS)
# - Windows Terminal
# - VS Code integrated terminal

# Test with different themes
# - Dark themes (Dracula, One Dark)
# - Light themes (Solarized Light)
# - High contrast themes
```

## Success Metrics

1. **Scan Time**: Users identify failed builds in < 1 second
2. **Comprehension**: 95% understand status without documentation
3. **Accessibility**: 100% functional without color
4. **Satisfaction**: Positive feedback on visual clarity
5. **Consistency**: Same patterns work across all commands
