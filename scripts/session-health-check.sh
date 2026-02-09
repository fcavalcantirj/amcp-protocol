#!/bin/bash
#
# session-health-check.sh — AMCP session health probe
#
# Goes beyond "is gateway running?" to "can session actually respond?"
#
# Failure modes detected:
# 1. Gateway DOWN — process not running
# 2. Gateway UP, Session CORRUPTED — 400 errors
# 3. Gateway UP, Auth EXPIRED — 401 errors
#
# Exit codes:
# 0 = healthy
# 1 = gateway down
# 2 = session corrupted (400 loop)
# 3 = auth expired (401)
# 4 = unknown error

set -e

OPENCLAW_DIR="${OPENCLAW_DIR:-$HOME/.openclaw}"
LOG_FILE="/tmp/amcp-health-check.log"
MAX_ERRORS=3  # Trigger recovery after N consecutive errors

log() {
    echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

# Check 1: Is gateway process running?
check_process() {
    if ! pgrep -f "openclaw-gateway" > /dev/null 2>&1; then
        log "FAIL: Gateway process not running"
        return 1
    fi
    log "OK: Gateway process running"
    return 0
}

# Check 2: Can we reach the gateway status endpoint?
check_status_endpoint() {
    local response
    response=$(openclaw gateway status 2>&1) || true
    
    if echo "$response" | grep -q "running"; then
        log "OK: Gateway status endpoint responding"
        return 0
    else
        log "FAIL: Gateway status endpoint not responding: $response"
        return 1
    fi
}

# Check 3: Look for 400 errors in recent session logs
check_session_health() {
    local session_dir="$OPENCLAW_DIR/agents/main/sessions"
    local latest_session
    
    # Find most recent session
    latest_session=$(ls -t "$session_dir"/*.jsonl 2>/dev/null | head -1)
    
    if [[ -z "$latest_session" ]]; then
        log "WARN: No session files found"
        return 0  # Not necessarily an error
    fi
    
    # Check last N lines for 400 errors
    local error_count
    error_count=$(tail -20 "$latest_session" | grep -c '"stopReason":"error"' || echo 0)
    
    if [[ "$error_count" -ge "$MAX_ERRORS" ]]; then
        log "FAIL: Session corrupted — $error_count consecutive errors in $latest_session"
        return 2
    fi
    
    # Check for 401 auth errors
    if tail -5 "$latest_session" | grep -q "authentication_error\|401"; then
        log "FAIL: Auth expired — 401 errors in session"
        return 3
    fi
    
    log "OK: Session health check passed"
    return 0
}

# Main health check
main() {
    log "=== AMCP Session Health Check ==="
    
    # Check 1: Process
    if ! check_process; then
        exit 1
    fi
    
    # Check 2: Status endpoint
    if ! check_status_endpoint; then
        exit 1
    fi
    
    # Check 3: Session health (the blind spot!)
    local session_result
    check_session_health
    session_result=$?
    
    if [[ "$session_result" -eq 2 ]]; then
        log "ACTION: Session corrupted — run fix-openclaw-session.py"
        exit 2
    elif [[ "$session_result" -eq 3 ]]; then
        log "ACTION: Auth expired — need credential refresh"
        exit 3
    fi
    
    log "=== All checks passed ==="
    exit 0
}

main "$@"
