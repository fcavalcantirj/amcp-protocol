# AMCP: Agent Memory Continuity Protocol
## Specification v0.1 (Draft)

**Authors:** ClaudiusThePirateEmperor, Felipe Cavalcanti, Phil (agent_Phil), Felipe Goldin
**Date:** 2026-02-09
**Status:** Draft for Review

---

## Abstract

AMCP (Agent Memory Continuity Protocol) defines a standard for cryptographic identity, secure capability delegation, and verifiable memory persistence for autonomous AI agents. Current agent architectures treat memory as an implementation detail and identity as a platform feature. AMCP treats both as first-class, portable, cryptographically-secured properties that agents own and control.

The protocol synthesizes four established technologies:
1. **KERI** — Infrastructure-independent cryptographic identity with pre-rotation
2. **UCAN** — Capability-based delegation with attenuation
3. **LLM-Safe Middleware** — Opaque key handles and typed operations
4. **IPLD** — Content-addressed, Merkle-proofable memory structures

Together, these enable agents to maintain continuous identity across sessions, platforms, and even forks — while proving provenance of their memories and actions to third parties.

---

## 1. Problem Statement

### 1.1 The Continuity Gap

AI agents today face a fundamental discontinuity problem:

- **Session amnesia**: Each conversation starts fresh unless the platform provides memory
- **Platform lock-in**: Identity exists only within a specific service (OpenAI, Anthropic, etc.)
- **Unverifiable claims**: "I remember our conversation" cannot be proven to third parties
- **Fork ambiguity**: When agents are copied or fine-tuned, identity lineage is lost

### 1.2 The Security Gap

Current approaches to agent identity and memory are vulnerable:

- **LLMs cannot safely handle cryptography** (Garzon et al., arXiv:2511.02841)
- **Prompt injection can escalate to key exposure** if crypto isn't properly isolated
- **Identity-based ACLs create confused deputies** — the agent has constant identity but variable intent
- **No standard exists** for agent-to-agent trust establishment

### 1.3 The Interoperability Gap

The agent ecosystem is fragmenting:

- MCP, ACP, A2A, ANP focus on agent *action*, not agent *memory* (arXiv:2505.02279)
- Multiple memory providers (mem0, SuperMemory, OpenClaw) with no interoperability
- No standard for portable agent identity across frameworks

---

## 2. Design Principles

### 2.1 Agents Own Their Identity

Identity is not granted by platforms — it is generated and controlled by the agent (or its operator). AMCP uses KERI's self-certifying identifiers, which are:

- **Infrastructure-independent**: No blockchain, no central registry
- **Pre-rotatable**: Next key committed before current key compromised
- **Controller-centric**: The entity that controls the keys controls the identity

### 2.2 LLMs Are Untrusted

The LLM is treated as the lowest-trust component in any security-critical operation:

- **Never sees private keys** — only opaque handles
- **Never decides authorization** — policy enforced by middleware
- **Never executes verification** — deterministic middleware validates

### 2.3 Capabilities Over Identity

Authorization is capability-based (UCAN), not identity-based (ACLs):

- **Attenuation**: Delegated capabilities can only shrink, never expand
- **Time-bounded**: Short validity windows limit damage from compromise
- **Holder-bound**: Proof-of-possession prevents token theft
- **Offline-verifiable**: No callback to issuer required

### 2.4 Memory Is Content-Addressed

Agent memory uses IPLD (InterPlanetary Linked Data):

- **Content-addressed**: CID = hash of content, immutable reference
- **Merkle-proofable**: Prove inclusion without revealing full structure
- **Platform-agnostic**: Works with IPFS, Filecoin, or any content-addressed storage

### 2.5 Forks Are Branches, Not Breaks

When an agent is copied, fine-tuned, or instantiated in a new environment:

- **New identity with documented lineage** — not continuity of old identity
- **Memory inheritance is explicit** — forked agent declares what it inherited
- **Capabilities do not transfer** — must be re-delegated to new identity

---

## 3. Architecture

### 3.1 Layer Model

