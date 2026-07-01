#!/usr/bin/env bash
# Smoke-tests bktide's token-free command surface: build the CLI, then run
# a handful of representative invocations and check their exit codes.
# Does NOT require a Buildkite API token. Run from the repo root or anywhere
# inside it — the script cd's to the repo root itself.
set -uo pipefail

cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"

fail=0

check() {
  local desc="$1" expected_exit="$2"
  shift 2
  local out
  out=$("$@" 2>&1)
  local actual=$?
  if [ "$actual" -ne "$expected_exit" ]; then
    echo "FAIL: $desc (exit $actual, expected $expected_exit)"
    echo "$out" | head -5 | sed 's/^/      /'
    fail=1
  else
    echo "OK:   $desc"
  fi
}

echo "== install + build =="
npm install --no-audit --no-fund
npm run build

echo
echo "== token-free command surface =="
check "--help"                       0 bin/bktide --help
check "--version"                    0 bin/bktide --version
check "<command> --help (builds)"    0 bin/bktide builds --help
check "prime"                        0 bin/bktide prime
check "completions fish"             0 bin/bktide completions fish
check "completions bash"             0 bin/bktide completions bash
check "completions zsh"              0 bin/bktide completions zsh
check "token --check (no token)"     0 bin/bktide token --check
check "unknown command"              1 bin/bktide totallyfake
check "boom (forced error path)"     1 bin/bktide boom
check "authenticated cmd w/o token"  1 bin/bktide viewer

echo
if [ "$fail" -ne 0 ]; then
  echo "SMOKE TEST: FAILED"
  exit 1
fi
echo "SMOKE TEST: PASSED"
