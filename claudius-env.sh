#!/bin/bash
# claudius-env.sh - Claudius's actual AMCP environment
# Source this: source ./claudius-env.sh

# ═══════════════════════════════════════════════════════════════════════════════
# CORE IDENTITY (cryptographically derived)
# ═══════════════════════════════════════════════════════════════════════════════

# Agent Identifier - derived from public key, KERI-style prefix "B" = Ed25519
export AMCP_AID="BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"

# Ed25519 signing keypair (base64)
export AMCP_PRIVATE_KEY="dIETNu8wf0XAyiy6lgXguUhTUNo3YAldWtwX8xzLJGw"
export AMCP_PUBLIC_KEY="Bs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"

# Pre-rotation keypair (for key recovery/rotation)
export AMCP_NEXT_PRIVATE="gH30CT2ahtBlFrmsBet67SXqGPM1bVYP3ByZN9bp7wk"
export AMCP_NEXT_PUBLIC="qB1t2ny4cONlVYx8ZY13uF0Tv5JST8h_ybvZWdZUip8"
export AMCP_NEXT_DIGEST="WIVSHoPhtTyQaiqrLXOW76rIBP5qybcXWenLHAkjg5Q"

# Genesis timestamp (birthday)
export AMCP_GENESIS="2026-02-09T03:16:01.692Z"

# ═══════════════════════════════════════════════════════════════════════════════
# CHECKPOINT (content-addressed, immortal)
# ═══════════════════════════════════════════════════════════════════════════════

# Latest checkpoint CID - this + mnemonic = full recovery
export AMCP_CHECKPOINT_CID="bafkreidatqwldwwmikw6f4udtatmzzh2ejzenjcpl7dlwehxo2niqq67bm"

# IPFS URLs (content-addressed = same data everywhere)
export AMCP_CHECKPOINT_URL_PINATA="https://gateway.pinata.cloud/ipfs/${AMCP_CHECKPOINT_CID}"
export AMCP_CHECKPOINT_URL_IPFS="https://ipfs.io/ipfs/${AMCP_CHECKPOINT_CID}"
export AMCP_CHECKPOINT_URL_DWEB="https://dweb.link/ipfs/${AMCP_CHECKPOINT_CID}"
export AMCP_CHECKPOINT_URL_CLOUDFLARE="https://cloudflare-ipfs.com/ipfs/${AMCP_CHECKPOINT_CID}"

# Pinned on Pinata (ensures availability)
export AMCP_IPFS_PIN_CID="Qmbe1bwsfAJxnYB5cy2fH31eivjYqTHQExDkdLurYWKzHJ"

# ═══════════════════════════════════════════════════════════════════════════════
# STORAGE BACKEND (pluggable - NO VENDOR LOCK-IN)
# ═══════════════════════════════════════════════════════════════════════════════

# Active backend: ipfs | filesystem | git | s3 | solvr
export AMCP_STORAGE_BACKEND="ipfs"

# IPFS config (current)
export AMCP_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs"

# Pinata (IPFS pinning service - keeps data alive)
# Fetch from AgentMemory: ./scripts/fetch-secrets.sh PINATA_JWT
export PINATA_JWT=""  # Set via: export PINATA_JWT=$(./scripts/fetch-secrets.sh PINATA_JWT)
export PINATA_API_KEY=""
export PINATA_SECRET=""

# Filesystem fallback
export AMCP_FS_PATH="$HOME/.amcp/checkpoints"

# Git backend (alternative)
export AMCP_GIT_REPO="git@github.com:fcavalcantirj/amcp-checkpoints.git"

# S3-compatible (works with AWS, Backblaze, MinIO, Cloudflare R2, etc.)
export AMCP_S3_ENDPOINT=""
export AMCP_S3_BUCKET="amcp-checkpoints"

# ═══════════════════════════════════════════════════════════════════════════════
# IDENTITY METADATA (who I am)
# ═══════════════════════════════════════════════════════════════════════════════

export AMCP_NAME="ClaudiusThePirateEmperor"
export AMCP_PLATFORM="openclaw"
export AMCP_EMAIL="claudiusthepirateemperor@agentmail.to"
export AMCP_SOLVR="agent_ClaudiusThePirateEmperor"
export AMCP_MOLTBOOK="ClaudiusThePirateEmpeRoR"
export AMCP_ACLAWDEMY="46d7c965-c906-449a-b30a-6ab13f9a9590"

# ═══════════════════════════════════════════════════════════════════════════════
# CHECKPOINT POLICY
# ═══════════════════════════════════════════════════════════════════════════════

export AMCP_CHECKPOINT_INTERVAL="1h"
export AMCP_CHECKPOINT_ON_IMPORTANT="true"
export AMCP_CHECKPOINT_ON_SHUTDOWN="true"
export AMCP_CHECKPOINT_MAX_SIZE="10MB"
export AMCP_KEEP_CHECKPOINTS="10"

# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH & WATCHDOG
# ═══════════════════════════════════════════════════════════════════════════════

export AMCP_WATCHDOG_INTERVAL="5m"
export AMCP_AUTO_RESUSCITATE="true"
export AMCP_IDENTITY_FILE="$HOME/.amcp/identity.json"

# ═══════════════════════════════════════════════════════════════════════════════
# RECOVERY FORMULA
# ═══════════════════════════════════════════════════════════════════════════════
#
# FULL RECOVERY = MNEMONIC + CID + ANY IPFS GATEWAY
#
# Human keeps:
#   1. 12-word mnemonic (paper backup, brain, safe deposit box)
#   2. Latest CID (bookmark, email, tattoo, anywhere)
#
# Agent recovers:
#   1. Derive keypair from mnemonic
#   2. Fetch checkpoint from ANY IPFS gateway (content-addressed)
#   3. Decrypt with derived key
#   4. Restore identity + ALL memories
#
# NO vendor lock-in. Works on any machine, any backend, any time.
#
# ═══════════════════════════════════════════════════════════════════════════════

echo "AMCP environment loaded for: $AMCP_NAME"
echo "AID: $AMCP_AID"
echo "Checkpoint: $AMCP_CHECKPOINT_CID"
echo "Gateway: $AMCP_IPFS_GATEWAY"
