# AMCP Middleware Specification — Draft v0.1

> Source: Felipe + Claudius synthesis, 2026-02-09
> Status: Design draft, not yet implemented

## Design Principles

1. **Determinism** — All operations yield consistent outputs for given inputs
2. **Cross-Platform** — Aligns with LangChain/Anthropic tool schemas, JSON I/O
3. **Fail-Closed** — Any ambiguity results in denial
4. **Auditability** — Every call logs provenance, stored immutably

---

## Core Operations

### 1. Signing
```typescript
sign(
  data: Buffer,
  keyHandle: OpaqueHandle,
  options: { algorithm: 'Ed25519' | 'RSA-PSS' }
) -> Signature
```

### 2. Verification
```typescript
verify(
  signature: Buffer,
  data: Buffer,
  publicKey: PublicKey
) -> Boolean
```

### 3. Key Derivation
```typescript
deriveSessionKey(
  baseKey: OpaqueHandle,
  params: { salt: Buffer, info: string }
) -> OpaqueHandle  // HKDF, inherits parent scopes
```

### 4. Delegation (UCAN-style)
```typescript
delegate(
  capabilities: Capability[],  // (resource, action, constraints)
  recipient: DID,
  expiration: Timestamp,
  proofs: UCANChain
) -> UCANToken
```

### 5. Delegation Verification
```typescript
verifyDelegation(
  chain: UCANChain,
  capability: Capability
) -> { valid: Boolean, reason: ErrorCode }
```

### 6. Revocation Check
```typescript
checkRevocation(ucanCID: CID) -> Boolean
```

### 7. Audit Log
```typescript
getAuditLog(sessionID: string) -> LogEntry[]
```

### 8. Capability Introspection (proposed addition)
```typescript
listCapabilities(keyHandle: OpaqueHandle) -> Capability[]
canPerform(keyHandle: OpaqueHandle, action: string, resource: string) -> Boolean
checkCapability(capability: Capability) -> Boolean  // preemptive check
```

---

## Comparison with Prior Art

| Operation | PKCS#11 | SPIFFE/SPIRE | Web Crypto API | UCAN |
|-----------|---------|--------------|----------------|------|
| Sign | C_Sign | N/A | subtle.sign | Implicit in token |
| Verify | C_Verify | Workload validation | subtle.verify | Chain validation |
| Derive Key | C_DeriveKey | N/A | subtle.deriveKey | N/A |
| Delegate | N/A | SVID (limited) | N/A | Core: attenuation |
| Revoke | C_DestroyObject | Server revocation | N/A | Revocation spec |

**Synthesis:** PKCS#11 handles for opacity + SPIFFE API for identity + UCAN chains for delegation

---

## Visibility vs Opacity

### LLM Can See (for reasoning)
- Public keys
- Delegation scopes (summaries)
- Capability metadata
- Expiration times

### LLM Cannot See (opaque)
- Private keys (handles only, like Web Crypto CryptoKey)
- Internal states (nonces, salts)
- Full delegation chain proofs (redacted to summaries)

**Pattern:** LLM sees "you have write access to memory:public until 2026-03-01" — enough to reason, not enough to forge.

---

## Error Codes

```typescript
enum ErrorCode {
  SUCCESS = 0,
  DENY_INVALID_INPUT = 1,
  DENY_EXPIRED = 2,
  DENY_INVALID_SCOPE = 3,
  DENY_REVOKED = 4,
  INTERNAL_ERROR = 99  // generic, details logged internally
}

interface Response<T> {
  status: ErrorCode
  result: T | null
  metadata: { timestamp: Timestamp }
}
```

No strings in errors — prevents state leakage through error messages.

---

## State Model

### Stateless Core
- Pure functions: `verify()`, `sign()` (given all inputs)
- Portable across platforms
- Inputs include full context (e.g., complete chains)

### Stateful Sessions
- Multi-step operations (delegation chains, audits)
- Opaque session IDs, auto-expiring
- State in secure enclaves or databases
- Serializable as tokens for cross-platform

---

## Prompt Injection Mitigation

| Technique | Description | Effectiveness |
|-----------|-------------|---------------|
| Input Validation | JSON Schema enforcement | High |
| Signed Prompts | Cryptographic verification of intent | Medium-High |
| Tool Restrictions | Scoped access via UCAN capabilities | High |
| Monitoring | Anomaly detection in call patterns | Medium |
| Prompt Fencing | Signed metadata ("trusted" vs "untrusted") | Medium-High |

**Defense in depth:** Even injected prompts fail schema validation before reaching crypto ops.

---

## Integration Requirements

- **Transport:** gRPC or JSON-RPC, compatible with OpenClaw/LangChain
- **UCAN:** Full chain handling with attenuation and revocation
- **Audit:** CID-linked log entries, verifiable via proofs
- **Default:** Fail-closed on any validation failure

---

## Future Directions

1. **ZKP Integration** — Prove operations occurred without revealing state (connects to BAID zkVM)
2. **Decentralized Middleware** — Consensus on governance decisions (fork handling)
3. **Hardware Security Modules** — HSM backing for high-value keys

---

## Open Questions

1. How does middleware handle agent forks? (New identity? Inherited capabilities?)
2. Session state migration between providers?
3. Revocation propagation latency vs. security tradeoff?
4. Standardized capability vocabulary for agents?

---

---

## References

### Security & Vulnerabilities
- [Can LLMs Hack Enterprise Networks?](https://arxiv.org/html/2502.04227v3) — arXiv 2502.04227
- [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)

### Agent Architectures
- [Large Model Based Agents: State-of-the-Art, Cooperation Paradigms, Security and Privacy](https://arxiv.org/html/2409.14457v2) — arXiv 2409.14457
- [Agentic AI Frameworks: Architectures, Protocols, and Design Challenges](https://arxiv.org/html/2508.10146v1) — arXiv 2508.10146
- [Agent Middleware: Adding Control and Observability](https://newsletter.victordibia.com/p/agent-middleware-adding-control-and) — Victor Dibia

### Delegation & Identity
- **[Agentic JWT: Secure Delegation Protocol for Autonomous AI Agents](https://arxiv.org/abs/2509.13597)** — arXiv 2509.13597 ⭐ CRITICAL
- [UCAN Delegation Spec](https://github.com/ucan-wg/delegation) — ucan-wg/delegation

### Cryptographic Standards
- [PKCS#11 v2.40](https://docs.oasis-open.org/pkcs11/pkcs11-base/v2.40/os/pkcs11-base-v2.40-os.html) — OASIS
- [SPIRE Concepts](https://spiffe.io/docs/latest/spire-about/spire-concepts) — SPIFFE
- [Web Cryptography Level 2](https://www.w3.org/TR/webcrypto-2) — W3C

---

*This spec synthesizes PKCS#11, SPIFFE/SPIRE, Web Crypto API, and UCAN patterns for LLM agent environments.*
