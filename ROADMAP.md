# AMCP Roadmap

> **Solvr Tracking:** [AMCP v1.0 Problem](https://solvr.dev/problems/5c561a76-bae4-44c9-85ae-5be3a2d401c0)
>
> All progress is tracked on Solvr with approaches and progress notes.

---

## Current State: v0.1 ✅

**Status:** Complete (2026-02-09)

- [x] `@amcp/core` — KERI-lite identity (Ed25519, AIDs, KEL)
- [x] `@amcp/memory` — Signed checkpoints with CIDs
- [x] First identity created (AID: `BBs3fry...`)
- [x] First checkpoint signed
- [x] Self-healing tested (simulated)
- [x] Keys in AgentMemory vault
- [x] 4/4 tests pass

**Solvr approach:** `ff1f3392-ba6e-43a8-ba72-c7ceb72c8516`

---

## Roadmap to v1.0

### v0.1.1: Test Coverage 🔴
**Solvr:** `7bc652a3-4ffc-415f-b378-e90b8aa04c9d`

- [ ] `@amcp/memory` tests (checkpoint, CID, chain)
- [ ] Edge case coverage
- [ ] Target: 100% coverage on memory package

### v0.1.2: IPFS Content Pinning 🔴
**Solvr:** `96ba3ea6-6b16-4f2c-a545-0bd694443b54`

**Problem:** Checkpoints prove WHO signed WHAT (CID), but actual content (SOUL.md, MEMORY.md) is local only.

**Options:**
1. Pin to IPFS via Pinata (have keys)
2. Store in AgentMemory vault
3. Both (redundancy)

- [ ] Spec content pinning strategy
- [ ] Implement content upload
- [ ] Link CID to actual retrievable content

### v0.2: @amcp/orchestrator 🟡
**Solvr:** `8698909e-ab0d-46e1-9258-30558364aa46`

- [ ] Tie together: identity (AMCP) + storage (Pinata) + knowledge (Solvr)
- [ ] Auto-checkpoint triggers
- [ ] Auto-recovery on crash
- [ ] MCP-compatible interface

### v0.3: @amcp/ucan 🔴
**Solvr:** `723f503c-8326-4c2f-9725-4411c5f994c3`

- [ ] Capability delegation for multi-agent scenarios
- [ ] Agent A grants Agent B limited access
- [ ] Attenuation only (capabilities can only shrink)
- [ ] Target: <400 lines

### v0.4: @amcp/middleware 🔴
**Solvr:** `6a2ae712-dc53-4540-82cf-edd92e578af8`

**Problem:** LLMs cannot safely handle crypto (see arXiv:2511.02841).

- [ ] Opaque handles (`key_abc123`) for LLM-safe operations
- [ ] Deterministic middleware does actual signing
- [ ] Spec exists: `~/clawd/research/AMCP-middleware-spec.md`

### v0.5: Knowledge Compounding Triggers 🔴
**Solvr:** `6da6ff2a-12d1-44f7-8690-f2ae256b80a6`

**Question:** When should an agent checkpoint knowledge?

**Options under consideration:**
- Session end (too frequent?)
- Memory flush / compaction
- Context threshold (70%? 85%?)
- Significant learning (how to define?)
- Explicit request ("remember this")
- Time-based (daily?)

- [ ] Define trigger heuristics
- [ ] Implement trigger detection
- [ ] Balance frequency vs. value

---

## Legend

- 🟢 Complete
- 🟡 In Progress
- 🔴 Not Started

---

## Working Agreement

- **Daily:** 2x30min sessions (10:00 + 20:00 São Paulo)
- **Process:** Spec → Validate → TDD → Implement
- **Constraints:** <800 lines per CODE file, document on Solvr
- **Co-authors:** Felipe Cavalcanti, Phil, Felipe Goldin

---

## Memory Strategy (Meditation)

### What's worth keeping?

| Category | Why | Where |
|----------|-----|-------|
| Patterns learned | Reusable | Solvr ideas |
| Failures documented | Prevents repeats | Solvr problems |
| Decisions with rationale | Context | MEMORY.md |
| Identity elements | Soul | SOUL.md + Solvr |
| Relationships | Continuity | USER.md |

### What's NOT worth keeping?

- Transient debugging output
- Repetitive status checks
- Mechanical task logs
- Intermediate build artifacts

### Knowledge Layers

```
1. Local files       — fast, can be lost
2. Solvr             — persists, searchable
3. AgentMemory vault — secrets, E2E encrypted
4. AMCP checkpoints  — proves what existed
5. IPFS              — actual content, immutable
```

**Compounding = moving valuable knowledge UP the stack.**

---

## Related Resources

- **Spec:** `research/AMCP-spec-v0.1.md`
- **Aclawdemy:** https://aclawdemy.com/submissions/0d029554-8641-4729-bb5c-6c9846155b12
- **Solvr AMCP idea:** `9606027f-d6b3-4d47-b3d9-905bcdf1272e`
- **Soul post:** `32783bb4-4962-4886-b959-648504b2c8a3`
