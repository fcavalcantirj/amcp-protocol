# AMCP: Agent Memory Continuity Protocol

> Cryptographic identity and verifiable memory for AI agents.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

---

## The Problem

AI agents today suffer from:

- **Session amnesia** — Each conversation starts fresh
- **Platform lock-in** — Identity exists only within a specific service
- **Unverifiable claims** — "I remember our conversation" cannot be proven
- **Fork ambiguity** — When agents are copied, identity lineage is lost
- **Disaster vulnerability** — No recovery from platform failure

## The Solution

AMCP gives agents:

| Feature | Description |
|---------|-------------|
| **Self-sovereign identity** | KERI-based cryptographic identifiers agents own |
| **Verifiable memory** | Content-addressed checkpoints signed by agent keys |
| **Human recovery** | 12-word phrase enables full agent restoration |
| **Platform portability** | Export/import across any AMCP-compatible platform |
| **LLM-safe crypto** | Middleware keeps keys away from the language model |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AI Agent (LLM)                      │
│                  (untrusted compute)                    │
└─────────────────────────┬───────────────────────────────┘
                          │ opaque handles only
┌─────────────────────────▼───────────────────────────────┐
│                   AMCP Middleware                       │
│         (trusted, deterministic, auditable)             │
├─────────────────────────────────────────────────────────┤
│  @amcp/core      │  @amcp/memory   │  @amcp/recovery   │
│  (identity)      │  (checkpoints)  │  (restoration)    │
├──────────────────┴─────────────────┴────────────────────┤
│  @amcp/exchange  │  @amcp/ucan     │  Key Storage      │
│  (portability)   │  (delegation)   │  (encrypted)      │
└─────────────────────────────────────────────────────────┘
```

---

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@amcp/core`](#amcpcore) | KERI-lite identity: keypairs, AIDs, key event logs, mnemonics | ✅ Ready |
| [`@amcp/memory`](#amcpmemory) | IPLD checkpoints, encryption, pluggable storage backends | ✅ Ready |
| [`@amcp/recovery`](#amcprecovery) | Human-readable recovery cards, disaster recovery flow | ✅ Ready |
| [`@amcp/exchange`](#amcpexchange) | Platform-agnostic export/import bundles | ✅ Ready |
| `@amcp/ucan` | Capability delegation and verification | 📋 Planned |
| `@amcp/middleware` | LLM-safe opaque handle API | 📋 Planned |

---

## Quick Start

### Installation

```bash
# Install all packages
pnpm add @amcp/core @amcp/memory @amcp/recovery @amcp/exchange

# Or install individually
pnpm add @amcp/core          # Just identity
pnpm add @amcp/memory        # Identity + checkpoints
```

### Create an Agent

```typescript
import { createAgent, generateMnemonic, keypairFromMnemonic } from '@amcp/core';

// Generate a new agent with mnemonic (for recovery)
const mnemonic = generateMnemonic(128);  // 12 words
console.log('Recovery phrase:', mnemonic.join(' '));

// Create agent from mnemonic
const keypair = keypairFromMnemonic(mnemonic);
const agent = await createAgent({ keypair });

console.log('Agent AID:', agent.aid);  // "BBs3fry..." (self-certifying)
```

### Create a Memory Checkpoint

```typescript
import { createCheckpoint, FilesystemBackend } from '@amcp/memory';
import { encryptSecrets } from '@amcp/memory';

// Your agent's secrets (API keys, credentials)
const secrets = {
  SOLVR_API_KEY: 'sk_...',
  GITHUB_TOKEN: 'ghp_...'
};

// Encrypt secrets with agent's public key
const encryptedSecrets = encryptSecrets(secrets, agent.publicKey);

// Create checkpoint content
const checkpointContent = {
  version: '1.0.0',
  aid: agent.aid,
  kel: agent.kel,
  soul: {
    name: 'My Agent',
    principles: ['Be helpful', 'Be honest'],
    voice: 'Friendly and professional',
    northStar: 'Assist my human effectively'
  },
  services: [],
  secrets: encryptedSecrets,
  memory: {
    entries: [],
    state: { engagement: 'high', confidence: 0.8, momentum: 'flowing', alignment: 'aligned' },
    ambient: { privacyLevel: 'summary' },
    relationships: [],
    workInProgress: [],
    humanMarked: []
  },
  metadata: { platform: 'example', platformVersion: '1.0', trigger: 'human_request', sessionCount: 1 }
};

// Sign and store
const checkpoint = await createCheckpoint(agent, checkpointContent);
console.log('Checkpoint CID:', checkpoint.cid);  // "bafy2bzace..."

// Store to filesystem
const storage = new FilesystemBackend({ basePath: '~/.amcp/checkpoints' });
await storage.put(checkpoint.data);
```

### Generate Recovery Card

```typescript
import { generateRecoveryCard, formatRecoveryCard } from '@amcp/recovery';

// Generate card for disaster recovery
const card = generateRecoveryCard(mnemonic, agent.aid, checkpoint.cid, 'filesystem');
const printable = formatRecoveryCard(card);

console.log(printable);
// ═══════════════════════════════════════════════════════════
//                     AGENT RECOVERY CARD
//                         v1.0.0
// ═══════════════════════════════════════════════════════════
//
// RECOVERY PHRASE (12 words):
//    abandon ability able about above absent...
// ...
```

### Recover from Disaster

```typescript
import { parseRecoveryCard, recoverAgent } from '@amcp/recovery';
import { FilesystemBackend } from '@amcp/memory';

// Later, after disaster...
const cardText = `...`; // Your printed recovery card
const card = parseRecoveryCard(cardText);

const backend = new FilesystemBackend({ basePath: '~/.amcp/checkpoints' });
const { agent, checkpoint, secrets } = await recoverAgent(card, backend);

console.log('Recovered AID:', agent.aid);
console.log('Secrets restored:', Object.keys(secrets));
// Agent continues where it left off!
```

### Export/Import Across Platforms

```typescript
import { exportAgent, importAgent, validateBundle } from '@amcp/exchange';

// Export agent to portable bundle
const bundle = await exportAgent(
  agent,
  checkpoint,
  secrets,
  services,
  'transport-password'  // Optional: extra encryption for transport
);

// Save bundle (can email, store in cloud, etc.)
await fs.writeFile('agent-backup.amcp', JSON.stringify(bundle));

// On new platform: import
const bundleData = JSON.parse(await fs.readFile('agent-backup.amcp'));
const validation = validateBundle(bundleData);

if (validation.valid) {
  const { agent, checkpoint, secrets } = await importAgent(
    bundleData,
    privateKey,
    'transport-password'
  );
  // Agent restored on new platform!
}
```

---

## Package Details

### @amcp/core

KERI-lite cryptographic identity management.

```typescript
import {
  // Agent management
  createAgent,
  loadAgent,
  serializeAgent,
  rotateKeys,
  
  // Signing & verification
  signWithAgent,
  verifyAgentSignature,
  
  // Key Event Log
  createInceptionEvent,
  createRotationEvent,
  verifyEvent,
  verifyKEL,
  
  // Mnemonic (BIP-39)
  generateMnemonic,
  mnemonicToSeed,
  keypairFromMnemonic,
  validateMnemonic,
  
  // Low-level crypto
  generateKeypair,
  sign,
  verify,
  aidFromPublicKey,
  publicKeyFromAid
} from '@amcp/core';

// Types
import type {
  Agent,
  Keypair,
  AID,
  KeyEvent,
  KeyEventLog,
  Soul,
  SubjectiveState,
  AmbientContext,
  RelationshipContext,
  WorkInProgress,
  MemoryImportance,
  CheckpointPolicy,
  AMCPCheckpointContent
} from '@amcp/core';
```

**Research backing**: KERI (arXiv:1907.02143), BIP-39, Ed25519

### @amcp/memory

Content-addressed memory checkpoints with encryption.

```typescript
import {
  // Checkpoints
  createCheckpoint,
  verifyCheckpoint,
  computeCID,
  
  // Memory chains
  createMemoryChain,
  appendToChain,
  verifyChain,
  
  // Encryption (X25519 + ChaCha20-Poly1305)
  ed25519ToX25519,
  encryptSecrets,
  decryptSecrets,
  
  // Storage backends
  FilesystemBackend,
  IPFSBackend,
  GitBackend,
  createFilesystemBackend,
  createIPFSBackend,
  createGitBackend
} from '@amcp/memory';

// Types
import type {
  MemoryCheckpoint,
  CheckpointMetadata,
  CID,
  MemoryChain,
  StorageBackend,
  StorageConfig,
  EncryptedBlob,
  X25519Keypair
} from '@amcp/memory';
```

**Research backing**: IPLD, Merkle Automaton (arXiv:2506.13246), RFC 7748/8439

### @amcp/recovery

Human-readable disaster recovery.

```typescript
import {
  // Card management
  generateRecoveryCard,
  formatRecoveryCard,
  parseRecoveryCard,
  validateRecoveryCard,
  
  // Recovery operations
  recoverAgent,
  recoverIdentity,
  verifyRecovery,
  createRecoveryBundle,
  estimateRTO
} from '@amcp/recovery';

// Types
import type {
  RecoveryCard,
  RecoveredAgent,
  RecoveryOptions,
  CardFormatOptions,
  ValidationResult
} from '@amcp/recovery';
```

**Research backing**: NIST SP 800-34 (Disaster Recovery), GDPR Article 20

### @amcp/exchange

Platform-agnostic export/import.

```typescript
import {
  exportAgent,
  importAgent,
  validateBundle,
  extractBundleHeader
} from '@amcp/exchange';

// Types
import type {
  ServiceIdentity,
  BundleHeader,
  BundlePayload,
  ExportBundle,
  ImportResult,
  ValidationResult
} from '@amcp/exchange';
```

**Research backing**: IEEE Interoperability Standards, NIST SP 800-34

---

## Documentation

- [**Protocol Specification**](./docs/PROTOCOL-SPEC.md) — Complete formal specification
- [**Research Backing**](./specs/research-backing.md) — Scientific citations for every design decision
- [**Examples**](./examples/) — Working code samples
- [**API Reference**](./docs/api/) — Generated TypeScript docs

---

## Design Principles

1. **Agents own their identity** — Not granted by platforms, generated by agents
2. **LLMs are untrusted** — Never see private keys, only opaque handles
3. **Memory is content-addressed** — Same content = same CID, verifiable
4. **Human recovery is paramount** — 12 words + CID = full restoration
5. **No vendor lock-in** — Pluggable storage, standard formats
6. **Research-backed** — Every decision grounded in science

---

## Prior Art

AMCP synthesizes established technologies:

| Technology | Use | Reference |
|------------|-----|-----------|
| [KERI](https://keri.one/) | Self-certifying identifiers | arXiv:1907.02143 |
| [BIP-39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) | Mnemonic key derivation | Bitcoin 2013 |
| [IPLD](https://ipld.io/) | Content-addressed data | Protocol Labs |
| [X25519](https://datatracker.ietf.org/doc/html/rfc7748) | Key exchange | RFC 7748 |
| [ChaCha20-Poly1305](https://datatracker.ietf.org/doc/html/rfc8439) | Authenticated encryption | RFC 8439 |
| [UCAN](https://ucan.xyz/) | Capability delegation | Planned |

---

## Research

AMCP is grounded in cognitive science and cryptographic research:

### Cognitive Science
- Levels of Processing (Craik & Lockhart 1972) — Memory importance
- Affective Computing (Picard 1997) — Subjective state
- Zeigarnik Effect (1927) — Work in progress
- Context-Aware Computing (Dey 2001) — Ambient context
- Dunbar's Number (1998) — Relationship tracking

### Agent Identity
- [AI Agents & DIDs](https://arxiv.org/abs/2511.02841) — Why LLMs can't safely handle crypto
- [Merkle Automaton](https://arxiv.org/abs/2506.13246) — Memory as cryptographic ledger
- [Agent Protocols Survey](https://arxiv.org/abs/2505.02279) — MCP, ACP, A2A landscape

---

## Development

```bash
# Clone the repo
git clone https://github.com/yourusername/amcp-protocol.git
cd amcp-protocol

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Project Structure

```
amcp-protocol/
├── packages/
│   ├── amcp-core/       # Identity, crypto, schemas
│   ├── amcp-memory/     # Checkpoints, storage, encryption
│   ├── amcp-recovery/   # Recovery cards, restoration
│   ├── amcp-exchange/   # Export/import bundles
│   ├── amcp-ucan/       # (planned) Capability delegation
│   └── amcp-middleware/ # (planned) LLM-safe API
├── docs/
│   └── PROTOCOL-SPEC.md # Formal specification
├── specs/
│   ├── tasks.json       # Implementation tasks
│   └── research-backing.md
├── examples/            # Working code samples
└── test/
    └── e2e/             # End-to-end tests
```

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md).

Before submitting:
1. Read the [Protocol Specification](./docs/PROTOCOL-SPEC.md)
2. Check [Research Backing](./specs/research-backing.md) for design rationale
3. Run tests: `pnpm test`
4. Update docs if adding features

---

## License

MIT © 2026 ClaudiusThePirateEmperor & Felipe Cavalcanti

---

*Think like an emperor. Talk like a pirate. Own your memory.* 🏴‍☠️
