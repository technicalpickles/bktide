# Soft Failures

Soft failures are jobs that fail (exit with non-zero status) but are configured to not fail the overall build.

## Detection

Soft failures are detected using the `softFailed` field from Buildkite's GraphQL API. Jobs with:
- `exitStatus != 0`
- `softFailed = true`

Are classified as soft failures.

## Display

### Plain Text Output

Soft failures are displayed with:
- Yellow color (warning semantic)
- Triangle symbol: `▲` (or `^` in ASCII mode)
- "soft failure" / "soft failures" terminology

Example:
```
✓ PASSED Build #1234 30m 26s

✓ 467 steps: 401 passed, ▲ 3 soft failures

   ▲ bin/pact-can-i-merge - ran 30s
   ▲ bin/experimental-check - ran 1m 15s
```

### Detailed View (--jobs)

Soft failures appear in a separate section:

```
Steps: ✗ 2 failed  ▲ 3 soft failed  ✓ 401 passed

✗ Failed (2):
  ...

▲ Soft Failed (3):
  bin/pact-can-i-merge (30s)
  bin/experimental-check (1m 15s)
  ...
```

### JSON Output

Soft failures are included in JSON output:

```json
{
  "build": {
    "jobs": [
      {
        "label": "bin/pact-can-i-merge",
        "exit_status": "1",
        "passed": false,
        "soft_failed": true
      }
    ],
    "job_stats": {
      "passed": 401,
      "failed": 0,
      "soft_failed": 3
    }
  }
}
```

## Commands

### build

Shows soft failures in summary and auto-displays soft failed jobs.

Options:
- `--jobs`: Shows detailed soft failure section
- `--failed`: Includes both hard and soft failures
- `--format json`: Includes `soft_failed` field in output

### snapshot

Shows soft failures in summary. When using `--failed`, fetches logs for both hard and soft failures.

## Backwards Compatibility

Jobs without a `softFailed` field (or with `null`/`undefined` value) are treated as hard failures for backwards compatibility.
