# Alfred Integration

Streamline your Buildkite CI/CD workflows directly from Alfred, providing instant access to builds, pipelines, and organizations without leaving your keyboard.

> **Note**: Shell completions and Alfred integration are independent features. You can use both simultaneously without any conflicts.

For installation and troubleshooting, see `docs/alfred-installation.md`. For development and packaging details, see `docs/alfred-development.md`.

## What it does
The bktide Alfred workflow transforms your Buildkite workflow management by:
- **Instant Access**: Search and view builds, pipelines, and organizations from Alfred
- **Rich Previews**: See build statuses, pipeline information, and annotations at a glance  
- **Quick Actions**: Open builds in browser, copy URLs, or view details with keyboard shortcuts
- **Smart Filtering**: Filter by organization, build state, or search terms

The CLI outputs Alfred Script Filter JSON via `--format alfred`, with each build or pipeline shown as a result row with title, subtitle, and actionable URL.

### Output behavior in Alfred
- Only machine-readable JSON is printed on stdout. No extra lines, colors, spinners, or confirmations are emitted.
- Errors are also printed as JSON to stdout (stderr is unused by design within Alfred).

### Quick usage
```bash
bin/bktide builds --format alfred
```

You can also use the convenience wrapper:

```bash
bin/alfred-entrypoint builds --filter "$*"
```

### Token commands inside Alfred
- `bkt`: Check token status (`token --check`)
- `bkts`: Store/update token (prompts, then runs `token --store --token "{var:token}"`)
- `bktr`: Reset token (`token --reset`)

### Alternative actions
- Default Enter: Open URL
- ⌘: Copy URL
- ⌥ (on builds): Show annotations in a Text View

See Alfred docs: Using Alternative Actions and Text View.
