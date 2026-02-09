#!/bin/bash
#
# Watchdog check - lightweight probe, triggers self-heal on failure
#

SELF_HEAL="$HOME/clawd/amcp-protocol/scripts/self-heal.sh"
FAILURE_COUNT_FILE="/tmp/amcp-watchdog-failures"

# Check gateway process
if ! pgrep -f "openclaw-gateway" > /dev/null; then
  echo "Gateway not running"
  
  # Increment failure count
  FAILURES=$(cat "$FAILURE_COUNT_FILE" 2>/dev/null || echo 0)
  FAILURES=$((FAILURES + 1))
  echo "$FAILURES" > "$FAILURE_COUNT_FILE"
  
  # Trigger self-heal after 2 consecutive failures (avoid false positives)
  if [ "$FAILURES" -ge 2 ]; then
    echo "Triggering self-heal (failures: $FAILURES)"
    "$SELF_HEAL" "Gateway dead for $FAILURES checks"
    echo 0 > "$FAILURE_COUNT_FILE"
  fi
  
  exit 1
fi

# Gateway is running - reset failure count
echo 0 > "$FAILURE_COUNT_FILE"
exit 0
