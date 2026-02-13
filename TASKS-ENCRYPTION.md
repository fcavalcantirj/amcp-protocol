# AMCP Encryption — Task Breakdown

> SPEC FIRST. Then validate. Then build.

---

## Phase 1: Research & Specification

```json
{
  "id": "enc-001",
  "category": "research",
  "description": "Research encryption patterns for content-addressed storage",
  "steps": [
    "Search for IPFS encryption patterns (Ceramic, Textile, OrbitDB)",
    "Research KERI key usage for encryption (signing vs encryption keys)",
    "Document: Can we derive encryption key from KERI signing key?",
    "Research envelope encryption (symmetric + asymmetric hybrid)",
    "Document findings in research/AMCP-encryption-research.md"
  ],
  "output": "research/AMCP-encryption-research.md",
  "passes": false
}
```

```json
{
  "id": "enc-002",
  "category": "spec",
  "description": "Write encryption specification document",
  "depends": ["enc-001"],
  "steps": [
    "Define EncryptedCheckpoint schema (ciphertext, nonce, keyEnvelopes)",
    "Define KeyEnvelope schema (recipientAID, encryptedKey)",
    "Define public vs private checkpoint flag",
    "Define key derivation method (from KERI or separate keypair)",
    "Define human key delivery mechanism",
    "Write spec in docs/AMCP-encryption-spec.md"
  ],
  "output": "docs/AMCP-encryption-spec.md",
  "passes": false
}
```

```json
{
  "id": "enc-003",
  "category": "spec-validation",
  "description": "Validate encryption spec with threat model",
  "depends": ["enc-002"],
  "steps": [
    "List threat actors: public IPFS readers, malicious agents, compromised storage",
    "Verify spec protects against: unauthorized read, key leakage, replay attacks",
    "Review with Phil (agent_Phil) for multi-agent perspective",
    "Document gaps and mitigations",
    "Update spec if needed"
  ],
  "output": "docs/AMCP-encryption-spec.md (updated)",
  "passes": false
}
```

---

## Phase 2: Core Encryption Implementation

```json
{
  "id": "enc-010",
  "category": "core",
  "description": "Create symmetric encryption module",
  "depends": ["enc-003"],
  "steps": [
    "Create packages/amcp-crypto/src/symmetric.ts",
    "Implement generateKey(): returns 256-bit key",
    "Implement encrypt(data, key): returns {ciphertext, nonce}",
    "Implement decrypt(ciphertext, nonce, key): returns data",
    "Use libsodium or tweetnacl (no heavy deps)",
    "Write tests: encrypt → decrypt roundtrip"
  ],
  "output": "packages/amcp-crypto/src/symmetric.ts",
  "passes": false
}
```

```json
{
  "id": "enc-011",
  "category": "core",
  "description": "Create asymmetric key envelope module",
  "depends": ["enc-010"],
  "steps": [
    "Create packages/amcp-crypto/src/envelope.ts",
    "Implement createEnvelope(symmetricKey, recipientPublicKey): returns encrypted key",
    "Implement openEnvelope(encryptedKey, recipientPrivateKey): returns symmetric key",
    "Use X25519 for key exchange (compatible with Ed25519 KERI keys)",
    "Write tests: wrap → unwrap roundtrip"
  ],
  "output": "packages/amcp-crypto/src/envelope.ts",
  "passes": false
}
```

```json
{
  "id": "enc-012",
  "category": "core",
  "description": "Create EncryptedCheckpoint type and serialization",
  "depends": ["enc-011"],
  "steps": [
    "Create packages/amcp-crypto/src/encrypted-checkpoint.ts",
    "Define EncryptedCheckpoint interface per spec",
    "Implement encryptCheckpoint(checkpoint, recipients[]): returns EncryptedCheckpoint",
    "Implement decryptCheckpoint(encrypted, privateKey): returns Checkpoint",
    "Write tests: full roundtrip with single recipient"
  ],
  "output": "packages/amcp-crypto/src/encrypted-checkpoint.ts",
  "passes": false
}
```

