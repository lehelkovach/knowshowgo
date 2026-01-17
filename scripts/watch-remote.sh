#!/bin/bash
# Watch Remote Service - Continuous health monitoring with alerts
#
# Usage:
#   ./scripts/watch-remote.sh                    # Watch with defaults
#   ./scripts/watch-remote.sh --interval 10     # Check every 10 seconds
#   ./scripts/watch-remote.sh --url http://...  # Custom URL

set -euo pipefail

# Configuration
REMOTE_URL="${REMOTE_API_URL:-http://localhost:3000}"
INTERVAL="${WATCH_INTERVAL:-30}"
LOG_FILE="logs/watch-remote.log"
ALERT_ON_FAIL="${ALERT_ON_FAIL:-true}"

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --url) REMOTE_URL="$2"; shift 2 ;;
        --interval) INTERVAL="$2"; shift 2 ;;
        --log) LOG_FILE="$2"; shift 2 ;;
        *) shift ;;
    esac
done

mkdir -p "$(dirname "$LOG_FILE")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    local ts=$(date -Iseconds)
    echo -e "[$ts] $1" | tee -a "$LOG_FILE"
}

check_health() {
    local start=$(date +%s%N)
    local result
    local status="unknown"
    local latency=0
    
    if result=$(curl -s --connect-timeout 5 --max-time 10 "$REMOTE_URL/health" 2>/dev/null); then
        local end=$(date +%s%N)
        latency=$(( (end - start) / 1000000 ))
        
        if echo "$result" | grep -q '"status":"ok"'; then
            status="healthy"
            echo -e "${GREEN}✓${NC} HEALTHY (${latency}ms)"
            log "HEALTHY latency=${latency}ms response=$result"
            return 0
        else
            status="unhealthy"
            echo -e "${YELLOW}⚠${NC} UNHEALTHY (${latency}ms): $result"
            log "UNHEALTHY latency=${latency}ms response=$result"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} UNREACHABLE"
        log "UNREACHABLE url=$REMOTE_URL"
        return 1
    fi
}

main() {
    echo "========================================="
    echo "KnowShowGo Remote Watcher"
    echo "========================================="
    echo "URL:      $REMOTE_URL"
    echo "Interval: ${INTERVAL}s"
    echo "Log:      $LOG_FILE"
    echo "========================================="
    echo ""
    
    local consecutive_failures=0
    
    while true; do
        if check_health; then
            consecutive_failures=0
        else
            ((consecutive_failures++))
            
            if [ "$ALERT_ON_FAIL" = "true" ] && [ $consecutive_failures -ge 3 ]; then
                log "ALERT: $consecutive_failures consecutive failures!"
                # Could add webhook/email alert here
            fi
        fi
        
        sleep "$INTERVAL"
    done
}

# Handle Ctrl+C
trap 'echo ""; log "Watcher stopped"; exit 0' INT TERM

main