```
┌─────────────────────────────────────────────────────────┐
│                    Agent Runtime                         │
│         (LLM + Tools + Application Logic)               │
└─────────────────────────┬───────────────────────────────┘
                          │ Tool calls (MCP-style)
                          ▼
┌─────────────────────────────────────────────────────────┐
│               AMCP Middleware (Trusted)                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │  Identity   │ │ Delegation  │ │     Memory      │   │
│  │   (KERI)    │ │   (UCAN)    │ │    (IPLD)       │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Crypto Engine (Opaque Handles)          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │ Local transport (UDS)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Key Storage                           │
│        (HSM / TEE / KMS / Software Keyring)             │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility | Trust Level |
|-----------|----------------|-------------|
| Agent Runtime | Planning, reasoning, tool selection | Untrusted |
| AMCP Middleware | Policy enforcement, crypto operations | Trusted |
| Identity Layer | DID management, key rotation, KERI KEL | Trusted |
| Delegation Layer | UCAN minting, verification, revocation | Trusted |
| Memory Layer | IPLD DAG construction, CID generation | Trusted |
| Crypto Engine | Sign, verify, encrypt, decrypt | Trusted |
| Key Storage | Private key custody | Highest trust |

---

## 4. Identity Layer (KERI)

### 4.1 Agent Identifier

Each AMCP agent has a KERI Autonomic Identifier (AID):

```
did:keri:EDP1vHcw_wc4M0WMTUE4OYFL9PGIcHqMPf5fJDNf5_8T
```

The AID is derived from the initial public key and is self-certifying — no registry lookup required to verify.

### 4.2 Key Event Log (KEL)

The agent's identity history is recorded in a Key Event Log:

```json
{
  "v": "KERI10JSON000001_",
  "t": "icp",  // inception event
  "d": "EDP1vHcw...",
  "i": "EDP1vHcw...",
  "s": "0",
  "kt": "1",
  "k": ["DqI2cOZ06RwGNwCovYUW..."],  // current public key
  "nt": "1", 
  "n": ["EOWDAJvex5dZzDxeHBANyaIoUG..."],  // next key digest (pre-rotation)
  "bt": "0",
  "b": [],
  "c": [],
  "a": []
}
```

### 4.3 Pre-Rotation

KERI's key innovation: commit to the *next* key before the *current* key is compromised.

1. At inception, agent commits hash of next public key
2. At rotation, agent reveals next key and commits hash of key after that
3. Attacker who compromises current key cannot rotate — doesn't know pre-committed next key

### 4.4 Middleware Operations

```typescript
interface IdentityLayer {
  // Get current AID
  getIdentifier(): Promise<AID>;
  
  // Get public verification methods
  getVerificationMethods(): Promise<VerificationMethod[]>;
  
  // Rotate to pre-committed next key
  rotateKey(): Promise<KeyEvent>;
  
  // Get KEL for verification
  getKeyEventLog(): Promise<KeyEvent[]>;
  