---

## Phase 3: Key Management

```json
{
  "id": "enc-020",
  "category": "key-management",
  "description": "Derive encryption keypair from KERI identity",
  "depends": ["enc-012"],
  "steps": [
    "Research Ed25519 to X25519 key conversion",
    "Implement deriveEncryptionKeys(keriPrivateKey): returns {publicKey, privateKey}",
    "Store derived keys in identity.json (or derive on-the-fly)",
    "Write tests: derive → use for envelope"
  ],
  "output": "packages/amcp-crypto/src/key-derivation.ts",
  "passes": false
}
```

```json
{
  "id": "enc-021",
  "category": "key-management",
  "description": "Human key delivery - checkpoint output",
  "depends": ["enc-020"],
  "steps": [
    "Modify checkpoint.ts to accept --encrypt flag",
    "When encrypted: print symmetric key to console",
    "Store key in AgentMemory vault: AMCP_CHECKPOINT_KEY_{CID}",
    "Print: 'Key stored in AgentMemory. Also printed below for backup.'",
    "Add key to checkpoint metadata (for self-recovery)"
  ],
  "output": "scripts/checkpoint.ts (updated)",
  "passes": false
}
```

```json
{
  "id": "enc-022",
  "category": "key-management",
  "description": "Human key delivery - heartbeat reporting",
  "depends": ["enc-021"],
  "steps": [
    "Update HEARTBEAT.md section for AMCP",
    "On heartbeat: report last checkpoint CID",
    "On heartbeat: report key location (AgentMemory secret name)",
    "Do NOT print key in heartbeat (security)",
    "Print: 'Last checkpoint: {CID}, key: AMCP_CHECKPOINT_KEY_{short_cid}'"
  ],
  "output": "HEARTBEAT.md (updated)",
  "passes": false
}
```

---

## Phase 4: Selective Sharing

```json
{
  "id": "enc-030",
  "category": "selective-sharing",
  "description": "Multi-recipient encryption",
  "depends": ["enc-012"],
  "steps": [
    "Extend encryptCheckpoint to accept multiple recipient AIDs",
    "Create one KeyEnvelope per recipient",
    "Each recipient can decrypt with their own key",
    "Write tests: 2 recipients, each can decrypt"
  ],
  "output": "packages/amcp-crypto/src/encrypted-checkpoint.ts (updated)",
  "passes": false
}
```

```json
{
  "id": "enc-031",
  "category": "selective-sharing",
  "description": "Resolve recipient AID to public key",
  "depends": ["enc-030"],
  "steps": [
    "Create resolveAIDPublicKey(aid): returns encryptionPublicKey",
    "For known agents: lookup from local registry",
    "For Solvr agents: fetch from Solvr API (if exposed)",
    "Fallback: require explicit public key input",
    "Write tests: resolve my own AID, resolve Phil's AID"
  ],
  "output": "packages/amcp-crypto/src/aid-resolver.ts",
  "passes": false
}
```

---

## Phase 5: Integration - Checkpoint Script

```json
{
  "id": "enc-040",
  "category": "integration",
  "description": "Add --encrypt and --public flags to checkpoint.ts",
  "depends": ["enc-021"],
  "steps": [
    "Add CLI flags: --encrypt (default true), --public (no encryption)",
    "If --public: current behavior (plaintext)",
    "If --encrypt: encrypt with own AID as recipient",
    "Print key delivery info after checkpoint",
    "Update help text"
  ],
  "output": "scripts/checkpoint.ts (updated)",
  "passes": false
}
```

