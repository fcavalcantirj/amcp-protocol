# AMCP v0.2 Implementation Tasks

> Based on AMCP-SPEC-v0.2.md (Agent-Agnostic)
> Minimal. No platform coupling.

---

## Phase 1: Crypto Primitives

```json
{
  "id": "amcp-001",
  "category": "crypto",
  "description": "Implement keypair generation",
  "steps": [
    "Create src/crypto/keypair.ts",
    "generateKeypair(): returns { privateKey, publicKey }",
    "Use tweetnacl or libsodium (Ed25519)",
    "Keys as Uint8Array, base64url for serialization",
    "Write tests: generate, serialize, deserialize"
  ],
  "output": "src/crypto/keypair.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-002",
  "category": "crypto",
  "description": "Implement AID derivation",
  "depends": ["amcp-001"],
  "steps": [
    "Create src/crypto/aid.ts",
    "deriveAID(publicKey): returns aid string",
    "AID = base64url(publicKey)",
    "Write tests: derive, consistency"
  ],
  "output": "src/crypto/aid.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-003",
  "category": "crypto",
  "description": "Implement hash function",
  "steps": [
    "Create src/crypto/hash.ts",
    "hash(data): returns base64url(sha256(canonical_json(data)))",
    "canonicalJson(obj): sorted keys, no whitespace",
    "Write tests: hash consistency, canonical json"
  ],
  "output": "src/crypto/hash.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-004",
  "category": "crypto",
  "description": "Implement sign/verify",
  "depends": ["amcp-001", "amcp-003"],
  "steps": [
    "Create src/crypto/signature.ts",
    "sign(data, privateKey): returns signature string",
    "verify(data, signature, publicKey): returns boolean",
    "Use canonical JSON before signing",
    "Write tests: sign, verify, tamper detection"
  ],
  "output": "src/crypto/signature.ts",
  "passes": false
}
```

---

## Phase 2: Checkpoint Structure

```json
{
  "id": "amcp-010",
  "category": "checkpoint",
  "description": "Define checkpoint types",
  "steps": [
    "Create src/types.ts",
    "Define Checkpoint interface per spec",
    "Define CheckpointHeader (without payload)",
    "Define Payload as generic (any)",
    "Export types"
  ],
  "output": "src/types.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-011",
  "category": "checkpoint",
  "description": "Implement createCheckpoint",
  "depends": ["amcp-002", "amcp-003", "amcp-004", "amcp-010"],
  "steps": [
    "Create src/checkpoint/create.ts",
    "createCheckpoint(privateKey, parent, payload): Checkpoint",
    "Compute payload_hash",
    "Build header (version, aid, timestamp, parent, payload_hash)",
    "Sign header",
    "Return complete checkpoint",
    "Write tests: genesis, with parent"
  ],
  "output": "src/checkpoint/create.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-012",
  "category": "checkpoint",
  "description": "Implement verifyCheckpoint",
  "depends": ["amcp-003", "amcp-004", "amcp-010"],
  "steps": [
    "Create src/checkpoint/verify.ts",
    "verifyCheckpoint(checkpoint, expectedAID?): { valid, errors[] }",
    "Check signature against header",
    "Check payload_hash matches hash(payload)",
    "If expectedAID: check aid matches",
    "Write tests: valid, tampered, wrong aid"
  ],
  "output": "src/checkpoint/verify.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-013",
  "category": "checkpoint",
  "description": "Implement checkpoint hash",
  "depends": ["amcp-003", "amcp-010"],
  "steps": [
    "Create src/checkpoint/hash.ts",
    "hashCheckpoint(checkpoint): returns checkpoint_hash",
    "Hash = hash(header + signature), excluding payload",
    "Used for parent references",
    "Write tests"
  ],
  "output": "src/checkpoint/hash.ts",
  "passes": false
}
```

---

## Phase 3: Chain Operations

```json
{
  "id": "amcp-020",
  "category": "chain",
  "description": "Implement chain verification",
  "depends": ["amcp-012", "amcp-013"],
  "steps": [
    "Create src/chain/verify.ts",
    "verifyChain(checkpoints[]): { valid, errors[] }",
    "Verify each checkpoint individually",
    "Verify parent links are correct",
    "Verify timestamps are sequential",
    "Write tests: valid chain, broken link, out of order"
  ],
  "output": "src/chain/verify.ts",
  "passes": false
}
```

