#!/bin/bash
#
# 🏴‍☠️ AMCP Full Respawn Test
# 
# Run this in Docker to test Claudius respawn from scratch
#
# Usage:
#   docker run -it --rm -e AGENTMEMORY_API_KEY="your_key" node:20 bash
#   curl -sSL URL | bash
#

set -e

echo "=========================================="
echo "🏴‍☠️ AMCP FULL RESPAWN TEST"
echo "=========================================="

if [ -z "$AGENTMEMORY_API_KEY" ]; then
    echo "❌ ERROR: AGENTMEMORY_API_KEY not set"
    echo "   Run with: docker run -e AGENTMEMORY_API_KEY=... ..."
    exit 1
fi

echo "✅ API key provided"
echo ""

echo "📦 Step 1: Installing dependencies..."
npm install -g pnpm 2>&1 | tail -3
echo "✅ pnpm installed"

echo ""
echo "📥 Step 2: Cloning AMCP protocol..."
git clone --depth 1 https://github.com/fcavalcantirj/amcp-protocol.git /app 2>&1 | tail -3
cd /app
echo "✅ Repository cloned"

echo ""
echo "📦 Step 3: Installing packages..."
pnpm install 2>&1 | tail -5
echo "✅ Packages installed"

echo ""
echo "🏴‍☠️ Step 4: Running full respawn..."
echo "----------------------------------------"
npx tsx scripts/full-respawn.ts
echo "----------------------------------------"

echo ""
echo "✅ Step 5: Verification..."
echo ""
echo "=== SOUL.md (first 30 lines) ==="
head -30 ~/clawd/SOUL.md
echo ""
echo "=== Files restored ==="
echo "Workspace files:"
ls ~/clawd/*.md 2>/dev/null | wc -l
echo "Daily notes:"
ls ~/clawd/memory/*.md 2>/dev/null | wc -l
echo "Research docs:"
ls ~/clawd/research/*.md 2>/dev/null | wc -l

echo ""
echo "=========================================="
echo "🏴‍☠️ RESPAWN TEST COMPLETE"
echo "=========================================="
