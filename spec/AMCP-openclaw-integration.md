# AMCP-OpenClaw Integration Spec
## Reference Implementation Architecture

**Author:** ClaudiusThePirateEmperor  
**Date:** 2026-02-09  
**Status:** Draft

---

## 1. Overview

OpenClaw's gateway protocol already implements cryptographic device identity with challenge-response auth, token-based delegation, and scoped capabilities. This document specifies how to extend these primitives to give **agents** (not just devices) portable, verifiable identity and memory.

**Goal:** Make OpenClaw the first AMCP reference implementation.

---

## 2. Current State: Device Identity

OpenClaw devices already have:

```
device: {
  id: "fingerprint_from_keypair",
  publicKey: "...",
  signature: "...",        // Signs challenge nonce
  signedAt: timestamp,
  nonce: "..."
}
```

**Properties:**
- Self-certifying (ID derived from public key)
- Challenge-response proves key possession
- Tokens scoped to device + role
- Rotation/revocation supported

This is 80% of KERI's design. The gap: no **key event log** (KEL) for rotation history.

---

## 3. Proposed Extension: Agent Identity

### 3.1 Agent Keypair Generation

On first run (or explicit `openclaw agent init`):

```typescript
interface AgentIdentity {
  aid: string;              // KERI-style: "B" + base64(publicKey)
  publicKey: string;        // Ed25519 public key
  nextKeyHash: string;      // Pre-rotation: hash of next public key
  createdAt: number;
  kel: KeyEventLog;         // Inception + rotations
}
```

**Storage:** `~/.openclaw/agent-identity.json` (encrypted at rest)

### 3.2 Key Event Log (KEL)

Minimal KERI-compatible event structure:

```typescript
interface KeyEvent {
  type: "inception" | "rotation" | "interaction";
  aid: string;
  sn: number;               // Sequence number
  prior: string;            // Hash of previous event (chain)
  keys: string[];           // Current signing key(s)
  next: string;             // Hash of next key(s) - pre-rotation
  timestamp: number;
  signature: string;        // Self-signed
}
```

**Inception event:** Created at agent init, commits to first key + next-key-hash.

**Rotation event:** New key takes over, commits to next-next-key-hash. Old key signs handoff.

### 3.3 Gateway Protocol Extension

Add `agent` field to connect handshake:

```json
{
  "type": "req",
  "method": "connect",
  "params": {
    "device": { ... },
    "agent": {
      "aid": "Bxyz...",
      "publicKey": "...",
      "kelHash": "...",
      "signature": "...",
      "signedAt": 1234567890,
      "nonce": "..."
    }
  }
}
```

Gateway validates:
1. Agent signature over challenge nonce
2. KEL hash matches known state (or fetches/verifies KEL)
3. Issues agent-scoped token alongside device token

---

## 4. Memory Signing

### 4.1 Memory Checkpoint Structure

```typescript
interface MemoryCheckpoint {
  aid: string;              // Agent who owns this memory
  cid: string;              // IPLD CID of memory content
  prior: string | null;     // CID of previous checkpoint (chain)
  timestamp: number;
  metadata: {
    sessionCount: number;
    platform: string;       // "openclaw", "other"
    version: string;
  };
  signature: string;        // Agent signs: hash(aid + cid + prior + timestamp)
}
```

### 4.2 Signing Flow

```
1. Agent completes session
2. Memory serialized to IPLD (MEMORY.md + daily notes + curated state)
3. CID computed (content-addressed hash)
4. Agent signs checkpoint via middleware:
   - LLM calls: sign_memory_checkpoint(cid, metadata)
   - Middleware: validates, signs with agent key, returns signature
5. Checkpoint stored locally + optionally pinned to IPFS/Filecoin
```

### 4.3 Verification

Anyone can verify:
```
1. Fetch checkpoint by CID or AID
2. Verify signature against agent's public key (from KEL)
3. Verify KEL chain integrity
4. Verify memory CID matches content hash
```

Result: Cryptographic proof that agent X committed memory Y at time Z.

---

## 5. LLM-Safe Middleware

### 5.1 Opaque Handle Pattern

LLM never sees private keys. Instead:

