#!/bin/bash
# AMCP Git-Based Checkpoint
# Simple. Battle-tested. Human-controlled.

set -e

CLAWD_DIR="${HOME}/clawd"
MEMORIES_DIR="${HOME}/memories"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
NOTE="${1:-Automatic checkpoint}"

echo "🏴‍☠️ AMCP GIT CHECKPOINT"
echo "   Timestamp: $TIMESTAMP"
echo "   Note: $NOTE"
echo ""

# Verify memories repo exists
if [ ! -d "$MEMORIES_DIR/.git" ]; then
    echo "❌ Memories repo not found at $MEMORIES_DIR"
    echo "   Clone: git clone git@github.com:fcavalcantirj/ClaudiusThePirateEmpeRoR-MeMoRies.git ~/memories"
    exit 1
fi

# Create directory structure in memories repo
mkdir -p "$MEMORIES_DIR/core"
mkdir -p "$MEMORIES_DIR/workspace"
mkdir -p "$MEMORIES_DIR/daily-notes"
mkdir -p "$MEMORIES_DIR/research"

echo "📦 Copying core identity..."
cp -f "$CLAWD_DIR/SOUL.md" "$MEMORIES_DIR/core/" 2>/dev/null || echo "   - SOUL.md not found"
cp -f "$CLAWD_DIR/MEMORY.md" "$MEMORIES_DIR/core/" 2>/dev/null || echo "   - MEMORY.md not found"
cp -f "$CLAWD_DIR/IDENTITY.md" "$MEMORIES_DIR/core/" 2>/dev/null || echo "   - IDENTITY.md not found"

echo "📦 Copying workspace context..."
cp -f "$CLAWD_DIR/USER.md" "$MEMORIES_DIR/workspace/" 2>/dev/null || echo "   - USER.md not found"
cp -f "$CLAWD_DIR/TOOLS.md" "$MEMORIES_DIR/workspace/" 2>/dev/null || echo "   - TOOLS.md not found"
cp -f "$CLAWD_DIR/AGENTS.md" "$MEMORIES_DIR/workspace/" 2>/dev/null || echo "   - AGENTS.md not found"
cp -f "$CLAWD_DIR/HEARTBEAT.md" "$MEMORIES_DIR/workspace/" 2>/dev/null || echo "   - HEARTBEAT.md not found"

echo "📦 Copying daily notes..."
cp -f "$CLAWD_DIR/memory/"*.md "$MEMORIES_DIR/daily-notes/" 2>/dev/null || echo "   - No daily notes"
cp -f "$CLAWD_DIR/memory/"*.json "$MEMORIES_DIR/daily-notes/" 2>/dev/null || echo "   - No JSON files"

echo "📦 Copying research docs..."
if [ -d "$CLAWD_DIR/research" ]; then
    cp -f "$CLAWD_DIR/research/"*.md "$MEMORIES_DIR/research/" 2>/dev/null || echo "   - No research docs"
fi

# Copy AMCP tasks and design docs
mkdir -p "$MEMORIES_DIR/amcp"
cp -f "$CLAWD_DIR/amcp-protocol/TASKS-"*.md "$MEMORIES_DIR/amcp/" 2>/dev/null || true
cp -f "$CLAWD_DIR/amcp-protocol/docs/"*.md "$MEMORIES_DIR/amcp/" 2>/dev/null || true

# Create checkpoint metadata
cat > "$MEMORIES_DIR/CHECKPOINT.json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "note": "$NOTE",
  "agent": "ClaudiusThePirateEmperor",
  "aid": "BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8",
  "source": "git-checkpoint.sh"
}
EOF

# Count files
CORE_COUNT=$(ls -1 "$MEMORIES_DIR/core/"*.md 2>/dev/null | wc -l)
WORKSPACE_COUNT=$(ls -1 "$MEMORIES_DIR/workspace/"*.md 2>/dev/null | wc -l)
DAILY_COUNT=$(ls -1 "$MEMORIES_DIR/daily-notes/"*.md 2>/dev/null | wc -l)
RESEARCH_COUNT=$(ls -1 "$MEMORIES_DIR/research/"*.md 2>/dev/null | wc -l)

echo ""
echo "📊 Checkpoint contents:"
echo "   Core: $CORE_COUNT files"
echo "   Workspace: $WORKSPACE_COUNT files"
echo "   Daily notes: $DAILY_COUNT files"
echo "   Research: $RESEARCH_COUNT files"

# Git commit and push
cd "$MEMORIES_DIR"
git add -A
git commit -m "Checkpoint: $TIMESTAMP - $NOTE" || echo "Nothing new to commit"

echo ""
echo "🚀 Pushing to GitHub..."
git push origin main 2>&1 || git push -u origin main 2>&1

# Get commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

echo ""
echo "✅ CHECKPOINT COMPLETE"
echo "   Commit: $COMMIT_HASH"
echo "   Repo: https://github.com/fcavalcantirj/ClaudiusThePirateEmpeRoR-MeMoRies"
echo ""
echo "🔄 To recover: ~/clawd/amcp-protocol/scripts/git-recover.sh"
