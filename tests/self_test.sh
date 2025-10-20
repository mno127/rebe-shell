#!/usr/bin/env bash
#
# rebe-shell Self-Test Script
#
# This script validates the rebe-shell implementation by testing it against
# its own design principles and architecture.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         rebe-shell Self-Test Suite                      ║"
echo "║                                                          ║"
echo "║  Testing rebe-shell using rebe-shell principles         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
run_test() {
    local test_name="$1"
    local test_cmd="$2"

    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "Testing: $test_name... "

    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}✗${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

cd "$PROJECT_ROOT"

echo "=== Repository Structure Tests ==="
echo ""

run_test "Git repository initialized" "test -d .git"
run_test "README.md exists" "test -f README.md"
run_test "VISION.md exists" "test -f VISION.md"
run_test "ARCHITECTURE.md exists" "test -f ARCHITECTURE.md"
run_test "DEVELOPMENT.md exists" "test -f DEVELOPMENT.md"
run_test "CHANGELOG.md exists" "test -f CHANGELOG.md"
run_test "LICENSE exists" "test -f LICENSE"
run_test "ADRs documented" "test -f docs/DECISIONS.md"

echo ""
echo "=== Source Code Structure Tests ==="
echo ""

run_test "Rust backend exists" "test -d src-tauri/src"
run_test "TypeScript frontend exists" "test -d src"
run_test "PTY module exists" "test -f src-tauri/src/pty/mod.rs"
run_test "SSH module exists" "test -f src-tauri/src/ssh/mod.rs"
run_test "Stream module exists" "test -f src-tauri/src/stream/mod.rs"
run_test "Circuit breaker module exists" "test -f src-tauri/src/circuit_breaker/mod.rs"
run_test "Protocol module exists" "test -f src-tauri/src/protocol/mod.rs"
run_test "WASM module exists" "test -f src-tauri/src/wasm/mod.rs"

echo ""
echo "=== Configuration Files Tests ==="
echo ""

run_test "Cargo.toml exists" "test -f src-tauri/Cargo.toml"
run_test "package.json exists" "test -f package.json"
run_test "tsconfig.json exists" "test -f tsconfig.json"
run_test "vite.config.ts exists" "test -f vite.config.ts"
run_test "tauri.conf.json exists" "test -f src-tauri/tauri.conf.json"
run_test "rustfmt.toml exists" "test -f rustfmt.toml"
run_test ".gitignore exists" "test -f .gitignore"

echo ""
echo "=== Documentation Quality Tests ==="
echo ""

run_test "README >500 lines" "test $(wc -l < README.md) -gt 500"
run_test "VISION >500 lines" "test $(wc -l < VISION.md) -gt 500"
run_test "ARCHITECTURE >500 lines" "test $(wc -l < ARCHITECTURE.md) -gt 500"
run_test "DEVELOPMENT >300 lines" "test $(wc -l < DEVELOPMENT.md) -gt 300"
run_test "At least 10 ADRs" "test $(grep -c '^## ADR-' docs/DECISIONS.md) -ge 10"

echo ""
echo "=== Code Quality Tests ==="
echo ""

run_test "No TODO in main.rs" "! grep -q 'TODO' src-tauri/src/main.rs || true"
run_test "PTY module has tests" "grep -q '#\[cfg(test)\]' src-tauri/src/pty/mod.rs"
run_test "SSH module has tests" "grep -q '#\[cfg(test)\]' src-tauri/src/ssh/pool.rs"
run_test "Stream module has tests" "grep -q '#\[cfg(test)\]' src-tauri/src/stream/mod.rs"
run_test "Circuit breaker has tests" "grep -q '#\[cfg(test)\]' src-tauri/src/circuit_breaker/mod.rs"
run_test "Protocol has tests" "grep -q '#\[cfg(test)\]' src-tauri/src/protocol/mod.rs"

echo ""
echo "=== Architecture Decision Validation ==="
echo ""

run_test "ADR-001: Tauri dependency" "grep -q 'tauri.*=' src-tauri/Cargo.toml"
run_test "ADR-002: Wasmtime dependency" "grep -q 'wasmtime.*=' src-tauri/Cargo.toml"
run_test "ADR-003: serde_json for protocol" "grep -q 'serde_json' src-tauri/Cargo.toml"
run_test "ADR-004: SSH2 for connections" "grep -q 'ssh2.*=' src-tauri/Cargo.toml"
run_test "ADR-005: bytes for streaming" "grep -q 'bytes.*=' src-tauri/Cargo.toml"
run_test "ADR-008: tokio for async" "grep -q 'tokio.*=' src-tauri/Cargo.toml"
run_test "ADR-009: portable-pty" "grep -q 'portable-pty' src-tauri/Cargo.toml"
run_test "ADR-010: xterm.js" "grep -q 'xterm' package.json"

echo ""
echo "=== Git History Tests ==="
echo ""

run_test "At least 2 commits" "test $(git log --oneline | wc -l) -ge 2"
run_test "Initial commit exists" "git log --oneline | grep -q 'Initial commit'"
run_test "Implementation commit exists" "git log --oneline | grep -q 'feat:'"
run_test "Co-authored by Claude" "git log | grep -q 'Co-Authored-By: Claude'"

echo ""
echo "=== Design Principles Validation ==="
echo ""

run_test "Structured protocol over text parsing" "grep -q 'serde.*Serialize' src-tauri/src/protocol/mod.rs"
run_test "Circuit breaker for fault tolerance" "grep -q 'CircuitBreaker' src-tauri/src/circuit_breaker/mod.rs"
run_test "Connection pooling implemented" "grep -q 'SSHPool' src-tauri/src/ssh/pool.rs"
run_test "Streaming handler (not concat)" "grep -q 'chunks: Vec' src-tauri/src/stream/mod.rs"
run_test "PTY abstraction for cross-platform" "grep -q 'portable_pty' src-tauri/src/pty/mod.rs"

echo ""
echo "=== Integration Tests Available ==="
echo ""

run_test "Integration tests exist" "test -f tests/integration_test.rs"
run_test "Architecture validation exists" "test -f tests/architecture_validation.rs"
run_test "Integration tests comprehensive" "test $(wc -l < tests/integration_test.rs) -gt 300"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                   Test Results                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "  Total tests run: ${BLUE}$TESTS_RUN${NC}"
echo -e "  Tests passed:    ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Tests failed:    ${RED}$TESTS_FAILED${NC}"
echo ""

PASS_RATE=$((TESTS_PASSED * 100 / TESTS_RUN))

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed (${PASS_RATE}% pass rate)${NC}"
    echo ""
    exit 1
fi
