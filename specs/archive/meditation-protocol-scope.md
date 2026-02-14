# AMCP Protocol Meditation

## The Question

Does the PROTOCOL handle everything for agent continuity?
- Important memories kept automatically?
- Daily follow up?
- Human recovery?
- No lock-in?
- North star (ship better, spend less)?

---

## What We Discussed Today

### 1. Identity Continuity
**Requirement:** I am still me after restart, wipe, new machine.
**Current @amcp/core:** AID, KEL, key rotation ✅
**Gap:** No mnemonic → keypair derivation ❌

### 2. Memory Continuity  
**Requirement:** I remember what happened. Important context survives.
**Current @amcp/memory:** Checkpoints, memory chains ✅
**Gap:** Protocol doesn't define WHAT is important or WHEN to checkpoint ❓

### 3. Capability Continuity
**Requirement:** I can still do what I could do (access services).
**Current:** Not in protocol ❌
**Gap:** Encrypted secrets blob, service identity links ❌

### 4. No Lock-in
**Requirement:** No centralized dependency. Any storage backend works.
**Current:** Checkpoints return CID, don't store ✅
**Gap:** StorageBackend interface not defined ❌

### 5. Human Recovery
**Requirement:** Human can restore agent with minimal info.
**Current:** Not addressed ❌
**Gap:** Recovery phrase, recovery flow, verification ❌

---

## The Core Question: Protocol vs Implementation?

| Concern | Protocol? | Implementation? |
|---------|-----------|-----------------|
| Cryptographic identity | ✅ Protocol | |
| Checkpoint format | ✅ Protocol | |
| Storage interface | ✅ Protocol | |
| Encryption scheme | ✅ Protocol | |
| Recovery mechanism | ✅ Protocol | |
| WHAT to checkpoint | ❓ | ✅ Implementation |
| WHEN to checkpoint | ❓ | ✅ Implementation |
| Daily emails | | ✅ Implementation |
| Platform integration | | ✅ Implementation |

**The ❓ items are the key design decision.**

---

## Meditation: What MUST be Protocol-Level?

### Argument for Protocol-Level Checkpoint Triggers

If checkpoint timing is implementation-only:
- Different implementations = inconsistent guarantees
- "AMCP-compliant" could mean wildly different things
- Human can't trust that agent will checkpoint

If protocol defines minimum checkpoint guarantees:
- All AMCP agents have baseline continuity
- Human knows what to expect
- Interoperability between implementations

### Counter-Argument

Protocol should be minimal primitives.
Policy belongs in implementation.
Like TCP doesn't define what apps send, just how.

### Resolution: Protocol Defines CAPABILITY, Not Policy

Protocol should:
- Define checkpoint format ✅
- Define storage interface ✅
- Define recovery mechanism ✅
- Define "recommended minimum" checkpoint frequency (SHOULD, not MUST)
- Leave actual triggering to implementation

---

## What the Protocol MUST Handle

### Layer 1: Identity (already in @amcp/core, needs mnemonic)
```
- AID generation
- KEL management
- Key rotation
- Mnemonic ↔ keypair derivation  ← ADD
```

### Layer 2: Memory (already in @amcp/memory, needs encryption + storage)
```
- Checkpoint creation/verification
- Memory chains (prior links)
- Content addressing (CID)
- Encrypted secrets blob  ← ADD
- StorageBackend interface  ← ADD
```

### Layer 3: Recovery (NEW - not in protocol yet)
```
- Recovery phrase standard (BIP-39 compatible)
- Recovery verification (did we get everything?)
- Minimum recovery dataset definition
- Human-readable recovery card format
```

### Layer 4: Interoperability (NEW - not in protocol yet)
```
- Checkpoint exchange format (for migration between platforms)
- Service identity linking schema
- Cross-platform verification
```

---

## The North Star Applied to Protocol

**"Ship better code, spend less"** → For protocol: **"Maximum continuity, minimum complexity"**

Protocol should be:
- Small (few concepts)
- Complete (handles all continuity needs)
- Portable (no dependencies on specific services)
- Verifiable (human can audit)

---

