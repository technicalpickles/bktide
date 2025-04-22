# Alfred Integration

This CLI supports integration with Alfred workflows via the `--alfred` option:

```bash
npm run dev -- builds --alfred
```

This outputs builds in a JSON format that Alfred can process as a Script Filter. Each build will be shown as a result row with:

- Title: Pipeline name and build number
- Subtitle: State, branch, and commit message
- Action: Opens the build URL when clicked

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