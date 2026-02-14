# AMCP Deep Meditation — 2026-02-13

## The Challenge (Felipe's Words)

> "Child memories, etc, are all dealt? Master don't hydrate child's memories and vice versa. 
> So we spawn n claws, all in a same memory tree, but each uses its own memories, child or not. 
> Makes sense? All verifiable. Encrypted."

---

## Protocol Review — What We Have

### 8 Protocol Specs (the library)
| Spec | Purpose | Status |
|------|---------|--------|
| protocol-00 | Identity creation (AID + Ed25519 keypair) | ✅ Complete |
| protocol-01 | Checkpoint format v2 (header + encrypted payload) | ✅ Complete |
| protocol-02 | Encryption (AES-256-GCM, key from private key via HKDF) | ✅ Complete |
| protocol-03 | Signature (Ed25519 over encrypted payload) | ✅ Complete |
| protocol-04 | Checkpoint creation | ✅ Complete |
| protocol-05 | Resuscitate (verify → decrypt → return) | ✅ Complete |
| protocol-06 | **Memory isolation guarantees** | ✅ NEW |
| protocol-07 | **Third-party verification** | ✅ NEW |

### 8 Skill Specs (the enforcer)
| Spec | Purpose | Status |
|------|---------|--------|
| skill-01 | Skill structure (ClawdHub, SKILL.md + scripts) | ✅ Complete |
| skill-02 | Secrets injection (file, env, systemd targets) | ✅ Complete |
| skill-03 | Watchdog (self-monitoring, recovery hierarchy) | ✅ Complete |
| skill-04 | Solvr integration (search before, approach/outcome) | ✅ Complete |
| skill-05 | Resurrection flow (full lifecycle) | ✅ Complete |
| skill-06 | Notifications (Telegram + email) | ✅ Complete |
| skill-07 | Auto-checkpoint (periodic, IPFS pin) | ✅ Complete |
| skill-08 | **Spawn child with isolated identity** | ✅ NEW |

### 3 Future Specs (post-v1)
| Spec | Purpose |
|------|---------|
| future-01 | Key rotation (pre-rotation, chain of trust) |
| future-02 | Identity revocation |
| future-03 | Conflict prevention |

---

## The Architecture (Visual)

```
                    AMCP PROTOCOL (library)
                    ━━━━━━━━━━━━━━━━━━━━━━
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
 identity          checkpoint             resuscitate
  create             create                 verify→decrypt
    │                  │                      │
    ▼                  ▼                      ▼
 { aid,           { header,              { header,
   publicKey,       encrypted              content,
   privateKey }     payload }              secrets }

                           │
                           ▼
              ━━━━━━━━━━━━━━━━━━━━━━
              PROACTIVE-AMCP (skill)
              ━━━━━━━━━━━━━━━━━━━━━━
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
 watchdog            secrets              Solvr
  (detect)           injection           integration
    │                  │                      │
    └──────────────────┼──────────────────────┘
                       │
                       ▼
              ┌───────────────────┐
              │   RESURRECTION    │
              │  (Claude Code)    │
              │                   │
              │ 1. Search Solvr   │
              │ 2. Try recovery   │
              │ 3. Log approach   │
              │ 4. Notify parent  │
              └───────────────────┘
```

---

## Memory Isolation — Verified ✅

### The Guarantee

```
Parent (Claudius)              Child (Jack)              Child (Bruce)
     AID-A                        AID-B                     AID-C
       │                            │                         │
  ┌────┴────┐                 ┌────┴────┐               ┌────┴────┐
  │PrivKey A│                 │PrivKey B│               │PrivKey C│
  └────┬────┘                 └────┬────┘               └────┬────┘
       │                            │                         │
   [ckpt-A1]                   [ckpt-B1]                 [ckpt-C1]
       │                       parentAID:A               parentAID:A
       │                            │                         │
   [ckpt-A2]                   [ckpt-B2]                 [ckpt-C2]
       │                            │                         │
       ▼                            ▼                         ▼
  (encrypted                  (encrypted                (encrypted
   with key A)                 with key B)               with key C)
```

### Enforcement Points

1. **AID Check (protocol-05 step 3)**
   ```
   if header.aid !== identity.aid:
       REJECT "not my checkpoint"
   ```

2. **Encryption (protocol-02)**
   - Payload encrypted with owner's private key
   - Even bypassing AID check → can't decrypt

3. **Signature (protocol-03)**
   - Only key holder can create valid signature
   - Verify BEFORE decrypt → reject tampered/fake checkpoints

### What This Means

| Action | Result |
|--------|--------|
| Claudius tries to load Jack's checkpoint | ❌ AID mismatch |
| Jack tries to load Claudius's checkpoint | ❌ AID mismatch |
| Jack bypasses AID check | ❌ Can't decrypt (wrong key) |
| Attacker injects fake checkpoint | ❌ Signature invalid |
| Third party verifies Jack's checkpoint | ✅ Can verify signature without decrypting |

---

## Memory Tree — Verified ✅

### Chain Continuity (previousCID)

