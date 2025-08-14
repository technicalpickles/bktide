# Alfred Integration

This CLI supports integration with Alfred workflows via the `--format alfred` option, for example

```bash
bin/bktide builds --format alfred
```

This outputs builds in a JSON format that Alfred can process as a Script Filter. Each build will be shown as a result row with:

- Title: Pipeline name and build number
- Subtitle: State, branch, and commit message
- Action: Opens the build URL when clicked

## Convenience Wrapper

`bin/alfred-entrypoint` is a script that Alfred can call. It:

- uses NODE_BIN to determine what to execute
- automatically adds `--format alfred`
- calls bktide and passes `$@` to it

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
  - Script: `bin/alfred-entrypoint annotations "$@"`
  - Connect directly to a Text View (Object Input → Preview only)

Notes:
- The Script Filter provides `{query}` as the build URL for default/⌘ actions, and a build ref `org/pipeline/number` for the ⌥ action.
- If the build ref cannot be derived for a row, the ⌥ alternative action is omitted for that item.

See Alfred docs:
- Using Alternative Actions: https://www.alfredapp.com/help/workflows/advanced/alternative-actions/
- Text View: https://www.alfredapp.com/help/workflows/user-interface/text/

## Alternative Actions (Pipelines)

Configure Alfred alternative actions for the Pipelines Script Filter similarly:

- Enter (default): Open URL
  - Script Filter → Open URL
- ⌘ (Cmd): Paste URL into frontmost app
  - Script Filter → Alternative action (⌘) → Copy to Clipboard
  - Content: `{query}`
  - Enable “Automatically paste to front most app”

Notes:
- The Pipelines Script Filter provides `{query}` as the pipeline’s web URL for all actions.

## Alfred Workflow Setup

1. Create a new Alfred workflow
2. Add a "Script Filter" trigger
3. Set the script to:
   ```bash
   /absolute/path/to/your/project/bin/alfred-entrypoint builds --filter "$*"
   ```
4. Connect it to an "Open URL" action
   - URL: `{query}`

### Token commands in Alfred

The workflow includes convenient keywords for token management:

- `bkt`: Check token status (runs `token --check`)
- `bkts`: Store/update token (prompts, then runs `token --store --token "{var:token}"`)
- `bktr`: Reset token (runs `token --reset`)

## Icons

For better visuals, these icons are available in the `icons/` directory:
- `passed.png`
- `failed.png`
- `running.png`
- `scheduled.png`
- `skipped.png`
- `blocked.png`
- `failing.png`
- `unknown.png`

Notes:
- Some states (e.g., canceled, canceling, not_run) are mapped to `unknown.png`.
- Error/empty states also use `unknown.png` to avoid missing icons.