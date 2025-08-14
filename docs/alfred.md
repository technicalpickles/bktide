# Alfred Integration

This CLI supports integration with Alfred workflows via the `--alfred` option:

```bash
bin/bktide builds --alfred
```

This outputs builds in a JSON format that Alfred can process as a Script Filter. Each build will be shown as a result row with:

- Title: Pipeline name and build number
- Subtitle: State, branch, and commit message
- Action: Opens the build URL when clicked

## Alternative Actions (Builds)

Configure Alfred alternative actions on the Script Filter connection:

- Enter (default): Open URL
  - Script Filter → Open URL
- ⌘ (Cmd): Paste URL into frontmost app
  - Script Filter → Alternative action (⌘) → Copy to Clipboard
  - Content: `{query}`
  - Enable “Automatically paste to front most app”
- ⌥ (Alt): Show build annotations in a Text View
  - Script Filter → Alternative action (⌥) → Run Script
  - Recommended: Use a small Run Script that prints the build URL on the first line, then a blank line, then the annotations text:
    - Input: `{query}` (build ref `org/pipeline/number`)
    - Example (bash):
      - `ref="$1"`
      - `org_pipeline="${ref%/*}"; num="${ref##*/}"`
      - `echo "https://buildkite.com/${org_pipeline}/builds/${num}"`
      - `echo` (blank line)
      - `"$WORKFLOW_DIR/bin/alfred-entrypoint" annotations "$ref" --format plain`
  - Connect to a Text View (Object Input → Preview only)
  - Then connect Text View → Arg and Vars to set `arg` to the first printed line (the URL), then → Open URL

Notes:
- The Script Filter provides `{query}` as either the build URL (default, ⌘) or a build ref `org/pipeline/number` (⌥) based on the selected row.
- If the build ref cannot be derived for a row, the ⌥ alternative action is omitted for that item.

See Alfred docs:
- Using Alternative Actions: https://www.alfredapp.com/help/workflows/advanced/alternative-actions/
- Text View: https://www.alfredapp.com/help/workflows/user-interface/text/

## Alfred Workflow Setup

1. Create a new Alfred workflow
2. Add a "Script Filter" trigger
3. Set the script to:
   ```bash
   /path/to/your/project/node_modules/.bin/node /path/to/your/project/dist/index.js builds --alfred
   ```
4. Connect it to an "Open URL" action

## Icons

For better visuals, you can add icons matching build states in the `icons/` directory:
- `passed.png`
- `failed.png`
- `running.png`
- `scheduled.png`
- `canceled.png`
- `unknown.png` 