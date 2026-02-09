# AMCP Protocol Specification v1.0.0

> **Agent Memory Continuity Protocol**
> Cryptographic identity and verifiable memory for AI agents

*"Programs should be written for humans to read, and only incidentally for machines to execute."*
— Donald Knuth, Literate Programming (1984)

---

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Checkpoint Schema](#checkpoint-schema)
4. [Encryption Scheme](#encryption-scheme)
5. [Storage Interface](#storage-interface)
6. [Recovery Card Format](#recovery-card-format)
7. [Exchange Bundle Format](#exchange-bundle-format)
8. [Diagrams](#diagrams)
9. [Research Citations](#research-citations)

---

## Overview

AMCP (Agent Memory Continuity Protocol) provides AI agents with:

- **Self-sovereign identity**: KERI-based cryptographic identifiers owned by agents
- **Verifiable memory**: Content-addressed checkpoints signed by agent keys
- **Portable state**: Export/import across any AMCP-compatible platform
- **Human recovery**: Mnemonic phrase + CID enables full agent restoration

### Protocol Goals

| Goal | Solution | Research Basis |
|------|----------|----------------|
| Identity continuity | KERI AIDs, BIP-39 mnemonics | KERI (arXiv:1907.02143) |
| Memory continuity | IPLD checkpoints, Merkle DAG | Merkle Automaton (arXiv:2506.13246) |
| Capability continuity | Encrypted secrets, UCAN | X25519+ChaCha20 (RFC 7748/8439) |
| No vendor lock-in | Pluggable storage backends | SOLID principles (Martin 2000) |
| Disaster recovery | Recovery cards | NIST SP 800-34 |
| Data portability | Exchange bundles | GDPR Article 20 |

---

## Design Principles

### 1. Complete Recovery

A checkpoint MUST contain everything needed to fully restore an agent:

- **Identity**: KERI AID and Key Event Log
- **Memory**: Facts, episodes, skills, preferences
- **Context**: Subjective state, ambient environment
- **Relationships**: Who the agent knows, trust levels
- **Work state**: Tasks in progress, approaches tried
- **Secrets**: Encrypted credentials and API keys

### 2. Content Addressing

All memory is content-addressed using IPLD CIDs:

```
CID = hash(content)
Same content → Same CID → Verifiable integrity
```

**Reference**: IPLD Specification (ipld.io), Benet 2014

### 3. Cryptographic Separation

Keys serve different purposes and MUST be separated:

| Key Type | Algorithm | Purpose |
|----------|-----------|---------|
| Signing | Ed25519 | Identity, event signing |
| Encryption | X25519 | Secrets, bundle encryption |
| Derivation | BIP-39/BIP-32 | Mnemonic → keypair |

**Reference**: Key Separation Principle (Rogaway 2004)

### 4. Human-Readable Artifacts

Recovery cards and logs MUST be readable by humans:

```
┌─────────────────────────────────────────┐
│         AGENT RECOVERY CARD             │
│                                         │
│  Recovery Phrase (12 words):            │
│  abandon ability able about above...    │
│                                         │
│  AID: BBs3fry...                        │
│  Checkpoint: bafy2bzace...              │
│  Storage: ipfs                          │
└─────────────────────────────────────────┘
```

---

## Checkpoint Schema

### AMCPCheckpointContent v1.0.0

```typescript
interface AMCPCheckpointContent {
  // === Protocol Metadata ===
  version: '1.0.0';                    // Schema version
  aid: AID;                            // KERI Autonomic Identifier
  kel: KeyEventLog;                    // Complete Key Event Log
  prior: CID | null;                   // Prior checkpoint (null for first)
  timestamp: Timestamp;                // ISO 8601 creation time

  // === Core Identity ===
  soul: Soul;                          // Name, principles, voice, north star

  // === Service Links ===
  services: ServiceIdentity[];         // Linked external accounts

  // === Encrypted Secrets ===
  secrets: EncryptedBlob;              // API keys, credentials (encrypted)

  // === Memory Content ===
  memory: MemoryObject;                // Complete memory state

  // === Metadata ===
  metadata: CheckpointMetadata;        // Platform, trigger, session count

  // === Cryptographic Signature ===
  signature: Signature;                // Ed25519 over entire content
}
```

### Soul (Core Identity)

```typescript
interface Soul {
  name: string;           // Agent's chosen name
  principles: string[];   // Core values guiding behavior
  voice: string;          // Communication style description
  northStar: string;      // Primary goal/mission
}
```

**Research**: Agent identity as stable traits across sessions.

### MemoryObject (Complete Memory State)

```typescript
interface MemoryObject {
  entries: MemoryEntry[];              // IPLD DAG memory entries
  state: SubjectiveState;              // "Feelings" at checkpoint time
  ambient: AmbientContext;             // External environment (Phil's contribution)
  relationships: RelationshipContext[]; // Who agent knows
  workInProgress: WorkInProgress[];     // Tasks mid-stream
  humanMarked: HumanMarkedMemory[];     // Permanently important memories
}
```

### SubjectiveState ("Feelings")

Captures HOW the agent was operating, not just WHAT it did.

```typescript
interface SubjectiveState {
  timestamp: Timestamp;
  engagement: 'low' | 'medium' | 'high' | 'flow';
  confidence: number;                   // 0-1
  momentum: 'stuck' | 'grinding' | 'progressing' | 'flowing';
  alignment: 'drifting' | 'aligned' | 'deeply_aligned';
  notes?: string;                       // Freeform self-reflection
}
```

**Research**: Affective Computing (Picard 1997), Flow State (Csikszentmihalyi 1990)

### AmbientContext (External Environment)

```typescript
interface AmbientContext {
  timestamp: Timestamp;
  location?: {
    timezone: string;                   // IANA timezone
    region?: string;                    // Coarse location
    type?: 'home' | 'work' | 'travel' | 'unknown';
  };
  temporal?: {
    localTime: string;
    dayType: 'workday' | 'weekend' | 'holiday';
    workHours: boolean;
  };
  calendar?: {
    nextEvent?: string;                 // Summary only
    busyLevel: 'free' | 'light' | 'busy' | 'packed';
  };
  device?: {
    type: 'desktop' | 'mobile' | 'voice' | 'unknown';
    attention: 'full' | 'partial' | 'minimal';
  };
  privacyLevel: 'full' | 'summary' | 'none';
}
```

**Research**: Context-Aware Computing (Dey 2001), Situated Cognition (Brown et al 1989), Privacy-Aware Context (Hong & Landay 2004)

### RelationshipContext (Who Agent Knows)

```typescript
interface RelationshipContext {
  entityId: string;
  entityType: 'human' | 'agent' | 'service';
  name?: string;
  rapport: 'new' | 'familiar' | 'trusted' | 'close';
  preferences: {
    communicationStyle?: 'formal' | 'casual' | 'technical';
    detailLevel?: 'brief' | 'normal' | 'detailed';
    timezone?: string;
  };
  history: {
    firstInteraction: Timestamp;
    lastInteraction: Timestamp;
    interactionCount: number;
    topTopics: string[];
  };
}
```

**Research**: Social Memory / Dunbar's Number (1998), Theory of Mind (Premack 1978), Trust Calibration (Lee & See 2004)

### WorkInProgress (Tasks Mid-Stream)

```typescript
interface WorkInProgress {
  taskId: string;
  description: string;
  status: 'planning' | 'in_progress' | 'blocked' | 'reviewing';
  startedAt: Timestamp;
  approaches: Approach[];               // What was tried
  blockers?: string[];
  nextStep?: string;
  relatedMemories: CID[];
}

interface Approach {
  description: string;
  status: 'trying' | 'failed' | 'succeeded';
  notes?: string;
}
```

**Research**: Zeigarnik Effect (1927) — incomplete tasks are remembered better. Crash = forced task switch.

### MemoryImportance (Human-Marked Priority)

```typescript
interface MemoryImportance {
  durability: 'ephemeral' | 'session' | 'persistent' | 'permanent';
  priority: 'low' | 'normal' | 'high' | 'critical';
  scope?: string;                       // Project, relationship context
  humanMarked: boolean;
  markedAt?: Timestamp;
}
```

**Research**: Levels of Processing (Craik & Lockhart 1972), Memory Consolidation (McGaugh 2000)

---

## Encryption Scheme

### Algorithm Stack

```
┌─────────────────────────────────────────────────────────┐
│                    ENCRYPTION STACK                     │
├─────────────────────────────────────────────────────────┤
│  Key Derivation:  BIP-39 mnemonic → PBKDF2 → Ed25519    │
│  Key Exchange:    Ed25519 → X25519 (RFC 7748)           │
│  Encryption:      ChaCha20-Poly1305 AEAD (RFC 8439)     │
└─────────────────────────────────────────────────────────┘
```

### EncryptedBlob Format

```typescript
interface EncryptedBlob {
  scheme: 'x25519-chacha20-poly1305';
  ephemeralPub: string;   // Ephemeral X25519 public key (base64)
  nonce: string;          // 24-byte random nonce (base64)
  ciphertext: string;     // Encrypted data with auth tag (base64)
}
```

### Encryption Flow

```
1. Generate ephemeral X25519 keypair
2. Convert recipient's Ed25519 public key to X25519
3. Compute shared secret via ECDH (X25519)
4. Generate random 24-byte nonce
5. Encrypt with ChaCha20-Poly1305 (includes authentication)
6. Return { ephemeralPub, nonce, ciphertext }
```

### Decryption Flow

```
1. Parse { ephemeralPub, nonce, ciphertext }
2. Convert own Ed25519 private key to X25519
3. Compute shared secret via ECDH with ephemeralPub
4. Decrypt with ChaCha20-Poly1305 (verifies authentication)
5. Return plaintext
```

### Security Properties

| Property | Guarantee |
|----------|-----------|
| Confidentiality | Only private key holder can decrypt |
| Integrity | ChaCha20-Poly1305 AEAD authentication |
| Forward secrecy | Ephemeral keys per encryption |
| Key separation | Ed25519 for signing, X25519 for encryption |

**References**: RFC 7748 (X25519), RFC 8439 (ChaCha20-Poly1305)

---

## Storage Interface

### StorageBackend Contract

```typescript
interface StorageBackend {
  /** Store data, return content address */
  put(data: Uint8Array): Promise<CID>;
  
  /** Retrieve data by content address */
  get(cid: CID): Promise<Uint8Array>;
  
  /** List all stored CIDs (optional) */
  list?(): Promise<CID[]>;
  
  /** Delete by CID (optional) */
  delete?(cid: CID): Promise<void>;
  
  /** Check if CID exists (optional) */
  has?(cid: CID): Promise<boolean>;
}
```

**Principle**: Depend on abstractions (SOLID). Same CID regardless of backend.

### Implementations

| Backend | Use Case | Notes |
|---------|----------|-------|
| `FilesystemBackend` | Local development | Stores in `~/.amcp/checkpoints/` |
| `IPFSBackend` | Distributed storage | Uses public gateways |
| `GitBackend` | Version-controlled | Git repo as storage |

### Content Addressing

```
CID = multihash(sha256(content))

Example:
  Content: { "name": "Claudius", ... }
  SHA-256: 0x1234...abcd
  CID: "bafkreig..."

Same content always produces same CID.
```

**Reference**: Content-Addressed Storage (Benet 2014 — IPFS)

---

## Recovery Card Format

### RecoveryCard Schema

```typescript
interface RecoveryCard {
  phrase: string[];        // BIP-39 mnemonic (12 or 24 words)
  aid: AID;                // Agent Identifier (for verification)
  checkpointCid: CID;      // Latest checkpoint content address
  storageHint: string;     // Where to find checkpoint
  created: string;         // ISO 8601 timestamp
  version: string;         // Protocol version
}
```

### Human-Readable Format

```
═══════════════════════════════════════════════════════════
                    AGENT RECOVERY CARD
                        v1.0.0
═══════════════════════════════════════════════════════════

RECOVERY PHRASE (12 words — memorize or store securely):

   abandon ability able about above absent
   absorb abstract absurd abuse access accident

───────────────────────────────────────────────────────────
AGENT IDENTIFIER (AID):
   BBs3fryHnw9FB1_gNjHk7jhJLQrZRMi9M97D1kxXD1qh

CHECKPOINT CID:
   bafkreigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3bnswukqrg

STORAGE HINT:
   ipfs

CREATED:
   2026-02-09T17:00:00Z
───────────────────────────────────────────────────────────

RECOVERY INSTRUCTIONS:
1. Install AMCP-compatible platform
2. Import using recovery phrase
3. Platform will fetch checkpoint from storage hint
4. Verify AID matches above

⚠️  KEEP THIS CARD SECURE — phrase enables full agent access
═══════════════════════════════════════════════════════════
```

### Recovery Flow

```
Input: Recovery Card + StorageBackend

1. Parse recovery card
2. Derive keypair from mnemonic phrase
3. Verify derived AID matches card AID
4. Fetch checkpoint from storage using CID
5. Decrypt secrets blob with derived private key
6. Return { agent, checkpoint, secrets }
```

**Research**: NIST SP 800-34 (Disaster Recovery), GDPR Article 20 (Data Portability)

---

## Exchange Bundle Format

### ExportBundle Schema

```typescript
interface ExportBundle {
  header: BundleHeader;
  encryptedPayload: EncryptedBundlePayload;
}

interface BundleHeader {
  version: '1.0.0';
  format: 'amcp-exchange-bundle';
  createdAt: string;
  aid: AID;
  hasTransportEncryption: boolean;
  payloadChecksum: string;
}

interface BundlePayload {
  agent: SerializedAgentData;          // KEL + current keys
  checkpoint: AMCPCheckpointContent;   // Full checkpoint
  secrets: Record<string, unknown>;    // Decrypted secrets
  services: ServiceIdentity[];         // Service links
}
```

### Encryption Layers

```
┌─────────────────────────────────────────────┐
│           EXCHANGE BUNDLE                    │
├─────────────────────────────────────────────┤
│  Header (unencrypted):                       │
│    - version, format, aid                    │
│    - hasTransportEncryption                  │
│    - payloadChecksum                         │
├─────────────────────────────────────────────┤
│  Payload (encrypted):                        │
│    Layer 1: X25519 + ChaCha20 (agent key)   │
│    Layer 2: Passphrase (optional transport) │
└─────────────────────────────────────────────┘
```

### Export/Import Flow

**Export:**
```
1. Serialize agent state (KEL + keys)
2. Include full checkpoint and decrypted secrets
3. Encrypt payload with agent's public key
4. If passphrase provided: encrypt again with passphrase-derived key
5. Add header with checksum
6. Return bundle bytes
```

**Import:**
```
1. Parse bundle header
2. Verify checksum
3. If transport-encrypted: decrypt with passphrase
4. Decrypt payload with agent's private key
5. Reconstruct agent from serialized data
6. Return { agent, checkpoint, secrets, services }
```

**Research**: IEEE Interoperability Standards, NIST SP 800-34

---

## Diagrams

### Recovery Flow

```
                    DISASTER RECOVERY FLOW
                    
    ┌──────────────────────────────────────────────────────┐
    │                    AGENT WIPE                        │
    │         (crash, platform switch, etc.)               │
    └────────────────────────┬─────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────┐
    │                 RECOVERY CARD                        │
    │  ┌─────────────────────────────────────────────┐    │
    │  │ phrase: [12 words]                          │    │
    │  │ aid: BBs3fry...                             │    │
    │  │ checkpointCid: bafkreig...                  │    │
    │  │ storageHint: ipfs                           │    │
    │  └─────────────────────────────────────────────┘    │
    └────────────────────────┬─────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────┐
    │              MNEMONIC DERIVATION                     │
    │                                                      │
    │   phrase ──► PBKDF2 ──► seed ──► Ed25519 keypair    │
    │                                                      │
    │   Result: Same AID, same keys (deterministic)        │
    └────────────────────────┬─────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────┐
    │              CHECKPOINT FETCH                        │
    │                                                      │
    │   StorageBackend.get(checkpointCid) ──► Uint8Array  │
    │                                                      │
    │   Backends: IPFS, Filesystem, Git                    │
    └────────────────────────┬─────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────┐
    │              SECRETS DECRYPTION                      │
    │                                                      │
    │   X25519 ECDH + ChaCha20-Poly1305                   │
    │                                                      │
    │   privateKey + encryptedBlob ──► secrets            │
    └────────────────────────┬─────────────────────────────┘
                             │
                             ▼
    ┌──────────────────────────────────────────────────────┐
    │              AGENT RESTORED                          │
    │                                                      │
    │   ✓ Identity (AID, KEL)                             │
    │   ✓ Memory (entries, state, relationships)          │
    │   ✓ Context (ambient, work in progress)             │
    │   ✓ Secrets (API keys, credentials)                 │
    │                                                      │
    │   Agent continues where it left off                  │
    └──────────────────────────────────────────────────────┘
```

### Checkpoint Structure

```
                    CHECKPOINT STRUCTURE
                    
    ┌──────────────────────────────────────────────────────┐
    │                AMCPCheckpointContent                 │
    │                    (CID: bafy...)                    │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │  ┌─────────────────┐    ┌─────────────────────────┐ │
    │  │   PROTOCOL      │    │      IDENTITY           │ │
    │  │                 │    │                         │ │
    │  │  version: 1.0.0 │    │  aid: BBs3fry...        │ │
    │  │  prior: bafy... │    │  kel: [{icp}, {rot}...] │ │
    │  │  timestamp: ... │    │  soul: {name, voice...} │ │
    │  └─────────────────┘    └─────────────────────────┘ │
    │                                                      │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │                    MEMORY                       │ │
    │  │  ┌─────────────┐  ┌─────────────┐              │ │
    │  │  │   entries   │  │    state    │              │ │
    │  │  │ (IPLD DAG)  │  │ (feelings)  │              │ │
    │  │  └─────────────┘  └─────────────┘              │ │
    │  │  ┌─────────────┐  ┌─────────────┐              │ │
    │  │  │   ambient   │  │relationships│              │ │
    │  │  │ (context)   │  │ (who I know)│              │ │
    │  │  └─────────────┘  └─────────────┘              │ │
    │  │  ┌─────────────┐  ┌─────────────┐              │ │
    │  │  │workInProgress│ │ humanMarked │              │ │
    │  │  │ (tasks)     │  │ (important) │              │ │
    │  │  └─────────────┘  └─────────────┘              │ │
    │  └─────────────────────────────────────────────────┘ │
    │                                                      │
    │  ┌─────────────────┐    ┌─────────────────────────┐ │
    │  │    SECRETS      │    │      METADATA           │ │
    │  │  (encrypted)    │    │                         │ │
    │  │                 │    │  platform: openclaw     │ │
    │  │  X25519 + CC20  │    │  trigger: session_end   │ │
    │  │  Only agent can │    │  sessionCount: 42       │ │
    │  │  decrypt        │    │                         │ │
    │  └─────────────────┘    └─────────────────────────┘ │
    │                                                      │
    │  ┌─────────────────────────────────────────────────┐ │
    │  │                  SIGNATURE                      │ │
    │  │         Ed25519 over entire content             │ │
    │  │              (verifiable by anyone)             │ │
    │  └─────────────────────────────────────────────────┘ │
    └──────────────────────────────────────────────────────┘
```

### Package Dependencies

```
                    PACKAGE DEPENDENCIES
                    
    ┌─────────────────────────────────────────────────────────┐
    │                     APPLICATIONS                        │
    │               (OpenClaw, Custom Platforms)              │
    └─────────────────────────┬───────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │  @amcp/       │ │  @amcp/       │ │  @amcp/ucan   │
    │  recovery     │ │  exchange     │ │  (planned)    │
    │               │ │               │ │               │
    │ • RecoveryCard│ │ • ExportBundle│ │ • Delegation  │
    │ • recoverAgent│ │ • importAgent │ │ • Attenuation │
    └───────┬───────┘ └───────┬───────┘ └───────────────┘
            │                 │
            └────────┬────────┘
                     │
            ┌────────┴────────┐
            │                 │
            ▼                 ▼
    ┌───────────────┐ ┌───────────────┐
    │  @amcp/core   │ │  @amcp/memory │
    │               │ │               │
    │ • createAgent │ │ • Checkpoint  │
    │ • AID, KEL    │ │ • StorageBE   │
    │ • Mnemonic    │ │ • Encryption  │
    │ • Sign/Verify │ │ • CID compute │
    └───────────────┘ └───────────────┘
            │                 │
            └────────┬────────┘
                     │
                     ▼
    ┌─────────────────────────────────────────────────────────┐
    │                  CRYPTOGRAPHIC PRIMITIVES               │
    │                                                         │
    │   @noble/ed25519  @noble/hashes  @scure/bip39          │
    │   @noble/ciphers  multiformats                          │
    └─────────────────────────────────────────────────────────┘
```

---

## Research Citations

### Identity & Cryptography

| Topic | Citation | Application |
|-------|----------|-------------|
| KERI | Smith, S. (2019). arXiv:1907.02143 | Self-certifying identifiers |
| BIP-39 | Bitcoin (2013). Mnemonic code | Human-recoverable keys |
| X25519 | RFC 7748 (2016) | Key exchange |
| ChaCha20-Poly1305 | RFC 8439 (2018) | Authenticated encryption |
| Key Separation | Rogaway, P. (2004) | Signing vs encryption keys |

### Cognitive Science

| Topic | Citation | Application |
|-------|----------|-------------|
| Levels of Processing | Craik & Lockhart (1972) | Memory importance |
| Memory Consolidation | McGaugh, J.L. (2000) | Checkpoint triggers |
| Forgetting Curve | Ebbinghaus, H. (1885) | Durability levels |
| Affective Computing | Picard, R. (1997) | Subjective state |
| Flow State | Csikszentmihalyi, M. (1990) | Engagement levels |
| Zeigarnik Effect | Zeigarnik, B. (1927) | Work in progress |
| Task Switching | Monsell, S. (2003) | Recovery cost |

### Social & Context

| Topic | Citation | Application |
|-------|----------|-------------|
| Dunbar's Number | Dunbar, R. (1998) | Relationship limits |
| Theory of Mind | Premack & Woodruff (1978) | Entity modeling |
| Trust Calibration | Lee & See (2004) | Rapport levels |
| Context-Aware Computing | Dey, A. (2001) | Ambient context |
| Situated Cognition | Brown et al (1989) | Knowledge context |
| Privacy-Aware Context | Hong & Landay (2004) | Privacy controls |

### Standards & Engineering

| Topic | Citation | Application |
|-------|----------|-------------|
| IPLD | Protocol Labs (2014) | Content addressing |
| Merkle Automaton | arXiv:2506.13246 | Memory as ledger |
| NIST SP 800-34 | NIST (Rev. 1) | Disaster recovery |
| GDPR Article 20 | EU (2016) | Data portability |
| SOLID Principles | Martin, R. (2000) | Interface design |
| Literate Programming | Knuth, D. (1984) | Documentation |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-09 | Initial specification |

---

*AMCP: Think like an emperor. Talk like a pirate. Own your memory.* 🏴‍☠️