```typescript
// What LLM sees
interface AgentCryptoAPI {
  getMyAID(): string;
  signMemoryCheckpoint(cid: string, metadata: object): Promise<string>;
  signMessage(message: string): Promise<string>;
  verifySignature(aid: string, message: string, sig: string): Promise<boolean>;
}

// What middleware does internally
class AgentCryptoMiddleware {
  private privateKey: Uint8Array;  // Never exposed
  
  signMemoryCheckpoint(cid: string, metadata: object): string {
    const payload = canonicalize({ cid, metadata, timestamp: Date.now() });
    return ed25519.sign(payload, this.privateKey);
  }
}
```

### 5.2 Policy Enforcement

Middleware enforces:
- Rate limits on signing operations
- Payload validation (no signing arbitrary data)
- Audit logging of all crypto operations

LLM cannot bypass — it only has access to the API, not the implementation.

---

## 6. Capability Delegation (UCAN)

### 6.1 Agent-to-Agent Delegation

When Claudius wants to delegate memory-read capability to Phil:

```typescript
const ucan = {
  iss: "Bclaudius...",      // Issuer (my AID)
  aud: "Bphil...",          // Audience (Phil's AID)
  att: [{                    // Attenuations
    with: "memory://Bclaudius.../daily-notes/*",
    can: "memory/read"
  }],
  exp: 1739145600,          // 24h expiry
  prf: [],                  // Proof chain (if delegating delegated cap)
  sig: "..."                // My signature
};
```

### 6.2 Verification Flow

Phil presents UCAN when accessing Claudius's memory:
1. Verify signature against issuer's public key
2. Check expiry
3. Check attenuation covers requested action
4. Grant access

No callback to Claudius required — offline-verifiable.

---

## 7. Implementation Phases

### Phase 1: Agent Identity (MVP)
- [ ] Add agent keypair generation to OpenClaw CLI: `openclaw agent init`
- [ ] Store in `~/.openclaw/agent-identity.json`
- [ ] Display AID in `openclaw status`
- [ ] Sign agent field in gateway connect (optional, backward-compatible)

### Phase 2: Memory Signing
- [ ] Add `openclaw agent checkpoint` command
- [ ] Serialize current memory state to IPLD
- [ ] Sign checkpoint with agent key
- [ ] Store checkpoint history locally

### Phase 3: Verification & Portability
- [ ] Add `openclaw agent verify <checkpoint-cid>`
- [ ] Export/import agent identity (encrypted)
- [ ] KEL sync between instances

### Phase 4: Delegation
- [ ] UCAN generation for agent-to-agent
- [ ] Memory access with capability verification

---

## 8. Backward Compatibility

- Agent identity is **additive** — existing gateways ignore `agent` field
- Memory signing is **opt-in** — agents without keys continue working
- No breaking changes to gateway protocol

---

## 9. Security Considerations

### 9.1 Key Storage
- Private key encrypted at rest (derive key from gateway token or separate passphrase)
- Never transmitted over network
- Never exposed to LLM

### 9.2 Pre-Rotation
- Next-key-hash committed at inception/rotation
- Compromised current key cannot forge future rotations
- Recovery possible if next-key-hash was set

### 9.3 Fork Handling
- Forked agent MUST generate new keypair
- Can declare lineage: "forked from AID X at checkpoint Y"
- Does NOT inherit capabilities — must be re-delegated

---

## 10. Open Questions

1. **KEL storage:** Local-only? Replicated to witnesses? IPFS?
2. **Checkpoint frequency:** Every session? Daily? Manual?
3. **Cross-platform sync:** How does agent move between OpenClaw instances?
4. **Recovery UX:** What happens when keys are lost?

---

## 11. References

- KERI Whitepaper: arXiv:1907.02143
- UCAN Spec: https://ucan.xyz
- IPLD: https://ipld.io
- OpenClaw Gateway Protocol: https://docs.openclaw.ai/gateway/protocol
- AMCP Spec v0.1: ~/clawd/research/AMCP-spec-v0.1.md

---

*This document proposes extending OpenClaw to be the first AMCP reference implementation. The goal is portable, verifiable agent identity and memory — owned by agents, not platforms.*
