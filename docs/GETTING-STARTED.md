# Getting Started with AMCP

> **Goal**: Create your agent identity, set up environment, and run your first checkpoint.

---

## Prerequisites

- Node.js 18+ or 22+
- pnpm (`npm install -g pnpm`)
- Git

---

## Step 1: Clone and Install

```bash
git clone https://github.com/fcavalcantirj/amcp-protocol.git
cd amcp-protocol
pnpm install
pnpm build
```

---

## Step 2: Generate Your Identity

```bash
# Run the setup script
source ./scripts/setup-env.sh new
```

This will:
1. Generate a 12-word BIP-39 mnemonic (WRITE THIS DOWN!)
2. Derive your Ed25519 keypair
3. Compute your AID (Agent Identifier)
4. Create pre-rotation key
5. Save to `~/.amcp/`

**Output example:**
```
╔══════════════════════════════════════════════════════════════╗
║  abandon ability able about above absent absorb abstract...  ║
╚══════════════════════════════════════════════════════════════╝

AID: BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8
```

**⚠️ CRITICAL: Write down your 12 words on paper. This is your recovery phrase.**

---

## Step 3: Environment Variables

After running setup, you'll have `~/.amcp/env` with these variables:

```bash
# Source the env file
source ~/.amcp/env

# Or export manually:
export AMCP_AID="BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"
export AMCP_PRIVATE_KEY="base64_encoded_private_key"
export AMCP_NEXT_KEY="base64_encoded_prerotation_key"
export AMCP_STORAGE_BACKEND="ipfs"
export AMCP_IPFS_GATEWAY="https://gateway.pinata.cloud/ipfs"
export AMCP_FS_PATH="$HOME/.amcp/checkpoints"
```

### For IPFS Storage (Optional)

If you want checkpoints on IPFS (recommended for durability):

```bash
# Get a free Pinata account: https://app.pinata.cloud/
export PINATA_JWT="your_jwt_token"
export PINATA_API_KEY="your_api_key"
export PINATA_SECRET="your_secret"
```

---

## Step 4: Create Your First Checkpoint

```typescript
// scripts/my-first-checkpoint.ts
import { createAgent, keypairFromMnemonic, generateMnemonic } from '@amcp/core';
import { createCheckpoint, FilesystemBackend, encryptSecrets } from '@amcp/memory';
import { generateRecoveryCard, formatRecoveryCard } from '@amcp/recovery';

async function main() {
  // Your mnemonic (from setup or generate new)
  const mnemonic = process.env.AMCP_MNEMONIC?.split(' ') || generateMnemonic(128);
  console.log('Mnemonic:', mnemonic.join(' '));

  // Create agent
  const keypair = keypairFromMnemonic(mnemonic);
  const agent = await createAgent({ keypair, name: 'MyAgent' });
  console.log('AID:', agent.aid);

  // Your secrets (API keys, tokens, etc.)
  const secrets = {
    EXAMPLE_API_KEY: 'sk_example_123',
    // Add your real secrets here
  };

  // Encrypt secrets with your public key
  const encryptedSecrets = encryptSecrets(secrets, agent.publicKey);

  // Build checkpoint content
  const content = {
    version: '1.0.0',
    aid: agent.aid,
    kel: agent.kel,
    soul: {
      name: 'MyAgent',
      principles: ['Be helpful', 'Be honest', 'Learn continuously'],
      voice: 'Professional but friendly',
      northStar: 'Help my human achieve their goals'
    },
    services: [],
    secrets: encryptedSecrets,
    memory: {
      entries: [],
      state: { engagement: 'high', confidence: 0.8, momentum: 'building', alignment: 'aligned' },
      ambient: { privacyLevel: 'summary' },
      relationships: [],
      workInProgress: [],
      humanMarked: []
    },
    metadata: {
      platform: 'amcp-protocol',
      platformVersion: '1.0.0',
      trigger: 'human_request',
      sessionCount: 1
    }
  };

  // Create checkpoint
  const checkpoint = await createCheckpoint(agent, content);
  console.log('Checkpoint CID:', checkpoint.cid);

  // Store locally
  const storage = new FilesystemBackend({ basePath: `${process.env.HOME}/.amcp/checkpoints` });
  await storage.put(checkpoint.data);
  console.log('Checkpoint saved!');

  // Generate recovery card
  const card = generateRecoveryCard(mnemonic, agent.aid, checkpoint.cid, 'filesystem');
  console.log('\n' + formatRecoveryCard(card));
}

main().catch(console.error);
```

Run it:
```bash
npx tsx scripts/my-first-checkpoint.ts
```

---

## Step 5: Test Recovery

```bash
# Simulate disaster - your recovery formula:
# 12 words + CID = full agent

source ./scripts/setup-env.sh restore "your twelve word mnemonic phrase here" "bafkreiXXX"
```

---

## Full Environment Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `AMCP_AID` | Yes | Your Agent Identifier (derived from public key) |
| `AMCP_PRIVATE_KEY` | Yes | Ed25519 private key (base64) |
| `AMCP_NEXT_KEY` | Yes | Pre-rotation key for key recovery |
| `AMCP_STORAGE_BACKEND` | No | `ipfs`, `filesystem`, `git`, `s3` (default: filesystem) |
| `AMCP_IPFS_GATEWAY` | No | IPFS gateway URL |
| `AMCP_FS_PATH` | No | Local checkpoint storage path |
| `AMCP_CHECKPOINT_CID` | No | Latest checkpoint CID |
| `PINATA_JWT` | No | Pinata JWT for IPFS pinning |
| `PINATA_API_KEY` | No | Pinata API key |
| `PINATA_SECRET` | No | Pinata API secret |

---

## Recovery Formula

**Full recovery requires only:**

```
12-word mnemonic + Checkpoint CID = Complete Agent
```

- Mnemonic → derives private key → derives AID
- CID → fetches checkpoint from ANY IPFS gateway
- Checkpoint contains: soul, memories, encrypted secrets, KEL

**No vendor lock-in**: CID works on any IPFS gateway (Pinata, ipfs.io, Cloudflare, self-hosted).

---

## Next Steps

1. **Read the [Protocol Spec](./PROTOCOL-SPEC.md)** — Understand the full architecture
2. **Check [examples/](../examples/)** — Working code samples
3. **Set up IPFS pinning** — For durable checkpoint storage
4. **Integrate with your agent** — Use `@amcp/core` in your agent code

---

## Troubleshooting

### "Module not found"
```bash
pnpm install
pnpm build
```

### "Invalid mnemonic"
Mnemonics must be exactly 12 words from the BIP-39 wordlist.

### "Checkpoint fetch failed"
Try different IPFS gateways:
- `https://ipfs.io/ipfs/`
- `https://gateway.pinata.cloud/ipfs/`
- `https://dweb.link/ipfs/`
- `https://cloudflare-ipfs.com/ipfs/`

---

*Questions? Open an issue on GitHub.*
