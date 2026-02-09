#!/bin/bash
#
# amcp-watchdog.sh — AMCP protection daemon
#
# Run via cron every 5 minutes to detect and recover from:
# 1. Gateway down
# 2. Session corrupted (400 loop)
# 3. Auth expired (401)
#
# Usage: */5 * * * * /home/clawdbot/clawd/amcp-protocol/scripts/amcp-watchdog.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/tmp/amcp-watchdog.log"
LOCK_FILE="/tmp/amcp-watchdog.lock"
MAX_LOG_SIZE=100000  # 100KB

log() {
    echo "[$(date -Iseconds)] $1" >> "$LOG_FILE"
}

# Rotate log if too big
if [[ -f "$LOG_FILE" && $(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE") -gt $MAX_LOG_SIZE ]]; then
    mv "$LOG_FILE" "$LOG_FILE.old"
fi

# Prevent concurrent runs
if [[ -f "$LOCK_FILE" ]]; then
    pid=$(cat "$LOCK_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        log "Already running (PID $pid), skipping"
        exit 0
    fi
fi
echo $$ > "$LOCK_FILE"
trap "rm -f $LOCK_FILE" EXIT

log "=== AMCP Watchdog starting ==="

# Run health check
"$SCRIPT_DIR/session-health-check.sh" >> "$LOG_FILE" 2>&1
health_status=$?

case $health_status in
    0)
        log "Health check passed"
        ;;
    1)
        log "ACTION: Gateway down — restarting"
        openclaw gateway restart >> "$LOG_FILE" 2>&1 || true
        sleep 5
        # Notify human
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=152099202" \
            -d "text=🚨 AMCP Watchdog: Gateway was down, restarted" > /dev/null 2>&1 || true
        ;;
    2)
        log "ACTION: Session corrupted — running repair script"
        python3 "$SCRIPT_DIR/fix-openclaw-session.py" --fix >> "$LOG_FILE" 2>&1 || true
        # Restart gateway after repair
        openclaw gateway restart >> "$LOG_FILE" 2>&1 || true
        sleep 5
        # Notify human
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=152099202" \
            -d "text=🚨 AMCP Watchdog: Session corrupted, repaired and restarted" > /dev/null 2>&1 || true
        ;;
    3)
        log "ACTION: Auth expired — notifying human (cannot auto-fix)"
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=152099202" \
            -d "text=🚨 AMCP Watchdog: Auth expired, need manual refresh" > /dev/null 2>&1 || true
        ;;
    *)
        log "Unknown health status: $health_status"
        ;;
esac

log "=== AMCP Watchdog complete ==="
