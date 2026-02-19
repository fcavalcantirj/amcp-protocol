#!/bin/bash

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
MAGENTA='\033[0;35m'
BLUE='\033[0;34m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# Configuration (can be overridden with env vars)
BATCH_SIZE=${BATCH_SIZE:-3}
WAIT_TIME_MINS=${WAIT_TIME_MINS:-15}         # Wait time after API errors (minutes)
BATCH_PAUSE_MINS=${BATCH_PAUSE_MINS:-15}     # Pause between successful batches
WAIT_TIME_SECS=$((WAIT_TIME_MINS * 60))
BATCH_PAUSE_SECS=$((BATCH_PAUSE_MINS * 60))

# Telegram notification settings
# Priority: env var > OpenClaw config file
OPENCLAW_CONFIG="${HOME}/.openclaw/openclaw.json"
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && [ -f "$OPENCLAW_CONFIG" ]; then
  TELEGRAM_BOT_TOKEN=$(jq -r '.channels.telegram.botToken // empty' "$OPENCLAW_CONFIG" 2>/dev/null || echo "")
fi
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-""}
TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID:-"152099202"}  # Felipe's Telegram ID

# Send Telegram notification
send_telegram() {
  local message="$1"
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      -d "text=${message}" \
      -d "parse_mode=Markdown" >> /tmp/telegram-debug.log 2>&1
  fi
}

batch_count=0
total_iterations=0
runner_start=$(date +%s)

# Cleanup on Ctrl+C
cleanup() {
  local runner_end=$(date +%s)
  local total_time=$((runner_end - runner_start))
  echo ""
  echo -e "${YELLOW}${BOLD}Interrupted. Exiting...${NC}"
  send_telegram "🛑 *amcp-protocol Ralph* - Runner Stopped

⏱️ Uptime: $(format_time $total_time)
📦 Batches completed: ${batch_count}
📊 Progress: $(./progress.sh)"
  exit 1
}
trap cleanup INT TERM

# Format seconds to hh:mm:ss
format_time() {
  local secs=$1
  printf "%02d:%02d:%02d" $((secs/3600)) $((secs%3600/60)) $((secs%60))
}

# Print a progress bar
print_progress_bar() {
  local current=$1
  local total=$2
  local width=40
  local percent=$((current * 100 / total))
  local filled=$((current * width / total))
  local empty=$((width - filled))

  printf "${YELLOW}["
  printf "%${filled}s" | tr ' ' '█'
  printf "%${empty}s" | tr ' ' '░'
  printf "] ${percent}%%${NC}"
}

clear
echo ""
echo -e "${MAGENTA}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
echo -e "${MAGENTA}${BOLD}║   🚀  AMCP-PROTOCOL - RALPH CONTINUOUS RUNNER                             ║${NC}"
echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
printf "${MAGENTA}${BOLD}║   📦 Batch size:     %-3s iterations                              ║${NC}\n" "$BATCH_SIZE"
printf "${MAGENTA}${BOLD}║   ⏸️  Batch pause:    %-3s minutes                                ║${NC}\n" "$BATCH_PAUSE_MINS"
printf "${MAGENTA}${BOLD}║   ⏰ Wait on error:  %-3s minutes                                 ║${NC}\n" "$WAIT_TIME_MINS"
echo -e "${MAGENTA}${BOLD}║   🕐 Started at:     $(date '+%Y-%m-%d %H:%M:%S')                        ║${NC}"
echo -e "${MAGENTA}${BOLD}║                                                                   ║${NC}"
echo -e "${MAGENTA}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Notify runner START via Telegram
send_telegram "🟢 *amcp-protocol Ralph* - Runner Started

📦 Batch size: ${BATCH_SIZE} iterations
⏸️ Batch pause: ${BATCH_PAUSE_MINS} min
📊 Progress: $(./progress.sh)"

while true; do
  batch_count=$((batch_count + 1))
  batch_start=$(date +%s)

  echo ""
  echo -e "${CYAN}${BOLD}┌───────────────────────────────────────────────────────────────────┐${NC}"
  echo -e "${CYAN}${BOLD}│  ▶ BATCH #${batch_count}                                                        │${NC}"
  echo -e "${CYAN}${BOLD}│  📅 $(date '+%Y-%m-%d %H:%M:%S')                                            │${NC}"
  echo -e "${CYAN}${BOLD}│  🔄 Running ${BATCH_SIZE} iterations...                                        │${NC}"
  echo -e "${CYAN}${BOLD}└───────────────────────────────────────────────────────────────────┘${NC}"
  echo ""

  # Notify batch START via Telegram
  send_telegram "🚀 *amcp-protocol Ralph* - Batch #${batch_count} Starting

