---
name: run-bktide
description: Build, run, and smoke-test bktide (Buildkite CLI). Use when asked to run bktide, build it, verify it works, or check that a change to the CLI didn't break anything. Covers the token-free command surface (--help, prime, completions, error paths); authenticated commands need a real Buildkite API token, see Auth section.
---

bktide is a TypeScript CLI (Commander.js) for Buildkite CI/CD. It compiles
to `dist/index.js` and is invoked as `bin/bktide <command>`. Drive it via
`.claude/skills/run-bktide/smoke.sh` — a shell script, no browser/GUI/REPL
harness needed since this is a plain CLI.

All paths below are relative to the repo root.

## Prerequisites

Node.js >= 20 (per `package.json` `engines`). No OS packages needed — this
was built and run on macOS; `@napi-rs/keyring` (used for token storage) only
ships prebuilt binaries for `darwin-arm64`/`darwin-x64`, so `token --store`
and any authenticated command that falls back to keychain lookup will not
work on Linux without a real Buildkite token supplied another way (env var
or `--token`).

## Setup + Build

```bash
npm install
npm run build   # tsc -> dist/index.js
```

Both ran clean in this session (`npm install`: 776 packages; `npm run build`:
no output = success).

## Run (agent path)

```bash
.claude/skills/run-bktide/smoke.sh
```

This builds the project, then runs 11 representative invocations covering
the **token-free** command surface and checks each one's exit code:
`--help`, `--version`, a subcommand's `--help`, `prime`, `completions`
(fish/bash/zsh), `token --check`, an unknown command, the `boom` test-error
command, and an authenticated command run *without* a token (expected to
fail with setup guidance, exit 1). Prints `OK`/`FAIL` per check and a final
`SMOKE TEST: PASSED`/`FAILED`.

Sample output from an actual run:

```
== token-free command surface ==
OK:   --help
OK:   --version
OK:   <command> --help (builds)
OK:   prime
OK:   completions fish
OK:   completions bash
OK:   completions zsh
OK:   token --check (no token)
OK:   unknown command
OK:   boom (forced error path)
OK:   authenticated cmd w/o token

SMOKE TEST: PASSED
```

## Run (human path)

```bash
bin/bktide <command> [args]       # runs the built dist/index.js
npm run dev -- <command> [args]   # rebuilds via ts-node + build-and-run.js, then runs
```

`bin/bktide` is a one-line wrapper (`npm run start --silent -- "$@"`) — it
requires `npm run build` to have already produced `dist/index.js`.
`npm run dev` rebuilds and runs in one step, useful while iterating.

## Auth (for authenticated commands)

12 of bktide's 15 commands (`viewer`, `orgs`, `pipelines`, `builds`, `build`,
`annotations`, `pipeline`, `logs`, `snapshot`, `artifacts`, plus the
SmartShow router) set `requiresToken = true` and will refuse to run without
a Buildkite API token. Token resolution order: `--token <t>` flag →
`BUILDKITE_API_TOKEN`/`BK_TOKEN` env var → macOS keychain (via
`bktide token --store`, interactive).

**This skill was authored and verified without a real token** (by user
choice) — only the token-free surface above was actually driven. To extend
coverage to authenticated commands, get a token at
https://buildkite.com/user/api-access-tokens/new (scopes: Read Builds, Read
Build Logs, Read Organizations, Read Pipelines, Read Artifacts, GraphQL API
Access) and either export `BUILDKITE_API_TOKEN=...` or pass `--token`. Good
first commands to verify with a real token: `bktide viewer`,
`bktide orgs`, `bktide --format json orgs`.

## Test

```bash
npm test
```

Verified in this session: 34 test files, 367 tests, all passing (~2.3s).
Pure vitest unit tests with pattern-based/MSW mocking — does not exercise
the built `dist/index.js` binary (that's what `smoke.sh` is for).

---

## Gotchas

- **`prime` ignores `--format`** — `bin/bktide --format json prime` prints
  the exact same static XML-ish text as the plain run. Every other command
  checked (`token --check`, etc.) does respect `--format json`.
- **`boom` prints its error message twice** — `bin/bktide boom` (used to
  test the error-handling path) writes the same "Boom! This is a test
  error" block to stderr twice in one run. Confirmed by capturing stdout
  and stderr separately; not a terminal artifact. Looks like a real
  double-emit bug in the error handling / logging path, not something this
  skill should paper over.
- **`~/.local/state/bktide/logs/cli.log` stayed empty** during this session
  even after running commands and `bin/bktide --debug viewer`. If you need
  logs for debugging, don't assume the file has content — check log level
  / whether the code path you're exercising actually logs.
- **No offline/mock mode exists** for authenticated commands — there's no
  `--mock` flag or documented way to point bktide at fixture data outside
  the vitest test suite. If you don't have a token, the token-free surface
  in `smoke.sh` is the ceiling of what you can drive.
