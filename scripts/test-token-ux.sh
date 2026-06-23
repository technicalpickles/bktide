#!/usr/bin/env bash
#
# Test script for token/auth UX scenarios
# Run from repo root: ./scripts/test-token-ux.sh
#
# This script tests various token error scenarios to evaluate
# how clear the error messages and setup guidance are.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BKTIDE="$REPO_ROOT/bin/bktide"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

divider() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

header() {
  divider
  echo -e "${BLUE}## $1${NC}"
  echo ""
}

subheader() {
  echo -e "${YELLOW}### $1${NC}"
  echo ""
}

run_test() {
  local description="$1"
  local cmd="$2"

  subheader "$description"
  echo -e "Command: ${GREEN}$cmd${NC}"
  echo ""
  echo "Output:"
  echo "───────"
  # Run command, capture both stdout and stderr, don't fail on error
  eval "$cmd" 2>&1 || true
  echo "───────"
  echo ""
}

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    bktide Token/Auth UX Test Script                          ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"

# Ensure we're using the local build
if [[ ! -x "$BKTIDE" ]]; then
  echo -e "${RED}Error: bktide not found at $BKTIDE${NC}"
  echo "Run 'npm run build' first"
  exit 1
fi

header "Scenario 1: token --check with no token (env override)"
run_test "No token configured" \
  "BUILDKITE_API_TOKEN='' $BKTIDE token --check"

header "Scenario 2: token --check with invalid token"
run_test "Invalid/malformed token" \
  "BUILDKITE_API_TOKEN='invalid-token-12345' $BKTIDE token --check"

header "Scenario 3: token --check with invalid token + debug"
run_test "Invalid token with --debug flag" \
  "BUILDKITE_API_TOKEN='invalid-token-12345' $BKTIDE token --check --debug"

header "Scenario 4: Regular command (orgs) with no token"
run_test "orgs command without token" \
  "BUILDKITE_API_TOKEN='' $BKTIDE orgs"

header "Scenario 5: Regular command (orgs) with invalid token"
run_test "orgs command with invalid token" \
  "BUILDKITE_API_TOKEN='invalid-token-12345' $BKTIDE orgs"

header "Scenario 6: Regular command (builds) with invalid token"
run_test "builds command with invalid token" \
  "BUILDKITE_API_TOKEN='invalid-token-12345' $BKTIDE builds"

header "Scenario 7: JSON format with invalid token"
run_test "JSON output with invalid token (should still be valid JSON or clear error)" \
  "BUILDKITE_API_TOKEN='invalid-token-12345' $BKTIDE orgs --format json"

header "Scenario 8: token --check with --token flag (should this work?)"
run_test "Using --token flag with token --check" \
  "$BKTIDE token --check --token 'test-token-via-flag'"

divider
echo -e "${BLUE}## Summary${NC}"
echo ""
echo "Review the output above and assess:"
echo "  1. Is it clear what went wrong?"
echo "  2. Is it clear how to fix it?"
echo "  3. Are the 'next steps' actionable?"
echo "  4. Would a new user know what to do?"
echo ""
echo "Key UX expectations:"
echo "  - Error messages should be human-readable, not JSON dumps"
echo "  - Every error should include guidance on how to resolve it"
echo "  - Link to https://buildkite.com/user/api-access-tokens when relevant"
echo ""
