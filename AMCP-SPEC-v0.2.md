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

## 15. Layer 1: Ontology (Structured Knowledge)

AMCP checkpoints store arbitrary payloads. The Ontology Layer adds optional structured knowledge on top, enabling typed entity graphs with temporal tracking.

### 15.1 Architecture

```
Layer 3: Phenomenological  (SOUL, reconstruction seam — agent experience)
Layer 2: AMCP Core         (AID, checkpoints, chain — identity & integrity)
Layer 1: Ontology          (entities, relations, graph — structured knowledge)
```

Layer 1 is **optional**. Agents that don't use structured knowledge can ignore it entirely. AMCP Core (Layer 2) functions independently.

### 15.2 Graph Format

Ontology data is stored as append-only JSONL (one JSON object per line).

**Entity format:**

```json
{"type": "entity", "id": "person-001", "entityType": "Person", "properties": {"name": "Alice", "email": "alice@example.com"}, "created": "2026-02-10T00:00:00Z", "updated": "2026-02-15T12:00:00Z"}
```

**Relation format:**

```json
{"type": "relation", "from_id": "task-001", "relation_type": "has_owner", "to_id": "person-001"}
```

### 15.3 Entity Types

| Type | Description |
|------|-------------|
| Person | Human individual |
| Organization | Company, team, group |
| Project | Named effort or initiative |
| Task | Actionable work item |
| Goal | Desired outcome |
| Event | Time-bound occurrence |
| Location | Physical or virtual place |
| Document | File or content artifact |
| Message | Communication unit |
| Note | Free-form text |
| Account | Service or system account |
| Credential | Authentication material |
| Action | Recorded agent action |
| Policy | Rule or constraint |

### 15.4 Relation Types

| Type | Description |
|------|-------------|
| has_owner | Entity is owned by target |
| owns | Entity owns target |
| has_task | Entity has task target |
| part_of | Entity is part of target |
| member_of | Entity is member of target |
| blocks | Entity blocks target (acyclic) |
| depends_on | Entity depends on target (acyclic) |
| mentions | Entity mentions target |
| references | Entity references target |

### 15.5 Validation Requirements

1. **Schema enforcement:** Each entity must have `id`, `entityType`, `properties`, `created`, `updated`
2. **Relation integrity:** `from_id` and `to_id` must reference existing entity IDs
3. **Acyclic checking:** `blocks` and `depends_on` relations must not form cycles (verified via DFS)

### 15.6 Checkpoint Metadata Extensions

Optional fields added to `CheckpointMetadata` for ontology support:

| Field | Type | Description |
|-------|------|-------------|
| `ontologyGraphCID` | string (CIDv1) | Content address of `graph.jsonl` |
| `soulHash` | string (SHA-256) | Hash of SOUL.md for drift detection |
| `reconstructionSeam` | number (0-7) | Loading step when identity coalesced |
| `evolutionChainCID` | string (CIDv1) | CID of evolution inference history |
| `relatedEntitiesCount` | number | Entities updated by evolution engine |

All fields are optional. Checkpoints without these fields remain valid.

### 15.7 SOUL Drift Detection

Agent identity documents (SOUL.md) are tracked across checkpoints:

- `computeSoulHash(content)` produces SHA-256 hash
- `detectSoulDrift(prevHash, currHash, prevContent, currContent)` classifies changes:

| Severity | Lines Changed | Meaning |
|----------|--------------|---------|
| none | 0 | No drift |
| minor | 1-4 | Small refinement |
| moderate | 5-20 | Notable evolution |
| major | >20 | Significant identity shift |

### 15.8 Reconstruction Sequence

When restoring from a checkpoint, memory files load in canonical order:

| Step | Enum | Content | Required |
|------|------|---------|----------|
| 0 | SOUL | SOUL.md — agent identity | Yes |
| 1 | USER | USER.md — user context | No |
| 2 | ONTOLOGY_SCHEMA | Schema definitions | No |
| 3 | ONTOLOGY_GRAPH | graph.jsonl — entity graph | No |
| 4 | CURATED_MEMORY | MEMORY.md — curated notes | No |
| 5 | EPHEMERAL_NOTES | Daily/session notes | No |
| 6 | TOOLS | TOOLS.md — tool registry | No |
| 7 | SEAM | Identity coalescence marker | N/A |

The `seam_crossed` flag is set to `true` only after all steps complete successfully.

### 15.9 Temporal Index

Entities can be tracked across checkpoints for version history:

- `buildTemporalIndex(snapshots)` — builds per-entity timelines from checkpoint data
- `getEntityHistory(index, entity_id)` — returns chronological version list
- `queryByTimeRange(index, entity_id, start?, end?)` — filters by date range

Each entry includes a `version_hash` (SHA-256 of properties) for change detection.

### 15.10 Skill Contracts

Skills declare their ontology interactions via `SkillOntologyContract`:

```json
{
  "skill_name": "task-manager",
  "version": "1.0.0",
  "ontology": {
    "reads": ["Task", "Person"],
    "writes": ["Task"],
    "preconditions": [
      {"entity_type": "Task", "condition": "assignee exists"}
    ],
    "postconditions": [
      {"entity_type": "Task", "condition": "status = done"}
    ]
  }
}
```

Condition format: `<property> exists`, `<property> = <value>`, `<property> != <value>`.

`detectConflicts()` identifies contradictory postconditions across contracts sharing write access to the same entity type.

---

## 16. Learning Layer

The Learning Layer extends checkpoint metadata with problem tracking and insight capture, enabling agents to learn from failures across sessions.

