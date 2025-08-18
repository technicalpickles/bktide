# Terminal Hyperlinks Implementation Plan

## Overview

Add support for clickable URLs in terminal emulators that support OSC 8 escape sequences, following the same pattern as color detection with environment variable overrides.

## Background

Modern terminal emulators support the OSC 8 escape sequence for hyperlinks:
- **VS Code**: Full support since September 2022
- **Cursor**: Inherited support (may need FORCE_HYPERLINK=1)
- **iTerm2**: Full support
- **Ghostty**: Full support
- **Kitty**: Full support
- **Windows Terminal**: Full support
- **Standard Terminal.app**: Fallback to underlined text

## Implementation Status

### ✅ Completed

1. **Created terminal hyperlink utility module** (`src/utils/terminal-links.ts`)
   - Detection logic similar to color handling
   - Environment variable overrides (BKTIDE_HYPERLINK_MODE, FORCE_HYPERLINK)
   - OSC 8 escape sequence formatting
   - Helper functions for Buildkite and GitHub URLs
   - URL linkification in text content

2. **Updated theme.ts**
   - Modified `SEMANTIC_COLORS.url()` to accept optional label parameter
   - Integrated with terminal-links utility

### 🚧 In Progress

3. **Update formatters to use hyperlinked URLs**
   - Build detail formatter integration
   - Annotation content linkification
   - Pipeline and organization links

### ⏳ Pending

4. **Test in various terminals**
5. **Documentation updates**

## Technical Design

### Detection Logic

```typescript
// Environment variable precedence (same as color):
1. NO_COLOR=1              // Disables all formatting including hyperlinks
2. BKTIDE_HYPERLINK_MODE   // 'auto' | 'always' | 'never'
3. FORCE_HYPERLINK=1       // Force enable (for Cursor workaround)
4. Auto-detection          // Check TERM_PROGRAM and known terminals
```

### OSC 8 Format

```
\x1b]8;;URL\x07LABEL\x1b]8;;\x07
```

Where:
- `\x1b` = ESC character
- `\x07` = BEL character (more compatible than ST)
- URL = The hyperlink destination
- LABEL = The visible text

### Fallback Chain

1. **OSC 8 hyperlink** - If terminal supports it
2. **Underlined cyan text** - If colors are enabled
3. **Plain text with brackets** - `<URL>` format

## Implementation Details

### Core Utility Functions

```typescript
// src/utils/terminal-links.ts

export function hyperlinksEnabled(): boolean
// Detects support with env var overrides

export function terminalLink(url: string, label?: string): string  
// Creates hyperlink with fallback

export function buildkiteLink(org: string, pipeline?: string, buildNumber?: number, label?: string): string
// Helper for Buildkite URLs

export function githubPRLink(repoUrl: string, prNumber: string | number, label?: string): string
// Helper for GitHub PR URLs

export function linkifyUrls(text: string): string
// Parse and linkify URLs in text content
```

### Terminal Detection

Known supporting terminals (checked via environment variables):
- VS Code (`TERM_PROGRAM=vscode`)
- Cursor (`TERM_PROGRAM=cursor`)
- iTerm2 (`TERM_PROGRAM=iTerm.app`)
- Kitty (`TERM_PROGRAM=kitty`)
- Ghostty (`TERM_PROGRAM=ghostty`)
- Windows Terminal (`WT_SESSION` present)
- WezTerm (`TERM_PROGRAM=wezterm`)
- Hyper, Tabby, Konsole, Rio (various detection methods)

### Usage Examples

```typescript
// Simple URL
lines.push(`URL: ${SEMANTIC_COLORS.url(build.url)}`);

// URL with custom label
lines.push(`URL: ${SEMANTIC_COLORS.url(build.url, `Build #${build.number}`)}`);

// Buildkite links
const orgLink = buildkiteLink(org.slug, undefined, undefined, org.name);
const pipelineLink = buildkiteLink(org.slug, pipeline.slug, undefined, pipeline.name);
const buildLink = buildkiteLink(org.slug, pipeline.slug, build.number, `Build #${build.number}`);

// GitHub PR links
const prLink = githubPRLink(repoUrl, prNumber, `PR #${prNumber}`);

