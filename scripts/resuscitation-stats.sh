#!/bin/bash
#
# Show resuscitation statistics
#

RESUSCITATION_LOG="$HOME/.amcp/resuscitations.jsonl"

if [ ! -f "$RESUSCITATION_LOG" ]; then
  echo "No resuscitations logged yet."
  exit 0
fi

echo "📊 RESUSCITATION STATISTICS"
echo "============================"
echo ""

# Total count
TOTAL=$(wc -l < "$RESUSCITATION_LOG")
echo "Total resuscitations: $TOTAL"

# Last 24h
RECENT=$(grep "$(date +%Y-%m-%d)" "$RESUSCITATION_LOG" 2>/dev/null | wc -l)
echo "Today: $RECENT"

# Last 7 days
WEEK=$(grep -E "$(date -d '6 days ago' +%Y-%m-%d)|$(date -d '5 days ago' +%Y-%m-%d)|$(date -d '4 days ago' +%Y-%m-%d)|$(date -d '3 days ago' +%Y-%m-%d)|$(date -d '2 days ago' +%Y-%m-%d)|$(date -d '1 day ago' +%Y-%m-%d)|$(date +%Y-%m-%d)" "$RESUSCITATION_LOG" 2>/dev/null | wc -l)
echo "Last 7 days: $WEEK"

echo ""
echo "Recent events:"
tail -5 "$RESUSCITATION_LOG" | jq -r '"  \(.timestamp): \(.status) - \(.error | .[0:50])..."' 2>/dev/null || tail -5 "$RESUSCITATION_LOG"

# Health assessment
echo ""
if [ "$RECENT" -gt 5 ]; then
  echo "⚠️  WARNING: High resuscitation rate today ($RECENT). Investigate root cause."
elif [ "$RECENT" -gt 2 ]; then
  echo "⚡ Elevated: $RECENT resuscitations today. Monitor closely."
else
  echo "✅ Healthy: Low resuscitation rate."
fi