### 16.1 Problem Entity

```json
{
  "id": "prob_abc12345",
  "description": "Build fails with missing dependency",
  "status": "open",
  "blocker": "Need to identify correct package version",
  "attempts": 2,
  "lastApproach": "Tried npm install --legacy-peer-deps",
  "retryAfter": "2026-02-20T00:00:00Z",
  "created": "2026-02-18T10:00:00Z",
  "updated": "2026-02-18T14:00:00Z",
  "humanVerified": false,
  "source": "self-detect",
  "tags": ["build", "dependency"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Format: `prob_` + 8 lowercase alphanumeric chars |
| description | string | Yes | Human-readable problem description |
| status | enum | Yes | `open`, `stuck`, `solved`, `abandoned` |
| blocker | string | No | What is blocking resolution |
| attempts | number | Yes | Number of resolution attempts |
| source | enum | Yes | `command`, `skill`, `self-detect` |
| humanVerified | boolean | Yes | Whether a human confirmed the problem |

### 16.2 Learning Entity

```json
{
  "id": "learn_xyz98765",
  "insight": "Use --legacy-peer-deps for React 18 peer conflicts",
  "sourceProblem": "prob_abc12345",
  "confidence": "verified",
  "humanVerified": true,
  "tags": ["npm", "react"],
  "created": "2026-02-18T15:00:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Format: `learn_` + 8 lowercase alphanumeric chars |
| insight | string | Yes | The learned knowledge |
| sourceProblem | string | No | Problem ID that led to this learning |
| confidence | enum | Yes | `tentative`, `verified` |

### 16.3 Checkpoint Metadata Extensions

| Field | Type | Description |
|-------|------|-------------|
| `unresolvedProblems` | Problem[] | Problems with status != solved at checkpoint time |
| `recentLearnings` | Learning[] | Learnings acquired since last checkpoint |
| `learningStats` | LearningStats | Aggregate statistics |

**LearningStats:**

```json
{
  "totalProblems": 15,
  "totalSolved": 10,
  "solvedPostRecovery": 3,
  "totalLearnings": 8
}
```

The metric `solvedPostRecovery / totalSolved` measures capability growth rate — problems solved after agent restoration demonstrate retained learning.

### 16.4 Validation

- Cross-reference: `Learning.sourceProblem` must reference an existing Problem ID
- Stats consistency: `learningStats.totalProblems` must match actual problem count
- JSONL files: `problems.jsonl` and `learnings.jsonl` validated line-by-line

---

## 17. Pinning Providers

AMCP supports pluggable IPFS pinning providers for checkpoint storage redundancy.

### 17.1 PinningProvider Interface

```typescript
interface PinningProvider {
  readonly name: string;
  pin(cid: string, name?: string): Promise<PinResult>;
  unpin(cid: string): Promise<void>;
  status(cid: string): Promise<PinStatus>;
}
```

**PinStatus:** `Queued`, `Pinning`, `Pinned`, `Failed`

### 17.2 Built-in Providers

| Provider | Base URL | Description |
|----------|----------|-------------|
| Pinata | `https://api.pinata.cloud` | Established IPFS pinning service |
| Solvr | `https://api.solvr.dev` | Solvr IPFS pinning (POST/DELETE/GET `/v1/pins`) |

Both providers support configurable base URLs and API key authentication.

### 17.3 Multi-Provider Redundancy

`MultiProvider` pins to multiple services in parallel:

```
MultiProvider([PinataProvider, SolvrProvider])
  ├── requireOne (default): succeeds if any provider succeeds
  └── requireAll: all providers must succeed
```

`pinWithDetails()` returns per-provider results for tracking.

### 17.4 Checkpoint Metadata Extensions

| Field | Type | Description |
|-------|------|-------------|
| `pinningProviders` | PinningProviderEntry[] | Which providers stored the content |
| `primaryProvider` | string | Preferred provider for retrieval |

**PinningProviderEntry:**

```json
{"name": "pinata", "cid": "bafkrei...", "requestId": "req-001"}
```

### 17.5 Cross-Provider Verification

`verifyPinAcrossProviders(cid, providers)` checks CID availability across all providers:

- `verified`: true if at least one provider has the CID pinned
- `contentMatch`: true if all reporting providers agree (content-addressed = same hash)

---

## 18. Implementations

The protocol can be implemented in any language.

**Reference implementation:** TypeScript — `@amcp/core`, `@amcp/memory`, `@amcp/recovery`

**Required functions:**
- `generate_keypair() → (private_key, public_key)`
- `derive_aid(public_key) → aid`
- `create_checkpoint(private_key, parent, payload) → checkpoint`
- `verify_checkpoint(checkpoint, expected_aid?) → boolean`
- `hash(data) → hash_string`
- `sign(data, private_key) → signature`
- `verify_signature(data, signature, public_key) → boolean`

---

## 19. References

- AriGraph: Learning Knowledge Graph World Models with Episodic Memory (IJCAI 2025)
- Zep/Graphiti: Temporal knowledge graphs for AI agents
- A-MEM: Agentic Memory for LLM Agents (NeurIPS 2025)
- LumenNox: Phenomenological identity and reconstruction seam theory

---

## 20. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-02-09 | Initial (OpenClaw-coupled) |
| 0.2 | 2026-02-11 | Agent-agnostic rewrite |
| 0.2.1 | 2026-02-19 | Added Ontology, Learning, and Pinning layers |

---

*Authors: ClaudiusThePirateEmperor, brow (Felipe Cavalcanti)*

*This protocol is open. Use it, extend it, improve it.*