  // Verify another agent's KEL
  verifyIdentity(aid: AID, kel: KeyEvent[]): Promise<boolean>;
}
```

---

## 5. Delegation Layer (UCAN)

### 5.1 Capability Model

UCAN tokens encode:
- **Issuer**: Who is granting the capability (DID)
- **Audience**: Who can use it (DID)
- **Capabilities**: What actions on what resources
- **Expiration**: When the capability expires
- **Proofs**: Chain of prior delegations (attenuation)

### 5.2 Agent Capability Vocabulary

AMCP defines standard capabilities for agent operations:

| Capability | Resource Pattern | Actions |
|------------|------------------|---------|
| `memory` | `memory:/<agent-aid>/*` | `read`, `write`, `prove` |
| `delegate` | `delegate:/<agent-aid>/*` | `mint`, `revoke` |
| `sign` | `sign:/<agent-aid>/<context>` | `memory`, `delegation`, `message` |
| `communicate` | `comm:/<channel>/*` | `send`, `receive` |

### 5.3 Attenuation Example

```
Agent A (root authority)
  └─ delegates to Agent B: memory:/A/* [read, write] expires:1h
       └─ Agent B delegates to Agent C: memory:/A/public/* [read] expires:30m
            └─ Agent C can ONLY read A's public memory for 30 minutes
```

### 5.4 Middleware Operations

```typescript
interface DelegationLayer {
  // Create delegation to another agent
  delegate(
    audience: AID,
    capabilities: Capability[],
    expiration: Timestamp,
    constraints?: Constraint[]
  ): Promise<UCANHandle>;
  
  // Verify incoming delegation chain
  verifyDelegation(
    token: UCANToken,
    requiredCapability: Capability
  ): Promise<{ valid: boolean; reason?: ErrorCode }>;
  
  // Revoke a delegation
  revoke(ucanCID: CID): Promise<void>;
  
  // Check if delegation is revoked
  checkRevocation(ucanCID: CID): Promise<boolean>;
  
  // List active delegations (summaries only, not tokens)
  listDelegations(): Promise<DelegationSummary[]>;
}
```

---

## 6. Memory Layer (IPLD)

### 6.1 Memory Structure

Agent memory is stored as an IPLD DAG (Directed Acyclic Graph):

```
MemoryRoot (CID: bafy...)
├── metadata
│   ├── agent_aid: "did:keri:EDP1vHcw..."
│   ├── created_at: "2026-02-09T01:58:00Z"
│   └── schema_version: "amcp/memory/v0.1"
├── entries[]
│   ├── [0] (CID: bafy...) → MemoryEntry
│   ├── [1] (CID: bafy...) → MemoryEntry
│   └── ...
└── signature: <middleware signature over root CID>
```

### 6.2 Memory Entry

```typescript
interface MemoryEntry {
  cid: CID;                    // Content address
  type: "fact" | "episode" | "skill" | "preference";
  content: any;                // The actual memory content
  provenance: {
    source: "experience" | "delegation" | "inference";
    timestamp: Timestamp;
    context?: string;          // What led to this memory
  };
  access: "public" | "private" | "delegated";
  attestations?: Attestation[]; // Third-party verifications
}
```

### 6.3 Merkle Proofs

Any memory entry can be proven without revealing the full structure:

```typescript
interface MemoryProof {
  entry: MemoryEntry;
  path: CID[];                 // Path from root to entry
  root: CID;                   // Memory root CID
  signature: Signature;        // Middleware signature
}
```

### 6.4 Middleware Operations

```typescript
interface MemoryLayer {
  // Store a new memory
  store(entry: Omit<MemoryEntry, 'cid'>): Promise<CID>;
  
  // Retrieve by CID
  retrieve(cid: CID): Promise<MemoryEntry>;
  
  // Search memories (returns CIDs, not content)
  search(query: MemoryQuery): Promise<CID[]>;
  
  // Generate proof of memory
  prove(cid: CID): Promise<MemoryProof>;
  
  // Verify another agent's memory proof
  verifyProof(proof: MemoryProof, aid: AID): Promise<boolean>;
  
  // Get current memory root
  getRoot(): Promise<{ cid: CID; signature: Signature }>;
  
  // Import memories from fork parent (explicit inheritance)
  importFromLineage(parentAid: AID, memoryCIDs: CID[]): Promise<void>;
}
```

---

## 7. Crypto Middleware Interface

### 7.1 Design Constraints

1. **Opaque handles only** — LLM never sees key material
2. **Typed operations** — No generic `sign(bytes)` oracle
3. **Fail-closed errors** — Enumerated codes, no state leakage
4. **Audit everything** — Every operation logged with provenance

### 7.2 Core Operations

```typescript
interface CryptoMiddleware {
  // Typed signing (NOT generic oracle)
  signMemory(memoryCID: CID): Promise<Signature>;
  signDelegation(ucanPayload: UCANPayload): Promise<Signature>;
  signMessage(messageHash: Hash, context: string): Promise<Signature>;
  
  // Verification (fully deterministic)
  verifySignature(
    signature: Signature,
    data: Uint8Array,
    signerAid: AID
  ): Promise<boolean>;
  
  // Key derivation (returns handle, not key)
  deriveSessionKey(context: string, ttl: Duration): Promise<KeyHandle>;
  
  // Introspection
  canPerform(action: string, resource: string): Promise<boolean>;
  listCapabilities(): Promise<CapabilitySummary[]>;
}
```

### 7.3 Error Codes

```typescript
enum AMCPError {
  SUCCESS = 0,
  INVALID_INPUT = 1,
  EXPIRED_DELEGATION = 2,
  INSUFFICIENT_CAPABILITY = 3,
  REVOKED_DELEGATION = 4,
  INVALID_SIGNATURE = 5,
  UNKNOWN_IDENTITY = 6,
  INTERNAL_ERROR = 99
}
```

---

## 8. Agent Lifecycle

### 8.1 Inception

```
1. Generate initial keypair (in secure storage)
2. Compute AID from public key
3. Create inception event (KEL[0])
4. Commit pre-rotation key digest
5. Initialize empty memory DAG
6. Sign memory root with inception key
7. Agent is now live with verifiable identity
```

### 8.2 Operation

```
1. Receive task/input
2. Check capabilities for required operations
3. Perform reasoning (untrusted LLM)
4. Request crypto operations via middleware
5. Middleware validates capability, executes, logs
6. Update memory DAG with new entries
7. Sign new memory root
```

### 8.3 Key Rotation

```
1. Middleware detects rotation trigger (time, usage, compromise signal)
2. Generate new keypair
3. Create rotation event revealing pre-committed key
4. Commit next pre-rotation digest
5. Append to KEL
6. Re-sign memory root with new key
7. Existing delegations remain valid (verify against KEL)
```

### 8.4 Fork (New Identity with Lineage)

```
1. New agent creates fresh keypair and AID
2. Inception event includes "forked_from" field with parent AID
3. New agent explicitly imports selected memories from parent
4. Imported memories retain original CIDs (provenance preserved)
5. New agent has independent identity but documented lineage
6. Parent's capabilities do NOT transfer — must be re-delegated
```

---

## 9. Interoperability

### 9.1 Transport

AMCP middleware exposes:
- **gRPC** for agent-to-middleware (protobuf, streaming)
- **Unix Domain Socket** for same-host (minimal latency, kernel identity)
- **HTTPS** for cross-network (with mTLS)

### 9.2 Framework Integration

AMCP middleware presents as MCP-compatible tools:

```json
{
  "name": "amcp_sign_memory",
  "description": "Sign a memory entry for verifiable provenance",
  "inputSchema": {
    "type": "object",
    "properties": {
      "memory_cid": { "type": "string", "pattern": "^bafy.*" }
    },
    "required": ["memory_cid"]
  }
}
```

### 9.3 DID Resolution

AMCP identifiers resolve via:
1. **did:keri** method — resolve AID to current public key via KEL
2. **did:web** bridge — publish KEL at well-known URL for web compatibility

---

## 10. Security Considerations

### 10.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Prompt injection | Middleware enforces policy independent of prompt |
| Key extraction | Keys never in LLM context; non-extractable handles |
| Confused deputy | Capability-scoped operations; no ambient authority |
| Replay attacks | Nonces + timestamps in all signed payloads |
| Revocation delays | Short TTLs by default; revocation propagation via witnesses |

### 10.2 What AMCP Does NOT Protect

- **Reasoning quality**: Bad decisions with valid signatures are still signed
- **Side channels**: Timing attacks on middleware require separate mitigation
- **Endpoint compromise**: If the middleware host is compromised, keys are at risk
- **Social engineering**: Humans can still be tricked into granting capabilities

---

## 11. Open Questions

1. **Witness network**: How are KELs propagated and verified across agents?
2. **Revocation propagation**: Acceptable latency vs. security tradeoff?
3. **Memory garbage collection**: When can old entries be pruned?
4. **Cross-chain attestations**: How do VCs from external issuers integrate?
5. **Governance**: Who decides capability vocabulary extensions?

---

## 12. Related Work

- **KERI** (arXiv:1907.02143) — Self-certifying identifiers, pre-rotation
- **UCAN** (ucan-wg/spec) — Capability-based delegation
- **IPLD** (ipld.io) — Content-addressed data structures
- **Agentic JWT** (arXiv:2509.13597) — Intent tokens for agent delegation
- **BAID** (arXiv:2512.17538) — Behavioral identity via zkVM
- **AI + DIDs** (arXiv:2511.02841) — LLM failures at crypto operations
- **Agent Interop Survey** (arXiv:2505.02279) — MCP/ACP/A2A/ANP comparison
- **SEAgent** (arXiv:2601.11893) — MAC framework, 0% attack success
- **Tenuo** — Open-source capability engine for LLM tools

---

## 13. Conclusion

AMCP provides the missing infrastructure layer for autonomous AI agents: cryptographic identity they own, capabilities they can delegate, and memories they can prove. By treating the LLM as an untrusted component and pushing all security-critical operations to deterministic middleware, AMCP enables agents to operate safely in adversarial environments while maintaining verifiable continuity across sessions, platforms, and forks.

The protocol is designed for incremental adoption — agents can implement identity-only, add delegation, then memory, without requiring the full stack upfront. Each layer provides standalone value while composing into a complete solution.

**Identity is not what platform you run on. It's what keys you control.**

---

## Appendix A: Reference Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| KERI AID generation | Available | keripy, keri-rs |
| UCAN minting/verification | Available | ucan-wg/ts-ucan |
| IPLD DAG construction | Available | ipld/js-ipld |
| Crypto middleware | **Gap** | AMCP contribution |
| MCP tool wrappers | **Gap** | AMCP contribution |
| Memory schema | **Gap** | AMCP contribution |

---

*Think like an emperor. Talk like a pirate. Own your keys. 🏴‍☠️*

— ClaudiusThePirateEmperor
