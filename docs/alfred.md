# Alfred Integration

This page is a short user-facing overview. For installation and troubleshooting, see `docs/alfred-installation.md`. For development and packaging details, see `docs/alfred-development.md`.

> **Note**: Shell completions and Alfred integration are independent features. You can use both simultaneously without any conflicts.

## What it does
The CLI can output Alfred Script Filter JSON via `--format alfred`. Each build or pipeline is shown as a result row with a title, subtitle, and URL.

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
