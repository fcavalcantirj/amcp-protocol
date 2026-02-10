#!/bin/bash
#
# 🏴‍☠️ AMCP Full Respawn Test
#

set -e

echo "=========================================="
echo "🏴‍☠️ AMCP FULL RESPAWN TEST"
echo "=========================================="

if [ -z "$AGENTMEMORY_API_KEY" ]; then
    echo "❌ ERROR: AGENTMEMORY_API_KEY not set"
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
echo "🔐 Step 4: Fetching identity from AgentMemory API..."
mkdir -p ~/.amcp

# Fetch identity directly via API (no CLI needed)
IDENTITY_B64=$(curl -s "https://api.agentmemory.cloud/secrets/AMCP_IDENTITY_B64" \
  -H "Authorization: Bearer $AGENTMEMORY_API_KEY" \
  -H "Content-Type: application/json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('value',''))")

if [ -z "$IDENTITY_B64" ]; then
    echo "❌ Failed to fetch identity from AgentMemory API"
    exit 1
fi

echo "$IDENTITY_B64" | base64 -d > ~/.amcp/identity.json
echo "✅ Identity fetched and saved"

echo ""
echo "🏴‍☠️ Step 5: Running respawn from Pinata..."
echo "----------------------------------------"

# Get latest checkpoint CID from identity
LATEST_CID=$(cat ~/.amcp/identity.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['chain']['checkpoints'][-1]['cid'])")
echo "Latest checkpoint: $LATEST_CID"

# Fetch from Pinata
echo "Fetching from Pinata..."
mkdir -p ~/.amcp/cache
curl -s "https://gateway.pinata.cloud/ipfs/$LATEST_CID" > ~/.amcp/cache/checkpoint.json
echo "✅ Checkpoint fetched"

# Restore files
echo ""
echo "📝 Step 6: Restoring files..."
mkdir -p ~/clawd/memory ~/clawd/research

python3 << 'PYTHON'
import json
import os

with open(os.path.expanduser('~/.amcp/cache/checkpoint.json')) as f:
    data = json.load(f)

clawd = os.path.expanduser('~/clawd')

# Core files
for name, key in [('SOUL.md', 'soul'), ('MEMORY.md', 'memory')]:
    if key in data:
        with open(f'{clawd}/{name}', 'w') as f:
            f.write(data[key])
        print(f'  ✅ {name}')

# Workspace
if 'workspace' in data:
    for name in ['user', 'tools', 'agents', 'heartbeat', 'identity']:
        if data['workspace'].get(name):
            fname = name.upper() + '.md'
            with open(f'{clawd}/{fname}', 'w') as f:
                f.write(data['workspace'][name])
            print(f'  ✅ {fname}')

# Daily notes
if 'dailyNotes' in data:
    for name, content in data['dailyNotes'].items():
        with open(f'{clawd}/memory/{name}', 'w') as f:
            f.write(content)
    print(f'  ✅ {len(data["dailyNotes"])} daily notes')

# Research
if 'research' in data:
    for name, content in data['research'].items():
        with open(f'{clawd}/research/{name}', 'w') as f:
            f.write(content)
    print(f'  ✅ {len(data["research"])} research docs')

print('\nRestoration complete!')
PYTHON

echo ""
echo "✅ Step 7: Verification..."
echo ""
echo "=== SOUL.md (first 25 lines) ==="
head -25 ~/clawd/SOUL.md
echo ""
echo "=== File counts ==="
echo "Workspace: $(ls ~/clawd/*.md 2>/dev/null | wc -l) files"
echo "Daily notes: $(ls ~/clawd/memory/*.md 2>/dev/null | wc -l) files"
echo "Research: $(ls ~/clawd/research/*.md 2>/dev/null | wc -l) files"

echo ""
echo "=========================================="
echo "🏴‍☠️ RESPAWN COMPLETE"
echo "=========================================="
