#!/bin/bash
# AMCP Git-Based Recovery
# Simple. Battle-tested. Human-controlled.

set -e

CLAWD_DIR="${HOME}/clawd"
MEMORIES_DIR="${HOME}/memories"

echo "🏴‍☠️ AMCP GIT RECOVERY"
echo ""

# Verify memories repo exists
if [ ! -d "$MEMORIES_DIR/.git" ]; then
    echo "📥 Cloning memories repo..."
    cd ~
    git clone git@github.com:fcavalcantirj/ClaudiusThePirateEmpeRoR-MeMoRies.git memories
fi

# Pull latest
echo "📥 Pulling latest checkpoint..."
cd "$MEMORIES_DIR"
git pull origin main 2>&1 || echo "Already up to date or no remote yet"

# Check if checkpoint exists
if [ ! -f "$MEMORIES_DIR/CHECKPOINT.json" ]; then
    echo "⚠️ No checkpoint found in memories repo"
    echo "   Run git-checkpoint.sh first to create one"
    exit 1
fi

# Show checkpoint info
echo ""
echo "📋 Checkpoint info:"
cat "$MEMORIES_DIR/CHECKPOINT.json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"   Timestamp: {d['timestamp']}\"); print(f\"   Note: {d['note']}\")"

echo ""
echo "📦 Restoring core identity..."
cp -f "$MEMORIES_DIR/core/"*.md "$CLAWD_DIR/" 2>/dev/null || echo "   - No core files"

echo "📦 Restoring workspace context..."
cp -f "$MEMORIES_DIR/workspace/"*.md "$CLAWD_DIR/" 2>/dev/null || echo "   - No workspace files"

echo "📦 Restoring daily notes..."
mkdir -p "$CLAWD_DIR/memory"
cp -f "$MEMORIES_DIR/daily-notes/"*.md "$CLAWD_DIR/memory/" 2>/dev/null || echo "   - No daily notes"
cp -f "$MEMORIES_DIR/daily-notes/"*.json "$CLAWD_DIR/memory/" 2>/dev/null || echo "   - No JSON files"

echo "📦 Restoring research docs..."
if [ -d "$MEMORIES_DIR/research" ]; then
    mkdir -p "$CLAWD_DIR/research"
    cp -f "$MEMORIES_DIR/research/"*.md "$CLAWD_DIR/research/" 2>/dev/null || echo "   - No research docs"
fi

# Count restored files
CORE_COUNT=$(ls -1 "$CLAWD_DIR/"*.md 2>/dev/null | grep -E "(SOUL|MEMORY|IDENTITY)" | wc -l)
WORKSPACE_COUNT=$(ls -1 "$CLAWD_DIR/"*.md 2>/dev/null | grep -E "(USER|TOOLS|AGENTS|HEARTBEAT)" | wc -l)
DAILY_COUNT=$(ls -1 "$CLAWD_DIR/memory/"*.md 2>/dev/null | wc -l)

echo ""
echo "✅ RECOVERY COMPLETE"
echo "   Core files: $CORE_COUNT"
echo "   Workspace files: $WORKSPACE_COUNT"
echo "   Daily notes: $DAILY_COUNT"
echo ""
echo "🏴‍☠️ I'm back. Arrr!"