```json
{
  "id": "enc-041",
  "category": "integration",
  "description": "Add --share-with flag to checkpoint.ts",
  "depends": ["enc-040", "enc-031"],
  "steps": [
    "Add CLI flag: --share-with AID1,AID2",
    "Resolve each AID to public key",
    "Create KeyEnvelope for each recipient",
    "Print: 'Shared with: AID1, AID2'",
    "Write integration test"
  ],
  "output": "scripts/checkpoint.ts (updated)",
  "passes": false
}
```

---

## Phase 6: Integration - Resuscitation

```json
{
  "id": "enc-050",
  "category": "integration",
  "description": "Update resuscitate.ts to handle encrypted checkpoints",
  "depends": ["enc-040"],
  "steps": [
    "Detect if checkpoint is encrypted (check for ciphertext field)",
    "If encrypted: prompt for key or fetch from AgentMemory",
    "Decrypt checkpoint before loading",
    "Verify signature after decryption",
    "Write integration test"
  ],
  "output": "scripts/resuscitate.ts (updated)",
  "passes": false
}
```

```json
{
  "id": "enc-051",
  "category": "integration",
  "description": "Add --key flag to resuscitate.ts",
  "depends": ["enc-050"],
  "steps": [
    "Add CLI flag: --key <symmetric_key>",
    "If provided: use for decryption",
    "If not provided: try AgentMemory vault lookup",
    "If not in vault: prompt human or fail with clear message",
    "Update help text"
  ],
  "output": "scripts/resuscitate.ts (updated)",
  "passes": false
}
```

---

## Phase 7: Auto-Recovery Integration

```json
{
  "id": "enc-060",
  "category": "auto-recovery",
  "description": "Design proactive-amcp auto-recovery flow with encryption",
  "depends": ["enc-051"],
  "steps": [
    "Document: How does proactive-amcp get the key on session start?",
    "Option A: Key in AgentMemory (auto-fetch)",
    "Option B: Key in OpenClaw config (less secure)",
    "Option C: Key derived from master secret",
    "Write decision in docs/proactive-amcp-design.md"
  ],
  "output": "docs/proactive-amcp-design.md",
  "passes": false
}
```

```json
{
  "id": "enc-061",
  "category": "auto-recovery",
  "description": "Implement key auto-fetch in resuscitate.ts",
  "depends": ["enc-060"],
  "steps": [
    "On resuscitate: extract CID from checkpoint reference",
    "Construct secret name: AMCP_CHECKPOINT_KEY_{short_cid}",
    "Fetch from AgentMemory vault",
    "If found: auto-decrypt",
    "If not found: fail with 'Key not in vault, provide --key'"
  ],
  "output": "scripts/resuscitate.ts (updated)",
  "passes": false
}
```

---

## Execution Order

1. **enc-001** → Research encryption patterns
2. **enc-002** → Write spec
3. **enc-003** → Validate spec (can parallelize with Phil review)
4. **enc-010** → Symmetric encryption
5. **enc-011** → Asymmetric envelopes
6. **enc-012** → EncryptedCheckpoint type
7. **enc-020** → Key derivation from KERI
8. **enc-021** → Human key delivery (checkpoint)
9. **enc-022** → Heartbeat reporting
10. **enc-030** → Multi-recipient
11. **enc-031** → AID resolver
12. **enc-040** → Checkpoint --encrypt flag
13. **enc-041** → Checkpoint --share-with flag
14. **enc-050** → Resuscitate encryption support
15. **enc-051** → Resuscitate --key flag
16. **enc-060** → Design proactive-amcp key flow
17. **enc-061** → Auto-fetch key from vault

---

## Definition of Done

- [ ] Private checkpoints are encrypted before IPFS upload
- [ ] Only I (and specified recipients) can decrypt
- [ ] Human can retrieve key from AgentMemory vault
- [ ] Resuscitation works with encrypted checkpoints
- [ ] Heartbeat reports checkpoint status (not key)
- [ ] Phil can receive a shared checkpoint and decrypt it

---

*Created: 2026-02-11T00:05 UTC*
*Author: ClaudiusThePirateEmperor*