// Linkify URLs in annotation content
const linkedContent = linkifyUrls(annotationText);
```

## Places to Add Hyperlinks

### Build Command (`src/formatters/build-detail/PlainTextFormatter.ts`)
- [x] Build URL
- [ ] Organization link
- [ ] Pipeline link
- [x] Pull Request URL
- [ ] Job URLs
- [ ] Triggered from build URL

### Annotations
- [ ] URLs within annotation HTML content
- [ ] External reference links

### Builds List (`src/formatters/builds/PlainTextFormatter.ts`)
- [ ] Build URLs in list view
- [ ] Pipeline links

### Pipelines List (`src/formatters/pipelines/PlainTextFormatter.ts`)
- [ ] Pipeline URLs
- [ ] Repository URLs

### Organizations (`src/formatters/organizations/PlainTextFormatter.ts`)
- [ ] Organization URLs

### Error Messages
- [ ] Help documentation links
- [ ] API token setup URL

## Testing Plan

### Manual Testing Commands

```bash
# Test in VS Code terminal
bin/bktide build org/pipeline/123

# Test with force enable
FORCE_HYPERLINK=1 bin/bktide build org/pipeline/123

# Test with force disable  
BKTIDE_HYPERLINK_MODE=never bin/bktide build org/pipeline/123

# Test fallback (no color, no hyperlinks)
NO_COLOR=1 bin/bktide build org/pipeline/123
```

### Terminal Compatibility Matrix

| Terminal | Detection Method | Support | Notes |
|----------|-----------------|---------|-------|
| VS Code | `TERM_PROGRAM=vscode` | ✅ Full | Native support |
| Cursor | `TERM_PROGRAM=cursor` | ✅ Full | May need FORCE_HYPERLINK=1 |
| iTerm2 | `TERM_PROGRAM=iTerm.app` | ✅ Full | Native support |
| Ghostty | `TERM_PROGRAM=ghostty` | ✅ Full | Native support |
| Kitty | `TERM_PROGRAM=kitty` | ✅ Full | Native support |
| WezTerm | `TERM_PROGRAM=wezterm` | ✅ Full | Native support |
| Windows Terminal | `WT_SESSION` env var | ✅ Full | Native support |
| Terminal.app | N/A | ❌ Fallback | Underlined text |
| tmux/screen | N/A | ❌ Fallback | Plain text |
| CI environments | `CI` env var | ❌ Disabled | No TTY |

### Edge Cases to Test

1. **Long URLs** - Ensure proper wrapping
2. **Special characters in URLs** - Proper escaping
3. **Multiple URLs in one line** - All should be clickable
4. **Nested terminal sessions** - SSH, tmux, screen
5. **Non-TTY output** - Pipe to file, grep, etc.

## Documentation Updates

### README.md
- Add section on terminal hyperlink support
- List supported terminals
- Document environment variables

### Help Text
- Update `--help` to mention clickable URLs
- Add tip about FORCE_HYPERLINK for Cursor users

## Future Enhancements

1. **Configuration file support**
   ```yaml
   # .bktide/config.yaml
   formatting:
     hyperlinks: auto  # auto | always | never
   ```

2. **Smart URL detection in output**
   - Parse and linkify URLs in all text output
   - Handle Buildkite-specific URL patterns

3. **Custom link handlers**
   - Open in browser vs copy to clipboard
   - Integration with `open` command

4. **Link validation**
   - Check if URLs are accessible
   - Warn about broken links

## Implementation Notes

### Cursor Workaround

Cursor sometimes reports as an older VS Code version that doesn't support hyperlinks. Users can fix this by adding to their settings.json:

```json
{
  "terminal.integrated.env.osx": {
    "FORCE_HYPERLINK": "1"
  }
}
```

Replace `.osx` with `.linux` or `.windows` as needed.

### Performance Considerations

- Hyperlink detection is cached per process
- URL regex is compiled once
- No network requests for link generation

### Security Considerations

- Only linkify HTTPS URLs (not HTTP)
- Sanitize URLs to prevent injection
- Don't linkify file:// URLs

## References

- [OSC 8 Specification](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)
- [VS Code Terminal Links](https://code.visualstudio.com/docs/terminal/basics#_links)
- [supports-hyperlinks npm package](https://github.com/sindresorhus/supports-hyperlinks)
- [Terminal Hyperlinks in Various Emulators](https://github.com/Alhadis/OSC8-Adoption)
