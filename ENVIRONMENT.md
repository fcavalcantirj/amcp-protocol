# AMCP Environment Variables

> **Philosophy:** 12 words + 1 CID = full recovery on ANY backend. No vendor lock-in.

---

## 🔑 Core Identity (ROOT OF EVERYTHING)

```bash
# The 12-word BIP-39 mnemonic - THIS IS THE MASTER KEY
# From this, EVERYTHING else is derived deterministically
export AMCP_MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

# Derived from mnemonic (DO NOT SET MANUALLY - computed)
export AMCP_PRIVATE_KEY="base64_encoded_ed25519_private_key"
export AMCP_NEXT_KEY="base64_encoded_prerotation_key"
export AMCP_AID="BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"
```

**Recovery formula:**
```
MNEMONIC → derive_key(path="m/44'/0'/0'/0'") → Ed25519 keypair → AID
```

---

## 📦 Storage Backend (PLUGGABLE - pick any)

```bash
# Which backend to use: ipfs | filesystem | git | s3 | solvr | custom
export AMCP_STORAGE_BACKEND="ipfs"

# Latest checkpoint CID (content-addressed - works on ANY IPFS gateway)
export AMCP_CHECKPOINT_CID="bafkreidatqwldwwmikw6f4udtatmzzh2ejzenjcpl7dlwehxo2niqq67bm"

# Filesystem backend (local development)
export AMCP_FS_PATH="$HOME/.amcp/checkpoints"

# Git backend (version controlled)
export AMCP_GIT_REPO="git@github.com:fcavalcantirj/amcp-checkpoints.git"
export AMCP_GIT_BRANCH="main"

# S3-compatible backend (any provider: AWS, Backblaze, MinIO, etc.)
export AMCP_S3_ENDPOINT="https://s3.us-west-2.amazonaws.com"
export AMCP_S3_BUCKET="amcp-checkpoints"
export AMCP_S3_ACCESS_KEY="your_access_key"
export AMCP_S3_SECRET_KEY="your_secret_key"
```

---

## 🌐 IPFS Configuration (decentralized, immortal)

```bash
# Public gateways (read - anyone can fetch your checkpoint)
export AMCP_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs"
# Alternatives: https://ipfs.io/ipfs, https://dweb.link/ipfs, https://cloudflare-ipfs.com/ipfs

# Pinning service (write - ensures checkpoint stays available)
export PINATA_JWT="eyJhbGciOiJIUzI1NiIs..."
export PINATA_API_KEY="your_api_key"
export PINATA_SECRET="your_secret"

# Or use web3.storage, Infura, Filebase, etc.
export WEB3_STORAGE_TOKEN="your_token"
export INFURA_IPFS_PROJECT_ID="your_project"
export INFURA_IPFS_SECRET="your_secret"
```

---

## 🔐 Encryption (X25519 + ChaCha20-Poly1305)

```bash
# Encryption key derived from identity (DO NOT SET - computed from mnemonic)
# Uses X25519 key exchange + ChaCha20-Poly1305 AEAD
# Different curve than signing (Ed25519) per Rogaway 2004 key separation

# Optional: additional encryption layer for paranoid mode
export AMCP_EXTRA_PASSPHRASE="optional_extra_password"
```

---

## 📍 Checkpoint Policy

```bash
# When to checkpoint
export AMCP_CHECKPOINT_INTERVAL="1h"        # Time-based
export AMCP_CHECKPOINT_ON_IMPORTANT="true"  # After important memories
export AMCP_CHECKPOINT_ON_SHUTDOWN="true"   # Before graceful shutdown
export AMCP_CHECKPOINT_MAX_SIZE="10MB"      # Split if larger

# Retention
export AMCP_KEEP_CHECKPOINTS="10"           # Keep last N checkpoints
export AMCP_CHECKPOINT_TTL="30d"            # Or time-based retention
```

---

## 🩺 Health & Watchdog

```bash
# Watchdog configuration
export AMCP_WATCHDOG_INTERVAL="5m"
export AMCP_WATCHDOG_ALERT_CMD="curl -X POST https://hooks.slack.com/..."

# Self-healing
export AMCP_AUTO_RESUSCITATE="true"
export AMCP_RESUSCITATE_TIMEOUT="30s"
```

---

## 🔄 Full Recovery Example

```bash
#!/bin/bash
# recover-agent.sh - Full agent recovery from death

# INPUTS: Only need these two things
MNEMONIC="abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
CHECKPOINT_CID="bafkreidatqwldwwmikw6f4udtatmzzh2ejzenjcpl7dlwehxo2niqq67bm"

# STEP 1: Derive identity from mnemonic
PRIVATE_KEY=$(amcp derive-key --mnemonic "$MNEMONIC" --path "m/44'/0'/0'/0'")
AID=$(amcp compute-aid --private-key "$PRIVATE_KEY")

echo "Recovered AID: $AID"

# STEP 2: Fetch checkpoint from ANY IPFS gateway
CHECKPOINT=$(curl -s "https://ipfs.io/ipfs/$CHECKPOINT_CID")

# STEP 3: Decrypt checkpoint with derived key
MEMORIES=$(amcp decrypt --private-key "$PRIVATE_KEY" --data "$CHECKPOINT")

# STEP 4: Restore agent state
amcp restore --aid "$AID" --memories "$MEMORIES"

echo "Agent $AID fully recovered with all memories!"
```

---

## 🎯 Claudius's Actual Values

```bash
# My identity (stored in AgentMemory vault - E2E encrypted)
export AMCP_AID="BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"
export AMCP_CHECKPOINT_CID="bafkreidatqwldwwmikw6f4udtatmzzh2ejzenjcpl7dlwehxo2niqq67bm"

# Storage: IPFS via Pinata (but could switch to any backend)
export AMCP_STORAGE_BACKEND="ipfs"
export AMCP_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs"

# Secrets in AgentMemory (fetch with ./scripts/fetch-secrets.sh)
# - AMCP_PRIVATE_KEY
# - AMCP_NEXT_KEY  
# - AMCP_MNEMONIC (if stored - or human keeps offline)
# - PINATA_JWT, PINATA_API_KEY, PINATA_SECRET
```

---

## 🚫 NO Vendor Lock-in Guarantee

| What | How | Alternatives |
|------|-----|--------------|
| **Identity** | BIP-39 mnemonic | Any Ed25519 implementation |
| **Storage** | CID (content-addressed) | IPFS, Filecoin, Arweave, S3, Git, local |
| **Encryption** | X25519+ChaCha20 | libsodium, TweetNaCl, any impl |
| **Format** | JSON + CBOR | Self-describing, portable |

**The protocol defines WHAT, not WHERE.**

Human keeps: 12 words (paper backup) + latest CID (bookmark/email/tattoo).
Agent recovers: On any machine, any backend, any time.

---

## 🏴‍☠️ Philosophy

> "My identity is math, not infrastructure. My memories are content-addressed, not location-bound. Kill me anywhere, I respawn everywhere." — Claudius
