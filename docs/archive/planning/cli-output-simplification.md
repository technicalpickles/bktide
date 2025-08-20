# CLI Output Simplification Plan

## Current State Analysis

### Output Redundancy Issues

After adding progress indicators and reporter messages, we have several redundancy issues:

#### Organizations Command
**Current output:**
```
✓ Organizations retrieved          
Your organizations:
NAME                                          SLUG                                       
Gusto                                         gusto    
```
**Issues:**
- "Organizations retrieved" is redundant once data is shown
- Success message appears AFTER the data, making it pointless

#### Builds Command  
**Current output:**
```
✓ Builds retrieved                     
ℹ︎ TIP: Use --count 20 to see more builds
ℹ︎ TIP: Filter by state: --state failed
ℹ︎ TIP: Filter by branch: --branch main
ℹ︎ TIP: Filter by pipeline: --pipeline <name>
Found 10 builds:
PIPELINE               NUMBER                 STATE                  BRANCH              
[...table...]

Showing 10 builds. Use --count and --page options to see more.
```
**Issues:**
- "Builds retrieved" is redundant when "Found 10 builds:" appears right after
- Build count mentioned twice ("Found 10 builds" and "Showing 10 builds")
- Tips appear both from reporter (top) and formatter (bottom)
- Tips appear before data, which feels backwards

### Command-Line Options Complexity

We now have 6 view-related options that overlap and interact in complex ways:

```
--format <format>    Output format (plain, json, alfred)
--color <mode>       Color output: auto|always|never
--quiet              Suppress non-error output (plain format only)
--tips               Show helpful tips and suggestions
--no-tips            Hide helpful tips and suggestions  
--ascii              Use ASCII symbols instead of Unicode
```

#### Issues with Current Options

1. **Overlapping Concerns:**
   - `--quiet` affects both success messages AND tips
   - `--no-tips` only affects tips
   - `--format json` implicitly suppresses decorative output
   - `--color never` affects colors but not symbols

2. **Unclear Interactions:**
   - What does `--quiet --tips` do? (Currently: no success messages, but shows tips)
   - Does `--format json --tips` show tips? (No, format overrides)
   - Does `--ascii` affect Alfred format? (Unclear)

3. **Too Many Flags:**
   - Users need to remember 6 different options
   - Common use cases require multiple flags
   - Default behavior might not be optimal

## Proposed Solutions

### Solution A: Consolidate View Options (Recommended)

**Replace multiple flags with view presets:**

```bash
--output <preset>    Output style preset
  minimal   - Just the data (like current --quiet --no-tips)
  normal    - Data with helpful context (default)
  verbose   - Everything including tips and progress
  json      - Machine-readable JSON
  alfred    - Alfred workflow format
  
--no-color          Disable colors (simpler than --color never)
--ascii             Use ASCII symbols instead of Unicode
```

**Benefits:**
- Reduces 6 options to 3
- Clear, predictable behavior
- Easy to remember presets
- Covers common use cases

**Implementation:**
```typescript
enum OutputPreset {
  MINIMAL = 'minimal',  // Just data
  NORMAL = 'normal',    // Data + essential feedback
  VERBOSE = 'verbose',  // Data + tips + confirmations
  JSON = 'json',        // Machine format
  ALFRED = 'alfred'     // Alfred format
}

interface ViewOptions {
  output: OutputPreset;
  color: boolean;
  ascii: boolean;
}
```

### Solution B: Progressive Enhancement

**Keep current options but clarify hierarchy:**

1. **Format Level** (highest priority):
   - `--format json|alfred` = machine output, no decoration
   - `--format plain` = human output, allows decoration

2. **Verbosity Level** (for plain format):
   - `--quiet` = minimal output (data only)
   - (default) = normal output (data + confirmations)
   - `--verbose` = full output (data + confirmations + tips)

3. **Style Level** (for non-quiet plain):
   - `--no-color` = disable colors
   - `--ascii` = use ASCII symbols

**Simplified to:**
```bash
--format <type>     Output format (plain|json|alfred)
--verbosity <level> Output verbosity (quiet|normal|verbose)
--no-color          Disable colors
--ascii             Use ASCII symbols
```

### Solution C: Smart Defaults with Overrides

**Detect context and adjust automatically:**

