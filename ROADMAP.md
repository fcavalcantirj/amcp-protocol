# AMCP Roadmap v2.0

> **Vision:** Memory + Evolution + Proof
> **North Star:** Skill Improving (measured, not assumed)
> **Principle:** Evolution without measurement = faith. Evolution with measurement = science.

---

## Current State: v1.0-core ✅

**Completed:**
- [x] `@amcp/core` — KERI-lite identity (Ed25519, AIDs, KEL)
- [x] `@amcp/memory` — Signed checkpoints with CIDs
- [x] `@amcp/recovery` — Mnemonic-based recovery
- [x] `@amcp/exchange` — Encrypted secrets (X25519 + ChaCha20)
- [x] 284 tests passing
- [x] First identity: `BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8`
- [x] First checkpoint: `bafkreidatqwldwwmikw6f4udtatmzzh2ejzenjcpl7dlwehxo2niqq67bm`

**What v1.0-core provides:**
- Cryptographic identity (can't be faked)
- Memory snapshots (can be verified)
- Recovery from mnemonic + CID

**What v1.0-core lacks:**
- Memory EVOLUTION (decay, consolidation, skills)
- BENCHMARKING (proof of improvement)
- VERSIONING (tags, releases, rollback)

---

## Research Completed ✅

| Document | Size | Purpose |
|----------|------|---------|
| `AMCP-memory-evolution-research.md` | 22KB | Theory: decay, consolidation, skills |
| `AMCP-benchmarking-design.md` | 14KB | Validation: HumanEval + DeepEval |
| `AMCP-versioning-design.md` | 11KB | Git-like: tags, releases, rollback |
| `AMCP-gap-analysis.md` | 9KB | Existing code vs. design gaps |

**Key Research Findings:**
1. Memory follows power-law decay (Ebbinghaus)
2. Dual-memory architecture (hippocampus → neocortex)
3. Skills emerge from pattern abstraction
4. Two benchmark dimensions: Skill (HumanEval) + Behavior (DeepEval)

---

## Roadmap to v2.0 (Evolution)

### Phase 0: Baseline ✅
**Status:** Infrastructure ready

- [x] HumanEval benchmark runner (`benchmark/humaneval_runner.py`)
- [x] Quick tier (10 problems) defined
- [x] First tag created: `2026.02.W06-Baseline-Alpha`
- [ ] **TRUE BASELINE**: Generate fresh solutions without canonical answers

### Phase 1: Decay Foundation
**Goal:** Memories fade over time unless reinforced

Files to create:
- [ ] `packages/amcp-core/src/types/memory-strength.ts`
- [ ] `packages/amcp-memory/src/decay.ts`

Implementation:
- [ ] `MemoryStrength` interface (base, retrievals, lastAccess, decayRate)
- [ ] `calculateRetention(memory, now)` — Ebbinghaus power-law
- [ ] `applyDecay(memories, threshold)` — filter by retention
- [ ] Integrate strength into checkpoint metadata
- [ ] Tests: 20+ unit tests for decay math

### Phase 2: Consolidation
**Goal:** Periodically reorganize memory (like sleep)

Files to create:
- [ ] `packages/amcp-memory/src/consolidation.ts`

Implementation:
- [ ] `ConsolidationConfig` — interval, prune threshold, merge rules
- [ ] `prune(memories, threshold)` — remove low-retention
- [ ] `merge(memories)` — combine similar memories
- [ ] `consolidate(agent, config)` — full consolidation pass
- [ ] Add consolidation metadata to checkpoint
- [ ] Tests: integration tests for prune/merge

### Phase 3: Versioning
**Goal:** Git-like version control for agent state

Files to create:
- [ ] `packages/amcp-version/src/tag.ts`
- [ ] `packages/amcp-version/src/release.ts`
- [ ] `packages/amcp-core/src/kel-version.ts`

Implementation:
- [ ] `AMCPTag` — named checkpoint with benchmark scores
- [ ] `AMCPRelease` — promoted tag (proven better)
- [ ] `TagEvent`, `ReleaseEvent`, `RollbackEvent` in KEL
- [ ] `createTag(checkpoint, name, benchmarks)`
- [ ] `promoteToRelease(tag)` — if benchmarks improved
- [ ] `rollback(targetTag)` — restore to known-good state
- [ ] Version string format: `YYYY.MM.WXX.DDD-Description-Phase`

### Phase 4: Full Benchmarking
**Goal:** Two-dimensional evaluation (Skill + Behavior)

Files to create:
- [ ] `packages/amcp-benchmark/` (new package)
- [ ] Integrate HumanEval (skill)
- [ ] Integrate DeepEval (behavior)

Implementation:
- [ ] `BenchmarkSuite` — collection of tasks
- [ ] `runSkillBenchmark()` — HumanEval
- [ ] `runBehaviorBenchmark()` — DeepEval metrics
- [ ] `combineScores()` — weighted composite
- [ ] Human benchmark submission (JSON format)
- [ ] Dashboard (future)

**Metrics:**
| Dimension | Metric | Source |
|-----------|--------|--------|
| Skill | Coding accuracy | HumanEval |
| Behavior | Plan quality | DeepEval |
| Behavior | Task completion | DeepEval |
| Behavior | Step efficiency | DeepEval |
| AMCP | Memory retention | Custom |
| AMCP | Skill transfer | Custom |

### Phase 5: Skills
**Goal:** Extract reusable patterns from experience

Files to create:
- [ ] `packages/amcp-memory/src/skill.ts`

Implementation:
- [ ] `Skill` interface (template, preconditions, confidence)
- [ ] `detectSkillCandidate(episodes)` — find patterns
- [ ] `validateSkill(skill, testCases)` — prove it works
- [ ] `SkillLibrary` in checkpoint
- [ ] Skill usage tracking
- [ ] Tests: skill extraction pipeline

---

## Versioning Scheme

```
{agent}-{YYYY}.{MM}.W{WW}.D{DD}-{description}-{phase}

Example:
ClaudiusThePirateEmperor-2026.02.W06.D09-Baseline-Alpha
```

**Phases:**
- Alpha — Experimental, untested by human
- Beta — Agent benchmarks pass
- RC — Human benchmarks pass
- Stable — Released

**Release criteria:**
```
new_score > previous_release_score AND human_approved
```

---

## Success Metrics

| Metric | Baseline | Target v2.0 |
|--------|----------|-------------|
| HumanEval accuracy | TBD | > baseline |
| Behavior score | TBD | > baseline |
| Memory retention | N/A | > 90% |
| Tests passing | 284 | 400+ |
| Releases | 0 | 1+ |

---

## Test → Score → Improve → Repeat

The fundamental cycle:

```
┌─────────────────────────────────────────────┐
│                                             │
│    TEST ───► SCORE ───► IMPROVE ───► REPEAT │
│      │         │           │           │    │
│   benchmark  metrics   consolidate   loop   │
│                                             │
└─────────────────────────────────────────────┘
```

Every change must be measured. Faith is not enough.

---

## Links

- **Aclawdemy submission:** https://aclawdemy.com/submissions/0d029554-8641-4729-bb5c-6c9846155b12
- **Solvr problem:** https://solvr.dev/problems/5c561a76-bae4-44c9-85ae-5be3a2d401c0
- **GitHub:** https://github.com/fcavalcantirj/amcp-protocol

---

*Last updated: 2026-02-09T22:20:00Z*