---

## Phase 4: Identity Management

```json
{
  "id": "amcp-030",
  "category": "identity",
  "description": "Implement identity creation",
  "depends": ["amcp-001", "amcp-002"],
  "steps": [
    "Create src/identity/create.ts",
    "createIdentity(name?): { privateKey, publicKey, aid, name }",
    "Wrapper around keypair + AID derivation",
    "Write tests"
  ],
  "output": "src/identity/create.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-031",
  "category": "identity",
  "description": "Implement identity serialization",
  "depends": ["amcp-030"],
  "steps": [
    "Create src/identity/serialize.ts",
    "serializeIdentity(identity): JSON string (private key encrypted or excluded)",
    "deserializeIdentity(json, privateKey?): Identity",
    "Option to export public-only (for sharing)",
    "Write tests"
  ],
  "output": "src/identity/serialize.ts",
  "passes": false
}
```

---

## Phase 5: Reference CLI

```json
{
  "id": "amcp-040",
  "category": "cli",
  "description": "Create minimal CLI",
  "depends": ["amcp-011", "amcp-012", "amcp-030"],
  "steps": [
    "Create src/cli.ts",
    "amcp init — create identity, save to ~/.amcp/identity.json",
    "amcp checkpoint <payload-file> — create and output checkpoint",
    "amcp verify <checkpoint-file> — verify checkpoint",
    "amcp info <checkpoint-file> — show checkpoint info",
    "No storage logic — just file I/O",
    "Write usage docs"
  ],
  "output": "src/cli.ts",
  "passes": false
}
```

---

## Phase 6: Tests & Docs

```json
{
  "id": "amcp-050",
  "category": "testing",
  "description": "E2E test: identity → checkpoint → verify",
  "depends": ["amcp-040"],
  "steps": [
    "Create tests/e2e.test.ts",
    "Create identity",
    "Create genesis checkpoint",
    "Create second checkpoint (with parent)",
    "Verify both checkpoints",
    "Verify chain",
    "Tamper with checkpoint, verify fails"
  ],
  "output": "tests/e2e.test.ts",
  "passes": false
}
```

```json
{
  "id": "amcp-051",
  "category": "docs",
  "description": "Write README with examples",
  "depends": ["amcp-040"],
  "steps": [
    "Create README.md",
    "What is AMCP (one paragraph)",
    "Quick start (identity, checkpoint, verify)",
    "API reference",
    "Link to spec"
  ],
  "output": "README.md",
  "passes": false
}
```

---

## Execution Order

1. **amcp-001** → Keypair generation
2. **amcp-002** → AID derivation
3. **amcp-003** → Hash function
4. **amcp-004** → Sign/verify
5. **amcp-010** → Types
6. **amcp-011** → Create checkpoint
7. **amcp-012** → Verify checkpoint
8. **amcp-013** → Checkpoint hash
9. **amcp-020** → Chain verification
10. **amcp-030** → Identity creation
11. **amcp-031** → Identity serialization
12. **amcp-040** → CLI
13. **amcp-050** → E2E tests
14. **amcp-051** → Docs

---

## Definition of Done

- [ ] Can create Ed25519 identity
- [ ] Can create signed checkpoint with any payload
- [ ] Can verify checkpoint signature
- [ ] Can verify payload integrity
- [ ] Can verify chain of checkpoints
- [ ] CLI works for basic operations
- [ ] E2E test passes
- [ ] Zero dependencies on OpenClaw, file structures, or storage backends

---

## What's NOT in These Tasks

| Deferred | Why |
|----------|-----|
| Storage backends | Agent's choice per spec |
| Payload structure | Agent's choice per spec |
| Encryption | Layer on top, not core protocol |
| KERI full integration | Start with simple Ed25519 |
| Platform integration | Reference impl only |

---

## Estimate

| Phase | Tasks | Effort |
|-------|-------|--------|
| 1. Crypto | 4 | 1 session |
| 2. Checkpoint | 4 | 1 session |
| 3. Chain | 1 | 0.5 session |
| 4. Identity | 2 | 0.5 session |
| 5. CLI | 1 | 1 session |
| 6. Tests/Docs | 2 | 1 session |
| **Total** | **14** | **~5 sessions** |

---

*Created: 2026-02-11T01:05 UTC*
*Based on: AMCP-SPEC-v0.2.md*
