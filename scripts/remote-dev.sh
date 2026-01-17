#!/bin/bash
# Remote Development Helper for KnowShowGo on OCI
#
# Usage:
#   ./scripts/remote-dev.sh status          # Check service status
#   ./scripts/remote-dev.sh logs            # Stream API logs
#   ./scripts/remote-dev.sh logs db         # Stream ArangoDB logs
#   ./scripts/remote-dev.sh shell           # Open shell on API container
#   ./scripts/remote-dev.sh restart         # Restart services
#   ./scripts/remote-dev.sh deploy          # Pull latest and restart
#   ./scripts/remote-dev.sh hotfix "msg"    # Quick commit, push, deploy
#   ./scripts/remote-dev.sh test            # Run tests on remote
#   ./scripts/remote-dev.sh health          # Health check
#   ./scripts/remote-dev.sh rollback        # Rollback to previous commit

set -euo pipefail

# Configuration (override with env vars or .env.remote)
REMOTE_HOST="${OCI_SSH_HOST:-}"
REMOTE_USER="${OCI_SSH_USER:-ubuntu}"
REMOTE_KEY="${OCI_SSH_KEY:-~/.ssh/id_ed25519}"
REMOTE_PORT="${OCI_SSH_PORT:-22}"
REMOTE_APP_DIR="${OCI_APP_DIR:-/opt/knowshowgo/repo}"
REMOTE_API_URL="${REMOTE_API_URL:-http://localhost:3000}"

# Load .env.remote if exists
if [ -f ".env.remote" ]; then
    source .env.remote
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[remote-dev]${NC} $1"; }
warn() { echo -e "${YELLOW}[remote-dev]${NC} $1"; }
error() { echo -e "${RED}[remote-dev]${NC} $1"; exit 1; }

check_config() {
    if [ -z "$REMOTE_HOST" ]; then
        error "REMOTE_HOST not set. Set OCI_SSH_HOST env var or create .env.remote"
    fi
}

ssh_cmd() {
    ssh -i "$REMOTE_KEY" -p "$REMOTE_PORT" -o StrictHostKeyChecking=no \
        "$REMOTE_USER@$REMOTE_HOST" "$@"
}

cmd_status() {
    log "Checking service status on $REMOTE_HOST..."
    ssh_cmd "cd $REMOTE_APP_DIR && docker compose ps"
}

cmd_logs() {
    local service="${1:-knowshowgo-api}"
    log "Streaming logs from $service..."
    ssh_cmd "cd $REMOTE_APP_DIR && docker compose logs -f $service"
}

cmd_shell() {
    log "Opening shell on knowshowgo-api container..."
    ssh_cmd "cd $REMOTE_APP_DIR && docker compose exec knowshowgo-api sh"
}

cmd_restart() {
    log "Restarting services..."
    ssh_cmd "cd $REMOTE_APP_DIR && docker compose restart"
    log "Waiting for health check..."
    sleep 5
    cmd_health
}

cmd_deploy() {
    log "Deploying latest changes..."
    ssh_cmd "cd $REMOTE_APP_DIR && \
        git fetch --all && \
        git reset --hard origin/main && \
        docker compose up -d --build"
    log "Waiting for services to start..."
    sleep 10
    cmd_health
}

cmd_hotfix() {
    local msg="${1:-hotfix}"
    log "Hotfix: committing, pushing, and deploying..."
    
    # Local: commit and push
    git add -A
    git commit -m "hotfix: $msg" || true
    git push origin main
    
    # Remote: deploy
    cmd_deploy
}

cmd_test() {
    log "Running tests on remote..."
    ssh_cmd "cd $REMOTE_APP_DIR && docker compose exec knowshowgo-api npm test"
}

cmd_health() {
    log "Health check..."
    local result
    result=$(ssh_cmd "curl -s $REMOTE_API_URL/health" 2>/dev/null || echo '{"status":"unreachable"}')
    echo "$result" | jq . 2>/dev/null || echo "$result"
    
    if echo "$result" | grep -q '"status":"ok"'; then
        log "Service is healthy!"
        return 0
    else
        error "Service is NOT healthy!"
        return 1
    fi
}

cmd_rollback() {
    log "Rolling back to previous commit..."
    ssh_cmd "cd $REMOTE_APP_DIR && \
        git reset --hard HEAD~1 && \
        docker compose up -d --build"
    log "Waiting for services to start..."
    sleep 10
    cmd_health
}

cmd_ssh() {
    log "Opening SSH session to $REMOTE_HOST..."
    ssh -i "$REMOTE_KEY" -p "$REMOTE_PORT" "$REMOTE_USER@$REMOTE_HOST"
}

cmd_help() {
    cat << EOF
KnowShowGo Remote Development Helper

Usage: ./scripts/remote-dev.sh <command> [args]

Commands:
  status          Check service status (docker compose ps)
  logs [service]  Stream logs (default: knowshowgo-api, or: db)
  shell           Open shell in API container
  restart         Restart all services
  deploy          Pull latest from main and rebuild
  hotfix "msg"    Commit, push, and deploy in one command
  test            Run tests on remote server
  health          Check /health endpoint
  rollback        Rollback to previous commit
  ssh             Open SSH session to server

Configuration:
  Set these env vars or create .env.remote:
    OCI_SSH_HOST      Remote server IP/hostname (required)
    OCI_SSH_USER      SSH username (default: ubuntu)
    OCI_SSH_KEY       Path to SSH private key (default: ~/.ssh/id_ed25519)
    OCI_SSH_PORT      SSH port (default: 22)
    OCI_APP_DIR       App directory on server (default: /opt/knowshowgo/repo)
    REMOTE_API_URL    API URL for health checks (default: http://localhost:3000)

Example .env.remote:
    OCI_SSH_HOST=123.45.67.89
    OCI_SSH_USER=ubuntu
    OCI_SSH_KEY=~/.ssh/oci_key

EOF
}

# Main
check_config

case "${1:-help}" in
    status)   cmd_status ;;
    logs)     cmd_logs "${2:-knowshowgo-api}" ;;
    shell)    cmd_shell ;;
    restart)  cmd_restart ;;
    deploy)   cmd_deploy ;;
    hotfix)   cmd_hotfix "${2:-hotfix}" ;;
    test)     cmd_test ;;
    health)   cmd_health ;;
    rollback) cmd_rollback ;;
    ssh)      cmd_ssh ;;
    help|*)   cmd_help ;;
esac