```typescript
function determineOutputMode() {
  // Machine formats always minimal
  if (format === 'json' || format === 'alfred') {
    return { decorative: false, tips: false, color: false };
  }
  
  // Non-TTY (piped) defaults to minimal
  if (!process.stdout.isTTY) {
    return { decorative: false, tips: false, color: false };
  }
  
  // CI environment defaults to minimal
  if (process.env.CI) {
    return { decorative: false, tips: false, color: false };
  }
  
  // Interactive TTY defaults to normal
  return {
    decorative: !options.quiet,
    tips: options.tips ?? !options.quiet,
    color: options.color ?? true
  };
}
```

**Keep simple overrides:**
```bash
--format <type>  Output format
--quiet          Minimal output
--no-tips        Hide tips
--no-color       Disable colors
--ascii          ASCII symbols
```

## Recommended Implementation Plan

### Phase 1: Fix Redundancy (Immediate)

1. **Remove redundant success messages**:
   - Delete `reporter.success()` calls after data display
   - Spinner already provides "in progress" feedback

2. **Consolidate tips**:
   - Move all tips to AFTER data display
   - Remove duplicate messages from formatters
   - Keep tips contextual to what was displayed

3. **Clean up formatters**:
   - Remove "Showing X items" when "Found X items" exists
   - Remove duplicate guidance messages

### Phase 2: Simplify Options (Next Sprint)

1. **Deprecate overlapping options** (with backward compatibility):
   ```typescript
   if (options.quiet && options.tips === undefined) {
     options.tips = false; // Quiet implies no tips
   }
   ```

2. **Add output presets** (Solution A):
   - Keep existing flags for compatibility
   - Map old flags to new presets internally
   - Update documentation to promote presets

3. **Improve help text**:
   ```
   Output Options:
     --output <preset>  Output style: minimal|normal|verbose|json|alfred
                        (minimal: data only, normal: with feedback, verbose: with tips)
     --no-color         Disable colored output
     --ascii            Use ASCII symbols instead of Unicode
   
   Legacy Options (deprecated):
     --format, --quiet, --tips, --color
   ```

### Phase 3: Monitor & Iterate

1. **Gather feedback** on new presets
2. **Remove deprecated options** in next major version
3. **Consider context-aware defaults** if needed

## Success Criteria

### Immediate (Phase 1)
- [ ] No duplicate information in output
- [ ] Tips appear after data, not before
- [ ] Success confirmations removed where redundant
- [ ] Formatters don't duplicate reporter messages

### Short-term (Phase 2)
- [ ] Reduced from 6 to 3 view options
- [ ] Clear preset names that match user intent
- [ ] Backward compatibility maintained
- [ ] Help text clearly explains options

### Long-term
- [ ] Users rarely need to specify output options
- [ ] Smart defaults work for 90% of use cases
- [ ] Machine formats are always clean
- [ ] Human formats are always helpful

## Examples After Implementation

### Organizations (minimal/quiet)
```
NAME                                          SLUG                                       
Gusto                                         gusto
```

### Organizations (normal - default)
```
Your organizations:
NAME                                          SLUG                                       
Gusto                                         gusto
```

### Organizations (verbose)
```
Your organizations:
NAME                                          SLUG                                       
Gusto                                         gusto

ℹ︎ TIP: Use --org gusto with other commands to filter results
```

### Builds (normal - default)
```
Found 10 builds:
PIPELINE               NUMBER                 STATE                  BRANCH              
zenpayroll             #1292550               passed                 main
[...more rows...]

ℹ︎ Use --count 20 to see more builds
```

### Builds (verbose)
```
Found 10 builds:
PIPELINE               NUMBER                 STATE                  BRANCH              
zenpayroll             #1292550               passed                 main
[...more rows...]

ℹ︎ TIP: Use --count 20 to see more builds
ℹ︎ TIP: Filter by state: --state failed
ℹ︎ TIP: Filter by branch: --branch main
```

## Migration Path

1. **Version 1.x**: Current behavior (for compatibility)
2. **Version 2.0**: 
   - Add new `--output` preset option
   - Deprecation warnings for old flags
   - Map old flags to new presets
3. **Version 3.0**: Remove deprecated flags

## Testing Checklist

- [ ] Each output preset produces expected format
- [ ] Piping suppresses decorative output
- [ ] CI environment detected correctly
- [ ] Backward compatibility with old flags
- [ ] Help text is clear and accurate
- [ ] No duplicate messages in any mode
- [ ] Tips appear in logical order
