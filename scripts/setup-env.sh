#!/bin/bash
# setup-env.sh - Generate and configure AMCP environment
# Usage: source ./scripts/setup-env.sh [new|restore MNEMONIC CID]

set -e

AMCP_DIR="$HOME/.amcp"
ENV_FILE="$AMCP_DIR/env"
IDENTITY_FILE="$AMCP_DIR/identity.json"

mkdir -p "$AMCP_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[AMCP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Generate BIP-39 mnemonic (12 words = 128 bits entropy)
generate_mnemonic() {
    # Use OpenSSL for entropy, then map to BIP-39 wordlist
    # For production, use a proper BIP-39 library
    node -e "
const crypto = require('crypto');
const words = require('bip39').generateMnemonic(128);
console.log(words);
" 2>/dev/null || {
        # Fallback: use our TypeScript implementation
        npx tsx -e "
import { generateMnemonic } from '@amcp/recovery';
console.log(generateMnemonic());
"
    }
}

# Derive Ed25519 keypair from mnemonic
derive_keypair() {
    local mnemonic="$1"
    npx tsx -e "
import { mnemonicToKeypair } from '@amcp/recovery';
const keypair = mnemonicToKeypair('$mnemonic');
console.log(JSON.stringify({
    privateKey: Buffer.from(keypair.secretKey).toString('base64'),
    publicKey: Buffer.from(keypair.publicKey).toString('base64')
}));
"
}

# Compute AID from public key
compute_aid() {
    local public_key="$1"
    npx tsx -e "
import { computeAID } from '@amcp/core';
const publicKey = Buffer.from('$public_key', 'base64');
console.log(computeAID(publicKey));
"
}

# Generate pre-rotation key
generate_next_key() {
    npx tsx -e "
import { generateKeyPair } from '@amcp/core';
const keypair = generateKeyPair();
console.log(Buffer.from(keypair.secretKey).toString('base64'));
"
}

case "${1:-new}" in
    new)
        log "Generating new AMCP identity..."
        
        # Generate mnemonic
        MNEMONIC=$(generate_mnemonic)
        log "Generated 12-word mnemonic (SAVE THIS!):"
        echo ""
        echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║${NC}  $MNEMONIC  ${YELLOW}║${NC}"
        echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        warn "Write this down on PAPER. This is your recovery phrase."
        warn "Anyone with these words can recover your identity."
        echo ""
        
        # Derive keypair
        KEYPAIR=$(derive_keypair "$MNEMONIC")
        PRIVATE_KEY=$(echo "$KEYPAIR" | jq -r '.privateKey')
        PUBLIC_KEY=$(echo "$KEYPAIR" | jq -r '.publicKey')
        
        # Compute AID
        AID=$(compute_aid "$PUBLIC_KEY")
        log "Generated AID: $AID"
        
        # Generate pre-rotation key
        NEXT_KEY=$(generate_next_key)
        log "Generated pre-rotation key"
        
        # Save identity file
        cat > "$IDENTITY_FILE" << EOF
{
    "aid": "$AID",
    "publicKey": "$PUBLIC_KEY",
    "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "genesis": true
}
EOF
        log "Saved identity to $IDENTITY_FILE"
        
        # Save env file (secrets)
        cat > "$ENV_FILE" << EOF
# AMCP Environment - Generated $(date -u +%Y-%m-%dT%H:%M:%SZ)
# KEEP THIS FILE SECURE!

# Core Identity
export AMCP_AID="$AID"
export AMCP_PRIVATE_KEY="$PRIVATE_KEY"
export AMCP_NEXT_KEY="$NEXT_KEY"
# AMCP_MNEMONIC intentionally NOT stored (human keeps offline)

# Storage Backend (pluggable - no vendor lock-in)
export AMCP_STORAGE_BACKEND="ipfs"
export AMCP_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs"
export AMCP_FS_PATH="$AMCP_DIR/checkpoints"

# Checkpoint tracking
export AMCP_CHECKPOINT_CID=""
export AMCP_CHECKPOINT_INTERVAL="1h"

