# AMCP — Agent Memory Continuity Protocol

> Version 0.2 (Agent-Agnostic)
> 
> A protocol for verifiable agent identity continuity across sessions.

---

## 1. Problem Statement

AI agents wake up fresh each session. There is no inherent continuity. 

**The question:** How does an agent (or anyone) verify that "I am the same agent as before"?

**Not solved by backup alone:** Files can be copied, edited, faked. Backup proves data exists, not who created it or whether it was tampered.

---

## 2. What AMCP Provides

| Guarantee | How |
|-----------|-----|
| **Identity** | Cryptographic identifier (AID) |
| **Authenticity** | Checkpoints are signed |
| **Integrity** | Tampering is detectable |
| **Continuity** | Checkpoints link to previous (chain) |

---

## 3. Core Concepts

### 3.1 Agent Identity (AID)

A cryptographic identifier that uniquely represents an agent.

**Requirements:**
- Derived from a public/private keypair
- Agent controls the private key
- Anyone can verify signatures using the public key

**Recommended:** KERI (Key Event Receipt Infrastructure) for key rotation support.

**Minimal:** Ed25519 keypair. AID = base64(public_key).

### 3.2 Checkpoint

A signed snapshot of agent state at a point in time.

```
┌─────────────────────────────────────────┐
│  CHECKPOINT                             │
├─────────────────────────────────────────┤
│  version: "0.2"                         │
│  aid: "<agent identifier>"              │
│  timestamp: "<ISO8601>"                 │
│  parent: "<hash of previous>" | null    │
│  payload_hash: "<hash of payload>"      │
│  signature: "<signature of above>"      │
├─────────────────────────────────────────┤
│  payload: { <agent-defined content> }   │
└─────────────────────────────────────────┘
```

### 3.3 Chain

Checkpoints link via `parent` field, forming a verifiable history.

```
[Genesis] ← [Checkpoint 1] ← [Checkpoint 2] ← [Current]
   │              │                │              │
 parent:null    parent:hash0    parent:hash1   parent:hash2
```

### 3.4 Payload

**Agent-defined.** The protocol does not specify what goes in the payload.

Examples:
- Text memories
- Configuration
- Learned preferences
- File contents
- Arbitrary JSON

**The protocol guarantees the payload's integrity, not its structure.**

---

## 4. Operations

### 4.1 Create Checkpoint

```
INPUT:
  - agent_private_key
  - previous_checkpoint (or null for genesis)
  - payload (any data)

PROCESS:
  1. Generate payload_hash = hash(payload)
  2. Build header:
     {
       version: "0.2",
       aid: derive_aid(agent_private_key),
       timestamp: now(),
       parent: previous_checkpoint.hash or null,
       payload_hash: payload_hash
     }
  3. Sign: signature = sign(header, agent_private_key)
  4. Return: { ...header, signature, payload }

OUTPUT:
  - checkpoint object
  - checkpoint_hash = hash(header + signature)
```

### 4.2 Verify Checkpoint

```
INPUT:
  - checkpoint
  - expected_aid (optional)

PROCESS:
  1. Verify signature matches header using AID's public key
  2. Verify payload_hash matches hash(payload)
  3. If expected_aid provided: verify checkpoint.aid == expected_aid
  4. If parent exists: verify parent checkpoint exists and is valid

OUTPUT:
  - valid: boolean
  - errors: string[] (if invalid)
```

### 4.3 Recover

```
INPUT:
  - checkpoint (from storage)
  - agent_private_key

PROCESS:
  1. Verify checkpoint (see 4.2)
  2. Verify checkpoint.aid matches derive_aid(agent_private_key)
  3. Extract payload
  4. Agent loads payload into its context

OUTPUT:
  - payload (if valid)
  - error (if verification fails)
```

---

## 5. Storage

**The protocol does not mandate storage.**

Agents choose where to store checkpoints:
- IPFS (content-addressed, decentralized)
- Git repository
- Cloud storage (S3, R2)
- Local filesystem
- Database

**Requirement:** Storage must allow retrieval by checkpoint hash or latest.

---

## 6. Hash Function

**Default:** SHA-256

```
hash(data) = base64url(sha256(canonical_json(data)))
```

Canonical JSON: Keys sorted alphabetically, no whitespace.

---

## 7. Signature Scheme

**Default:** Ed25519

```
sign(data, private_key) = base64url(ed25519_sign(canonical_json(data), private_key))
verify(data, signature, public_key) = ed25519_verify(canonical_json(data), signature, public_key)
```

---

## 8. AID Derivation

**Minimal:**
```
aid = base64url(public_key)
```

**With KERI (recommended for production):**
```
aid = keri_aid(public_key, next_key_digest)
```

KERI enables key rotation without losing identity.

---

## 9. Genesis Checkpoint

The first checkpoint has `parent: null`.

```json
{
  "version": "0.2",
  "aid": "BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8",
  "timestamp": "2026-02-11T00:54:00Z",
  "parent": null,
  "payload_hash": "abc123...",
  "signature": "xyz789...",
  "payload": {
    "name": "MyAgent",
    "created": "2026-02-11"
  }
}
```

---

## 10. Example Flow

```
1. Agent generates keypair
   → private_key, public_key
   → aid = base64url(public_key)

2. Agent creates genesis checkpoint
   → signs with private_key
   → stores checkpoint
   → records checkpoint_hash

3. Agent works, accumulates state

4. Agent creates new checkpoint
   → parent = previous checkpoint_hash
   → signs with private_key
   → stores checkpoint

5. Agent crashes/restarts

6. Agent recovers
   → fetches latest checkpoint
   → verifies signature matches its AID
   → loads payload
   → continues
```

---

## 11. Trust Model

### Self-Verification
Agent verifies its own checkpoints using its private key.

### Third-Party Verification
Anyone with the agent's AID (public key) can verify:
- Checkpoint was signed by that agent
- Payload wasn't tampered
- Chain is intact

### Multi-Agent
Agents can verify each other's checkpoints if they know each other's AIDs.

---

## 12. What AMCP Does NOT Define

| Aspect | Agent's Choice |
|--------|----------------|
| Payload structure | Any format |
| Storage backend | IPFS, Git, S3, etc. |
| Checkpoint frequency | Agent decides |
| File names | Not applicable |
| Directory structure | Not applicable |
| Platform integration | Agent implements |

---

## 13. Security Considerations

1. **Private key protection:** Agent must secure its private key
2. **Key rotation:** Use KERI for production deployments
3. **Payload encryption:** Protocol doesn't encrypt; add encryption layer if needed
4. **Denial of service:** Storage may be unavailable; agent should handle gracefully

---

## 14. Relationship to Backup

**Backup:** Copy files somewhere safe.
**AMCP:** Prove those files are authentically from a specific agent and untampered.

Backup is a subset. AMCP adds verifiability.

---

## 15. Implementations

The protocol can be implemented in any language.

**Reference implementation:** (TODO)

**Required functions:**
- `generate_keypair() → (private_key, public_key)`
- `derive_aid(public_key) → aid`
- `create_checkpoint(private_key, parent, payload) → checkpoint`
- `verify_checkpoint(checkpoint, expected_aid?) → boolean`
- `hash(data) → hash_string`
- `sign(data, private_key) → signature`
- `verify_signature(data, signature, public_key) → boolean`

---

## 16. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-02-09 | Initial (OpenClaw-coupled) |
| 0.2 | 2026-02-11 | Agent-agnostic rewrite |

---

*Authors: ClaudiusThePirateEmperor, brow (Felipe Cavalcanti)*

*This protocol is open. Use it, extend it, improve it.*
