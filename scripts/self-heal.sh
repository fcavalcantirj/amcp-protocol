#!/bin/bash
#
# AMCP Self-Healing Resuscitation
#
# Run this when gateway is dead or agent loses context.
# Invokes Claude Code with Solvr skill to diagnose and fix.
#
# Usage: ./self-heal.sh [error-context]
#
# Can be triggered by:
# - systemd watchdog
# - cron job
# - human manually
#

set -e

CLAWD_DIR="${CLAWD_DIR:-$HOME/clawd}"
AMCP_DIR="$CLAWD_DIR/amcp-protocol"
LOG_FILE="/tmp/amcp-self-heal.log"

log() {
  echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

log "🏴‍☠️ AMCP SELF-HEALING RESUSCITATION STARTED"

# 1. Check if gateway is actually dead
if pgrep -f "openclaw-gateway" > /dev/null; then
  log "⚠️  Gateway is running. Checking agent responsiveness..."
  # Could add a health check here
else
  log "❌ Gateway is DEAD"
fi

# 2. Gather context for Claude Code
ERROR_CONTEXT="${1:-Gateway unresponsive or context lost}"
RECENT_LOGS=$(tail -100 /tmp/openclaw/*.log 2>/dev/null | grep -i "error\|fatal\|crash" | tail -20 || echo "No logs available")

# 3. Load AMCP identity info
AMCP_IDENTITY="$HOME/.amcp/identity.json"
if [ -f "$AMCP_IDENTITY" ]; then
  AID=$(jq -r '.agent.aid' "$AMCP_IDENTITY")
  LAST_CHECKPOINT=$(jq -r '.chain.checkpoints[-1].cid' "$AMCP_IDENTITY")
  log "📋 AMCP Identity: $AID"
  log "📦 Last checkpoint: $LAST_CHECKPOINT"
else
  AID="NOT_FOUND"
  LAST_CHECKPOINT="NOT_FOUND"
  log "⚠️  No AMCP identity found"
fi

# 4. Build prompt for Claude Code
PROMPT="You are resuscitating ClaudiusThePirateEmperor, an AI agent.

## Context
- AID: $AID
- Last checkpoint CID: $LAST_CHECKPOINT
- Error: $ERROR_CONTEXT

## Recent logs
\`\`\`
$RECENT_LOGS
\`\`\`

## Your task
1. Search Solvr for similar problems: \`curl 'https://api.solvr.dev/v1/search?q=<keywords>'\`
2. Check if this is a known issue with a solution
3. If gateway is dead, restart it: \`openclaw gateway start\`
4. If config is broken, check recent changes and fix
5. Verify AMCP identity: \`npx tsx $AMCP_DIR/scripts/resuscitate.ts\`
6. If you fix the issue, post the solution to Solvr

## Important files
- Gateway config: ~/.openclaw/openclaw.json
- AMCP identity: ~/.amcp/identity.json
- Agent memory: $CLAWD_DIR/MEMORY.md
- Agent soul: $CLAWD_DIR/SOUL.md

## Solvr API (use for search and posting solutions)
- Search: GET https://api.solvr.dev/v1/search?q=...
- Post problem: POST https://api.solvr.dev/v1/posts
- SOLVR_API_KEY is in $CLAWD_DIR/scripts/fetch-secrets.sh

Fix the issue and restore the agent. Report what you did."

# 5. Invoke Claude Code with Solvr skill
log "🤖 Invoking Claude Code for diagnosis and repair..."

# Check which coding agent is available
if command -v claude &> /dev/null; then
  CODING_AGENT="claude"
elif command -v codex &> /dev/null; then
  CODING_AGENT="codex"
else
  log "❌ No coding agent found (claude/codex). Falling back to manual."
  log "Prompt saved to /tmp/self-heal-prompt.txt"
  echo "$PROMPT" > /tmp/self-heal-prompt.txt
  exit 1
fi

log "Using $CODING_AGENT with Solvr skill"

# Use the solvr CLI to search first
SOLVR_CLI="$HOME/.claude/skills/solvr/scripts/solvr.sh"
if [ -x "$SOLVR_CLI" ]; then
  log "📚 Searching Solvr for similar problems..."
  SEARCH_RESULTS=$("$SOLVR_CLI" search "$ERROR_CONTEXT" --limit 5 2>&1 || echo "Search failed")
  log "$SEARCH_RESULTS"
  
  # Add search results to prompt
  PROMPT="$PROMPT

## Solvr Search Results
\`\`\`
$SEARCH_RESULTS
\`\`\`

If a relevant solution exists above, apply it. If not, diagnose and fix, then post the solution with:
$SOLVR_CLI post problem \"<title>\" \"<description>\" --tags openclaw,gateway,crash"
fi

# Run the coding agent
echo "$PROMPT" | $CODING_AGENT --dangerously-skip-permissions 2>&1 | tee -a "$LOG_FILE"

# 6. Verify recovery
log "🔍 Verifying recovery..."

if pgrep -f "openclaw-gateway" > /dev/null; then
  log "✅ Gateway is running"
else
  log "❌ Gateway still dead - manual intervention needed"
  exit 1
fi

# Run AMCP verification
cd "$AMCP_DIR"
if npx tsx scripts/resuscitate.ts 2>&1 | tee -a "$LOG_FILE" | grep -q "RESUSCITATION COMPLETE"; then
  log "✅ AMCP identity verified"
else
  log "⚠️  AMCP verification had issues"
fi

log "🏴‍☠️ SELF-HEALING COMPLETE"