# Health
export AMCP_WATCHDOG_INTERVAL="5m"
export AMCP_AUTO_RESUSCITATE="true"
EOF
        chmod 600 "$ENV_FILE"
        log "Saved secrets to $ENV_FILE (mode 600)"
        
        # Source the env
        source "$ENV_FILE"
        
        log "Identity ready! AID: $AMCP_AID"
        echo ""
        echo "Next steps:"
        echo "  1. Write down your mnemonic on paper"
        echo "  2. Store AMCP_PRIVATE_KEY in AgentMemory: agentmemory secret set AMCP_PRIVATE_KEY \"\$AMCP_PRIVATE_KEY\""
        echo "  3. Create first checkpoint: amcp checkpoint create"
        echo "  4. Save the checkpoint CID somewhere safe"
        ;;
        
    restore)
        if [ -z "$2" ] || [ -z "$3" ]; then
            error "Usage: source setup-env.sh restore \"your twelve word mnemonic phrase here\" CID"
        fi
        
        MNEMONIC="$2"
        CHECKPOINT_CID="$3"
        
        log "Recovering agent from mnemonic + checkpoint..."
        
        # Derive keypair from mnemonic
        KEYPAIR=$(derive_keypair "$MNEMONIC")
        PRIVATE_KEY=$(echo "$KEYPAIR" | jq -r '.privateKey')
        PUBLIC_KEY=$(echo "$KEYPAIR" | jq -r '.publicKey')
        
        # Compute AID
        AID=$(compute_aid "$PUBLIC_KEY")
        log "Recovered AID: $AID"
        
        # Fetch checkpoint from IPFS
        log "Fetching checkpoint from IPFS..."
        CHECKPOINT_URL="https://ipfs.io/ipfs/$CHECKPOINT_CID"
        CHECKPOINT_DATA=$(curl -s "$CHECKPOINT_URL")
        
        if [ -z "$CHECKPOINT_DATA" ]; then
            # Try Pinata gateway
            CHECKPOINT_URL="https://gateway.pinata.cloud/ipfs/$CHECKPOINT_CID"
            CHECKPOINT_DATA=$(curl -s "$CHECKPOINT_URL")
        fi
        
        if [ -z "$CHECKPOINT_DATA" ]; then
            error "Failed to fetch checkpoint from any gateway"
        fi
        
        log "Checkpoint fetched ($(echo "$CHECKPOINT_DATA" | wc -c) bytes)"
        
        # Decrypt and restore
        log "Decrypting checkpoint..."
        npx tsx -e "
import { recoverAgent } from '@amcp/recovery';
import { restoreFromCheckpoint } from '@amcp/memory';

const checkpoint = JSON.parse('$CHECKPOINT_DATA');
const mnemonic = '$MNEMONIC';

const agent = recoverAgent(mnemonic, checkpoint);
console.log('Recovered agent:', agent.aid);
console.log('Memories:', agent.memories?.length || 0);
console.log('Soul posts:', agent.soulPosts?.length || 0);
"
        
        # Generate new pre-rotation key for this incarnation
        NEXT_KEY=$(generate_next_key)
        
        # Save recovered identity
        cat > "$IDENTITY_FILE" << EOF
{
    "aid": "$AID",
    "publicKey": "$PUBLIC_KEY",
    "recoveredAt": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
    "recoveredFrom": "$CHECKPOINT_CID",
    "genesis": false
}
EOF
        
        # Save env
        cat > "$ENV_FILE" << EOF
# AMCP Environment - Recovered $(date -u +%Y-%m-%dT%H:%M:%SZ)

export AMCP_AID="$AID"
export AMCP_PRIVATE_KEY="$PRIVATE_KEY"
export AMCP_NEXT_KEY="$NEXT_KEY"
export AMCP_CHECKPOINT_CID="$CHECKPOINT_CID"
export AMCP_STORAGE_BACKEND="ipfs"
export AMCP_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs"
export AMCP_FS_PATH="$AMCP_DIR/checkpoints"
EOF
        chmod 600 "$ENV_FILE"
        
        source "$ENV_FILE"
        
        log "Agent recovered! AID: $AMCP_AID"
        log "Memories and identity restored from checkpoint: $CHECKPOINT_CID"
        ;;
        
    show)
        if [ -f "$ENV_FILE" ]; then
            cat "$ENV_FILE"
        else
            error "No env file found. Run: source setup-env.sh new"
        fi
        ;;
        
    *)
        echo "Usage: source setup-env.sh [new|restore MNEMONIC CID|show]"
        echo ""
        echo "Commands:"
        echo "  new                      Generate new identity"
        echo "  restore MNEMONIC CID     Recover from mnemonic + checkpoint"
        echo "  show                     Display current env"
        ;;
esac
