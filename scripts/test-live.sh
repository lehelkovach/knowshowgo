#!/bin/bash
# Quick script to run live integration tests with logging

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT_DIR/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/test-live-$TIMESTAMP.log"

mkdir -p "$LOG_DIR"

echo "============================================"
echo "KnowShowGo Live Test Runner"
echo "============================================"
echo "Timestamp: $(date)"
echo "Log file: $LOG_FILE"
echo ""

# Check if ArangoDB is available
check_arango() {
    local url="${ARANGO_URL:-http://localhost:8529}"
    echo "Checking ArangoDB at $url..."
    if curl -s --connect-timeout 5 "$url/_api/version" > /dev/null 2>&1; then
        echo "✓ ArangoDB is reachable"
        return 0
    else
        echo "✗ ArangoDB is not reachable"
        return 1
    fi
}

# Check if KnowShowGo server is running
check_server() {
    local url="${KSG_URL:-http://localhost:3000}"
    echo "Checking KnowShowGo server at $url..."
    if curl -s --connect-timeout 5 "$url/health" > /dev/null 2>&1; then
        echo "✓ KnowShowGo server is running"
        return 0
    else
        echo "✗ KnowShowGo server is not running"
        return 1
    fi
}

# Run tests
run_tests() {
    local mode="$1"
    echo ""
    echo "Running $mode tests..."
    echo "-------------------------------------------"
    
    if [ "$mode" = "live" ]; then
        TEST_LIVE=true npm test -- --testPathPattern=tests/integration 2>&1 | tee -a "$LOG_FILE"
    else
        npm test -- --testPathPattern=tests/integration 2>&1 | tee -a "$LOG_FILE"
    fi
    
    return ${PIPESTATUS[0]}
}

# Main
main() {
    echo "Environment:" | tee -a "$LOG_FILE"
    echo "  ARANGO_URL: ${ARANGO_URL:-http://localhost:8529}" | tee -a "$LOG_FILE"
    echo "  ARANGO_DB: ${ARANGO_DB:-knowshowgo_test}" | tee -a "$LOG_FILE"
    echo "  ARANGO_USER: ${ARANGO_USER:-root}" | tee -a "$LOG_FILE"
    echo ""

    # Always run mock tests first
    echo "=== MOCK MODE TESTS ===" | tee -a "$LOG_FILE"
    if run_tests "mock"; then
        echo "✓ Mock tests passed" | tee -a "$LOG_FILE"
    else
        echo "✗ Mock tests failed" | tee -a "$LOG_FILE"
        exit 1
    fi

    # Check for live mode
    if [ "$1" = "--live" ] || [ "$TEST_LIVE" = "true" ]; then
        echo ""
        echo "=== LIVE MODE TESTS ===" | tee -a "$LOG_FILE"
        
        if ! check_arango; then
            echo "Skipping live tests - ArangoDB not available" | tee -a "$LOG_FILE"
            exit 0
        fi
        
        if run_tests "live"; then
            echo "✓ Live tests passed" | tee -a "$LOG_FILE"
        else
            echo "✗ Live tests failed" | tee -a "$LOG_FILE"
            exit 1
        fi
    fi

    echo ""
    echo "============================================"
    echo "All tests completed successfully!"
    echo "Log saved to: $LOG_FILE"
    echo "============================================"
}

main "$@"