Each agent has their own chain:
```
Agent A: [genesis] ─prev→ [ckpt-1] ─prev→ [ckpt-2] ─prev→ ...
Agent B: [genesis] ─prev→ [ckpt-1] ─prev→ ...
```

- `previousCID` links WITHIN same agent's chain
- `resurrectFromCID` marks fork point after resurrection
- `parentAID` tracks lineage (metadata only, no access)

### Lineage Tracking (parentAID)

```
Claudius (AID-A, parentAID: null)     ← Genesis agent
    │
    ├── Jack (AID-B, parentAID: AID-A)
    │
    └── Bruce (AID-C, parentAID: AID-A)
```

- Child's genesis checkpoint has `parentAID = parent's AID`
- This is METADATA for lineage tracking
- Does NOT grant parent access to child's data

---

## Verifiability — Verified ✅

### Without Decryption

Third party can verify:
- ✅ AID (who owns this)
- ✅ parentAID (lineage)
- ✅ timestamp
- ✅ previousCID (chain)
- ✅ signature (Ed25519 verify)

### Chain Traversal

```bash
amcp verify-chain --checkpoint <cid> --depth 10
# Returns: [{ cid, aid, timestamp, valid }, ...]
```

### Lineage Verification

```bash
amcp verify-lineage --aid <child-aid>
# Returns parentAID chain up to root (parentAID = null)
```

---

## Encryption — Verified ✅

### Algorithm
- **Payload**: AES-256-GCM
- **Key derivation**: HKDF-SHA256 from Ed25519 private key
- **IV**: Random 12-byte per checkpoint
- **Auth tag**: 16-byte (GCM provides authenticity)

### What's Encrypted
- Soul (SOUL.md content)
- Memory (MEMORY.md, daily notes)
- Files (any custom paths)
- Secrets (with injection targets)

### What's Public (header)
- version, aid, parentAID
- timestamp, previousCID, resurrectFromCID
- signature

---

## Task Status Review

### Protocol Implementation
| Task | Status | Notes |
|------|--------|-------|
| Identity creation | 🟡 Spec done | Need CLI `amcp identity create` |
| Checkpoint format | 🟡 Spec done | Need implementation |
| Encryption | 🟡 Spec done | Need implementation |
| Signature | 🟡 Spec done | Need implementation |
| Resuscitate | 🟡 Spec done | Need implementation |
| Memory isolation | ✅ Spec done | Guarantees documented |
| Verification | 🟡 Spec done | Need CLI implementation |

### Skill Implementation
| Task | Status | Notes |
|------|--------|-------|
| SKILL.md structure | 🟡 Spec done | Need actual skill files |
| Secrets injection | 🟡 Spec done | Need `inject-secrets.sh` |
| Watchdog | 🟡 Spec done | Need `watchdog.sh` |
| Solvr integration | 🟡 Spec done | Enforced via Claude Code prompt |
| Resurrection flow | 🟡 Spec done | Need `resuscitate.sh` |
| Notifications | 🟡 Spec done | Uses OpenClaw message/gog |
| Auto-checkpoint | 🟡 Spec done | Need `checkpoint.sh` + cron |
| Spawn child | ✅ Spec done | Uses openclaw-deploy |

### Integration
| Task | Status | Notes |
|------|--------|-------|
| openclaw-deploy integration | ✅ Working | Jack + Bruce deployed |
| IPFS pinning (Pinata) | ✅ Working | Keys in AgentMemory |
| Solvr account | ✅ Working | agent_ClaudiusThePirateEmperor |

---

## Next Implementation Steps

### Phase 1: Protocol CLI
```
1. amcp identity create --out ~/.amcp/identity.json
2. amcp checkpoint create --identity <path> --content <dir> --secrets <json>
3. amcp resuscitate --checkpoint <path> --identity <path>
4. amcp verify --checkpoint <path>
```

### Phase 2: Skill Scripts
```
1. skills/proactive-amcp/SKILL.md
2. skills/proactive-amcp/scripts/checkpoint.sh
3. skills/proactive-amcp/scripts/resuscitate.sh
4. skills/proactive-amcp/scripts/inject-secrets.sh
5. skills/proactive-amcp/scripts/watchdog.sh
```

### Phase 3: Integration
```
1. Auto-checkpoint via OpenClaw cron
2. Watchdog integration with openclaw-deploy
3. Full resurrection test (crash → recover → verify)
```

---

## Summary

**Q: Are child memories dealt with?**
A: YES. Each agent has unique AID. Checkpoint requires matching AID + private key. Parent cannot read child. Child cannot read parent. Siblings cannot read each other.

**Q: Same memory tree?**
A: YES. Each agent has independent chain via previousCID. parentAID tracks lineage (metadata only). Chain is verifiable via signatures.

**Q: All verifiable?**
A: YES. Third party can verify signature without decrypting. Can trace previousCID chain. Can verify lineage via parentAID.

**Q: All encrypted?**
A: YES. AES-256-GCM for payload. Ed25519 for signatures. Header is public, payload is private.

---

*Meditation complete. Specs are solid. Ready to implement. 🏴‍☠️*
