### Alfred Alternative Actions for Builds — Plan

Goal: Add alternative actions to the builds Script Filter output to support:
- Default: Open in browser
- Cmd (⌘): Paste URL into the frontmost app
- Alt (⌥): Show build annotations in an Alfred Text View

References:
- Using Alternative Actions: https://www.alfredapp.com/help/workflows/advanced/alternative-actions/
- Text View object: https://www.alfredapp.com/help/workflows/user-interface/text/

---

### UX mapping
- Default (Enter): open build in browser
  - Script Filter → Open URL

- Cmd (⌘): paste URL to frontmost app
  - Script Filter → Alternative action (⌘) → Copy to Clipboard
  - Content: {query}
  - Enable “Automatically paste to front most app”
  - Item subtitle: "Paste URL"

- Alt (⌥): show annotations for selected build
  - Script Filter → Alternative action (⌥) → Run Script
  - Command: bin/alfred-entrypoint annotations "{query}" --format plain
  - Connect to a Text View (Object Input → Preview only)
  - Item subtitle: "Show annotations"

Notes:
- We will not include variables.action/buildRef in the JSON initially since Alfred wiring uses alternative connections.
- If a row cannot derive a build ref, we will omit the Alt modifier for that row.
- For large annotation bodies, Text View is preferred over Large Type.

---

### Data derivation
- URL: prefer `build.web_url`, fallback to `build.url`.
- buildRef: prefer `build.organization.slug` + `build.pipeline.slug` + `build.number`.
  - Fallback: parse from URL matching `https://buildkite.com/<org>/<pipeline>/builds/<number>`.

---

### Code changes
1) `src/formatters/builds/AlfredFormatter.ts`
   - Compute `url` and `buildRef` with the above rules.
   - Update `mods`:
     - `cmd`: subtitle "Paste URL", `arg: url`
     - `alt`: subtitle "Show annotations", `arg: buildRef` (omit if undefined)
   - Keep `text.copy = url` for Alfred’s built-in Cmd+C copy.

2) `src/formatters/annotations/AlfredFormatter.ts` (optional later)
   - Not required for Text View since we will output plain text, but we can add an Alfred formatter later if we want rich list rendering.

3) `docs/alfred.md`
   - Add wiring instructions for alternative actions and Text View.

---

### Alfred wiring steps
1) Builds Script Filter
   - Default connection → Open URL
   - Alt (⌥) connection → Run Script: `bin/alfred-entrypoint annotations "{query}" --format plain`
     → Text View (Object Input: Preview only)
   - Cmd (⌘) connection → Copy to Clipboard (content `{query}`, Auto paste enabled)

2) Optional window behavior
   - Consider setting "Don’t close" on connections to reduce flicker (per Alfred docs).

---

### Open decisions (defaults chosen unless requested otherwise)
- When `buildRef` is not derivable for a row: omit Alt modifier for that row.
- Text View behavior: Preview-only; Enter opens the build URL via an Arg and Vars step:
  - In the Alt chain, instead of directly running `bin/alfred-entrypoint`, use a small shell Run Script:
    - Input: `{query}` (build ref `org/pipeline/number`)
    - Script (bash):
      - Compute URL: `url="https://buildkite.com/${ref%/*}/builds/${ref##*/}"`
      - Print the URL on the first line, then a blank line, then annotations output:
        - `echo "$url"`
        - `"$WORKFLOW_DIR/bin/alfred-entrypoint" annotations "$ref" --format plain`
  - Connect the Run Script → Text View (Object Input: Preview only)
  - Text View → Arg and Vars: set `arg` to the first line (use regex or split) to extract the URL
  - Arg and Vars → Open URL