📊 Current: $(./progress.sh)
🔄 Running ${BATCH_SIZE} iterations..."

  # Run ralph.sh and capture output + exit code
  tmplog=$(mktemp)
  ./ralph.sh $BATCH_SIZE 2>&1 | tee "$tmplog"
  exit_code=${PIPESTATUS[0]}

  # Check for API errors
  api_error=false
  error_msg=""
  error_detail=""

  # FIRST: Check if output indicates SUCCESS - if so, skip error detection
  if grep -q '"is_error":false' "$tmplog" && grep -q '"subtype":"success"' "$tmplog"; then
    api_error=false
  # Only check for errors if exit code is non-zero OR explicit error indicators
  elif [ $exit_code -ne 0 ]; then
    api_error=true
    # Try to identify specific error type
    if grep -qi "rate limit\|rate_limit\|ratelimit" "$tmplog"; then
      error_msg="Rate limit hit"
    elif grep -qi "hit your limit" "$tmplog"; then
      error_msg="You've hit your limit"
    elif grep -qi "overloaded" "$tmplog"; then
      error_msg="API overloaded"
    elif grep -qi "Too Many Requests" "$tmplog"; then
      error_msg="HTTP 429 (Too Many Requests)"
    elif grep -qi "Service Unavailable" "$tmplog"; then
      error_msg="HTTP 503 (Service Unavailable)"
    elif grep -qi "at capacity" "$tmplog"; then
      error_msg="API at capacity"
    elif grep -qi "No messages returned" "$tmplog"; then
      error_msg="No messages returned"
    elif grep -qi "ECONNREFUSED\|connection refused" "$tmplog"; then
      error_msg="Connection refused"
    else
      error_msg="Unknown error (exit code: $exit_code)"
    fi
    # Extract error context
    error_detail=$(grep -i "error\|failed\|refused\|limit" "$tmplog" | grep -v "is_error.*false" | tail -3 | head -c 300)
  fi

  # Check if PRD is complete before cleaning up
  prd_complete=false
  phase1_complete=false
  if grep -q "PHASE_3_COMPLETE\|PRD COMPLETE" "$tmplog" 2>/dev/null; then
    prd_complete=true
  fi
  if grep -q "PHASE_1_COMPLETE" "$tmplog" 2>/dev/null; then
    phase1_complete=true
  fi

  rm -f "$tmplog"

  batch_end=$(date +%s)
  batch_time=$((batch_end - batch_start))
  total_iterations=$((total_iterations + BATCH_SIZE))

  if [ "$api_error" = true ]; then
    # Calculate resume time (Linux compatible)
    resume_time=$(date -d "+${WAIT_TIME_MINS} minutes" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v+${WAIT_TIME_MINS}M '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo -e "${RED}${BOLD}┌───────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${RED}${BOLD}│                                                                   │${NC}"
    echo -e "${RED}${BOLD}│   🚨🚨🚨  API ERROR DETECTED  🚨🚨🚨                              │${NC}"
    echo -e "${RED}${BOLD}│                                                                   │${NC}"
    echo -e "${RED}${BOLD}│   ❌ Error: ${error_msg}${NC}"
    echo -e "${RED}${BOLD}│   ⏸️  Pausing for ${WAIT_TIME_MINS} minutes to avoid rate limits                    │${NC}"
    echo -e "${RED}${BOLD}│   🔄 Will resume at: ${resume_time}                       │${NC}"
    echo -e "${RED}${BOLD}│                                                                   │${NC}"
    echo -e "${RED}${BOLD}└───────────────────────────────────────────────────────────────────┘${NC}"
    echo ""

    # Notify via Telegram about API error (with actual error detail if available)
    if [ -n "$error_detail" ]; then
      send_telegram "🚨 *amcp-protocol Ralph* - API Error

❌ Error: ${error_msg}
📝 Detail: \`${error_detail:0:200}\`
⏸️ Pausing for ${WAIT_TIME_MINS} minutes
🔄 Resume: ${resume_time}
📊 Progress: $(./progress.sh)"
    else
      send_telegram "🚨 *amcp-protocol Ralph* - API Error

❌ Error: ${error_msg}
⏸️ Pausing for ${WAIT_TIME_MINS} minutes
🔄 Resume: ${resume_time}
📊 Progress: $(./progress.sh)"
    fi

    # Countdown display with progress bar
    remaining=$WAIT_TIME_SECS
    total_wait=$WAIT_TIME_SECS

    while [ $remaining -gt 0 ]; do
      elapsed=$((total_wait - remaining))
      hours=$((remaining / 3600))
      mins=$(((remaining % 3600) / 60))
      secs=$((remaining % 60))

      echo -ne "\r${YELLOW}${BOLD}   ⏳ Waiting: ${NC}${YELLOW}$(format_time $remaining)${NC}  "
      print_progress_bar $elapsed $total_wait
      echo -ne "  ${DIM}Resume: ${resume_time}${NC}   "

      sleep 1
      remaining=$((remaining - 1))
    done

    echo ""
    echo ""
    echo -e "${GREEN}${BOLD}   ✅ Wait complete! Resuming operations...${NC}"
    echo ""
  else
    # Calculate resume time (Linux compatible)
    resume_time=$(date -d "+${BATCH_PAUSE_MINS} minutes" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -v+${BATCH_PAUSE_MINS}M '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo -e "${GREEN}${BOLD}┌───────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${GREEN}${BOLD}│  ✅ BATCH #${batch_count} COMPLETED                                          │${NC}"
    echo -e "${GREEN}${BOLD}│  ⏱️  Duration: $(format_time $batch_time)                                         │${NC}"
    echo -e "${GREEN}${BOLD}│  📊 Progress: $(./progress.sh)                              │${NC}"
    echo -e "${GREEN}${BOLD}└───────────────────────────────────────────────────────────────────┘${NC}"
    echo ""

    # Notify via Telegram about batch completion
    send_telegram "✅ *amcp-protocol Ralph* - Batch #${batch_count} Complete

⏱️ Duration: $(format_time $batch_time)
📊 Progress: $(./progress.sh)
⏸️ Next batch in ${BATCH_PAUSE_MINS} min"

    # Pause between batches with countdown
    remaining=$BATCH_PAUSE_SECS
    total_pause=$BATCH_PAUSE_SECS

    while [ $remaining -gt 0 ]; do
      elapsed=$((total_pause - remaining))
      mins=$((remaining / 60))
      secs=$((remaining % 60))

      echo -ne "\r${YELLOW}   ⏸️  Breathing space: ${NC}${YELLOW}$(printf '%02d:%02d' $mins $secs)${NC}  "
      print_progress_bar $elapsed $total_pause
      echo -ne "  ${DIM}Next batch: ${resume_time}${NC}   "

      sleep 1
      remaining=$((remaining - 1))
    done

    echo ""
    echo ""
    echo -e "${GREEN}   ✅ Starting next batch...${NC}"
    echo ""
  fi

  # Check if PRD or PHASE 1 is complete
  if [ "$prd_complete" = true ] || [ "$phase1_complete" = true ]; then
    runner_end=$(date +%s)
    total_time=$((runner_end - runner_start))

    echo ""
    echo -e "${GREEN}${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║                                                                   ║${NC}"
    if [ "$phase1_complete" = true ]; then
      completion_msg="PHASE 1 COMPLETE!"
    else
      completion_msg="PHASE 3 COMPLETE!"
    fi
    echo -e "${GREEN}${BOLD}║   🎉🎉🎉  ${completion_msg}  🎉🎉🎉                                ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                                   ║${NC}"
    echo -e "${GREEN}${BOLD}║   📦 Total batches:     ${batch_count}                                          ║${NC}"
    echo -e "${GREEN}${BOLD}║   🔄 Total iterations:  ${total_iterations}                                         ║${NC}"
    echo -e "${GREEN}${BOLD}║   ⏱️  Total time:        $(format_time $total_time)                                  ║${NC}"
    echo -e "${GREEN}${BOLD}║   📊 $(./progress.sh)                                   ║${NC}"
    echo -e "${GREEN}${BOLD}║                                                                   ║${NC}"
    echo -e "${GREEN}${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Notify via Telegram about completion!
    if [ "$phase1_complete" = true ]; then
      send_telegram "🎉 *amcp-protocol PHASE 1 COMPLETE!* 🎉

📦 Total batches: ${batch_count}
🔄 Total iterations: ${total_iterations}
⏱️ Total time: $(format_time $total_time)
📊 $(./progress.sh)

Phase 1 done! Ready for Phase 2 when you are. 🚀"
    else
      send_telegram "🎉 *amcp-protocol PHASE 3 COMPLETE!* 🎉

📦 Total batches: ${batch_count}
🔄 Total iterations: ${total_iterations}
⏱️ Total time: $(format_time $total_time)
📊 $(./progress.sh)

Time to celebrate! 🚀"
    fi

    exit 0
  fi
done