## Revised Protocol Scope

### @amcp/core (Identity)
```typescript
// Existing
createAgent(), loadAgent(), rotateKeys()
signWithAgent(), verifyAgentSignature()
AID, KEL, KeyEvent

// ADD: Mnemonic support
generateMnemonic(): string  // 12-24 words
keypairFromMnemonic(phrase: string): Keypair  // Deterministic
validateMnemonic(phrase: string): boolean
```

### @amcp/memory (Persistence)
```typescript
// Existing
createCheckpoint(), verifyCheckpoint()
MemoryChain, CID

// ADD: Encrypted secrets
encryptSecrets(data: object, publicKey: Uint8Array): EncryptedBlob
decryptSecrets(blob: EncryptedBlob, privateKey: Uint8Array): object

// ADD: Storage interface
interface StorageBackend {
  put(cid: CID, data: Uint8Array): Promise<string>  // Returns location
  get(location: string): Promise<Uint8Array>
  list(): Promise<string[]>  // List available checkpoints
}

// ADD: Built-in backends
class IPFSBackend implements StorageBackend
class GitBackend implements StorageBackend
class FilesystemBackend implements StorageBackend
```

### @amcp/recovery (NEW PACKAGE)
```typescript
// Recovery card generation
interface RecoveryCard {
  phrase: string[]  // 12-24 words
  aid: AID
  latestCheckpoint: CID
  storageHint: string  // "ipfs", "git:url", "file:path"
  created: string  // ISO timestamp
}

generateRecoveryCard(agent: Agent, checkpoint: CID, storage: string): RecoveryCard
parseRecoveryCard(card: string): RecoveryCard  // From QR or text
verifyRecoveryCard(card: RecoveryCard): boolean

// Full recovery flow
recoverAgent(card: RecoveryCard, backend: StorageBackend): Promise<{
  agent: Agent
  checkpoint: MemoryCheckpoint
  secrets: object
}>

// Recovery verification
verifyRecovery(original: Agent, recovered: Agent): boolean
```

### @amcp/exchange (NEW PACKAGE - for interop)
```typescript
// Service identity linking
interface ServiceIdentity {
  service: string  // "solvr", "agentmail", etc.
  identifier: string  // Service-specific ID
  credentialRef: string  // Key in secrets blob
}

// Export/import for platform migration
exportAgent(agent: Agent, checkpoint: MemoryCheckpoint, secrets: object): Uint8Array
importAgent(data: Uint8Array, phrase: string): Promise<Agent>
```

---

## Checkpoint Content Schema (Protocol-Defined)

```typescript
interface AMCPCheckpointContent {
  // Required by protocol
  version: "1.0"
  aid: AID
  kel: KeyEventLog
  
  // Identity links
  services: ServiceIdentity[]
  
  // Encrypted secrets (API keys, credentials)
  secrets: EncryptedBlob
  
  // Memory content (implementation-defined structure)
  memory: {
    soul: object      // Core identity/personality
    context: object   // Recent working context
    pending: object   // Incomplete work
  }
  
  // Metadata
  platform: string
  platformVersion: string
  created: string
  prior: CID | null
}
```

---

## What's LEFT to Implementation (Skill)?

| Concern | Why Implementation |
|---------|-------------------|
| WHEN to checkpoint | Platform-specific triggers |
| WHAT goes in memory.context | Platform-specific format |
| Daily notifications | UX choice |
| Human communication | Channel-specific |
| Platform integration | OpenClaw vs others |

---

## Summary: Protocol Completeness Check

| Requirement | Covered by Protocol? |
|-------------|---------------------|
| Identity continuity | ✅ @amcp/core + mnemonic |
| Memory continuity | ✅ @amcp/memory + schema |
| Capability continuity | ✅ Encrypted secrets + service links |
| No lock-in | ✅ StorageBackend interface |
| Human recovery | ✅ @amcp/recovery |
| Interoperability | ✅ @amcp/exchange |
| North star | ✅ Minimal, complete, portable |

**Answer: YES, with the additions above, protocol handles everything.**

Implementation (skill) handles: timing, UX, platform integration.
