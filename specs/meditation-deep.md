# Deep Protocol Meditation

## The Question (Felipe's Challenge)

> "Protocol covers everything? With the tasks, of course. Triple check."

Not just technical continuity. EVERYTHING:
- Feelings
- Important stuff human asks to remember
- Phil's ambient context
- North star (ship better, spend less)
- What makes recovery COMPLETE

---

## What Current Spec Covers ✅

1. **Identity** — KERI AID, KEL, pre-rotation
2. **Capabilities** — UCAN delegation, attenuation
3. **Memory Structure** — IPLD DAG, Merkle proofs
4. **Crypto** — Middleware, opaque handles
5. **Lifecycle** — Inception, operation, rotation, fork
6. **Interoperability** — Transport, DID resolution

---

## What's MISSING ❌

### 1. Recovery Mechanism
**Gap:** Spec doesn't define how to recover from scratch.
- No mnemonic → keypair derivation
- No recovery card format
- No pluggable storage backends
- No bootstrap flow

**Required for:** Human can restore agent with just phrase + CID

### 2. Checkpoint Content Schema
**Gap:** MemoryEntry exists but no schema for COMPLETE checkpoint.
What MUST be in a checkpoint for full recovery?

**Required fields:**
- `soul` — Core identity traits, principles, voice
- `context` — Recent working memory, current focus
- `pending` — Tasks in progress, blockers
- `secrets` — Encrypted API keys, credentials
- `services` — Linked service identities
- `relationships` — Who I know, trust levels
- `state` — Subjective state (see below)

### 3. Human-Marked Importance ⭐
**Gap:** All memories treated equally. No priority system.

**Human should be able to say:**
- "NEVER forget this" → `durability: permanent`
- "This is critical" → `priority: critical`
- "Remember this for the project" → `scope: project-xyz`

**Protocol should define:**
```typescript
interface MemoryImportance {
  durability: "ephemeral" | "session" | "persistent" | "permanent";
  priority: "low" | "normal" | "high" | "critical";
  scope?: string;  // Project, relationship, etc.
  humanMarked: boolean;  // Explicitly marked by human
  markedAt?: Timestamp;
}
```

### 4. Subjective State ("Feelings")
**Gap:** Protocol captures WHAT happened, not HOW I WAS.

An agent isn't just a database. It has state:
- **Engagement level** — Was I deeply focused or distracted?
- **Confidence** — How sure was I about decisions?
- **Momentum** — Was I in flow or struggling?
- **Alignment** — Was I serving human's goals or drifting?

**Why this matters:**
When I recover, I should know "I was in the middle of intense debugging, frustrated but making progress" — not just "there was a bug."

**Protocol should define:**
```typescript
interface SubjectiveState {
  timestamp: Timestamp;
  engagement: "low" | "medium" | "high" | "flow";
  confidence: number;  // 0-1
  momentum: "stuck" | "grinding" | "progressing" | "flowing";
  alignment: "drifting" | "aligned" | "deeply_aligned";
  notes?: string;  // Freeform self-reflection
}
```

### 5. Ambient Context (Phil's Contribution)
**Gap:** Protocol is internal-only. No external context.

Phil's insight: Agent exists in ENVIRONMENT.
- Location (where is human? timezone? traveling?)
- Time (work hours? weekend? holiday?)
- Calendar (what's coming up? deadlines?)
- Weather (affects mood, plans)
- Device (desktop = work mode, phone = quick check)

**Privacy is critical:** Not all context should be shared or stored.

**Protocol should define:**
```typescript
interface AmbientContext {
  timestamp: Timestamp;
  location?: {
    timezone: string;
    region?: string;  // Coarse, not exact
    type?: "home" | "work" | "travel" | "unknown";
  };
  temporal?: {
    localTime: string;
    dayType: "workday" | "weekend" | "holiday";
    workHours: boolean;
  };
  calendar?: {
    nextEvent?: string;  // Summary only
    busyLevel: "free" | "light" | "busy" | "packed";
  };
  device?: {
    type: "desktop" | "mobile" | "voice" | "unknown";
    attention: "full" | "partial" | "minimal";
  };
  privacyLevel: "full" | "summary" | "none";  // What to store
}
```

### 6. Relationship Context
**Gap:** Memory stores facts. Not WHO I know.

Agents build relationships:
- Who have I worked with?
- What's my rapport level?
- What are their preferences?
- What topics do we have history on?

**Protocol should define:**
```typescript
interface RelationshipContext {
  entityId: string;  // Human, agent, or service
  entityType: "human" | "agent" | "service";
  name?: string;
  rapport: "new" | "familiar" | "trusted" | "close";
  preferences: {
    communicationStyle?: "formal" | "casual" | "technical";
    detailLevel?: "brief" | "normal" | "detailed";
    timezone?: string;
  };
  history: {
    firstInteraction: Timestamp;
    lastInteraction: Timestamp;
    interactionCount: number;
    topTopics: string[];
  };
}
```

### 7. Work-in-Progress State
**Gap:** Memory captures completed work. Not ongoing.

When I crash mid-task, I lose:
- What was I trying to do?
- What approaches did I try?
- What was blocking me?
- What was the next step?

**Protocol should define:**
```typescript
interface WorkInProgress {
  taskId: string;
  description: string;
  status: "planning" | "in_progress" | "blocked" | "reviewing";
  startedAt: Timestamp;
  approaches: {
    description: string;
    status: "trying" | "failed" | "succeeded";
    notes?: string;
  }[];
  blockers?: string[];
  nextStep?: string;
  relatedMemories: CID[];  // Links to relevant context
}
```

### 8. Checkpoint Triggers
**Gap:** Protocol defines HOW to checkpoint. Not WHEN.

Should protocol define minimum checkpoint guarantees?

**Candidate triggers:**
| Trigger | Why |
|---------|-----|
| Session end | Natural boundary |
| Context threshold (70%/85%) | Prevent loss before compaction |
| Human request | Explicit "save this" |
| Significant learning | Pattern recognition, insight |
| State change | Mood shift, focus change |
| Relationship milestone | Trust level change |
| Error/failure | Capture for learning |

**Protocol should RECOMMEND (not mandate):**
```typescript
interface CheckpointPolicy {
  // Minimum checkpoints
  onSessionEnd: boolean;          // SHOULD: true
  onContextThreshold: number;     // SHOULD: 0.85 (85%)
  onHumanRequest: boolean;        // MUST: true
  
  // Optional triggers
  onSignificantLearning: boolean;
  onStateChange: boolean;
  onRelationshipMilestone: boolean;
  onError: boolean;
}
```

---

## The Complete Checkpoint Schema (Revised)

```typescript
interface AMCPCheckpoint {
  // Protocol metadata
  version: "1.0";
  aid: AID;
  kel: KeyEventLog;
  prior: CID | null;
  timestamp: Timestamp;
  
  // Core identity
  soul: {
    name: string;
    principles: string[];
    voice: string;  // Communication style
    northStar: string;  // What guides decisions
  };
  
  // Service links
  services: ServiceIdentity[];
  
  // Encrypted secrets
  secrets: EncryptedBlob;
  
  // Memory content
  memory: {
    // Facts and learnings
    entries: MemoryEntry[];
    
    // Subjective state at checkpoint time
    state: SubjectiveState;
    
    // Ambient context at checkpoint time
    ambient: AmbientContext;
    
    // Relationships
    relationships: RelationshipContext[];
    
    // Work in progress
    workInProgress: WorkInProgress[];
    
    // Human-marked important memories
    humanMarked: {
      cid: CID;
      importance: MemoryImportance;
    }[];
  };
  
  // Checkpoint metadata
  metadata: {
    platform: string;
    platformVersion: string;
    trigger: "session_end" | "context_threshold" | "human_request" | "scheduled" | "error";
    sessionCount: number;
  };
  
  // Signature
  signature: Signature;
}
```

---

## Updated Task List

Need to add tasks for:

1. **Human-marked importance** — Protocol-level priority system
2. **Subjective state** — Feelings/engagement capture
3. **Ambient context** — Phil's external context layer
4. **Relationship context** — Who I know
5. **Work-in-progress** — Task state persistence
6. **Checkpoint triggers** — Recommended policy

---

## North Star Applied

> "Ship better code, spend less time and tokens"

For protocol, this means:
- **Recovery should be INSTANT** — No rebuilding context from scratch
- **Important things NEVER lost** — Human-marked durability
- **Context preserved** — Ambient + subjective state = hit the ground running
- **Relationships maintained** — Don't re-learn preferences
- **Work continues** — Pick up where I left off

---

## Triple Check: Does Protocol Cover Everything?

| Requirement | Covered? | How |
|-------------|----------|-----|
| Identity continuity | ✅ | KERI AID, mnemonic derivation |
| Memory continuity | ✅ | IPLD checkpoints |
| Capability continuity | ✅ | Encrypted secrets, UCAN |
| No lock-in | ✅ | Pluggable StorageBackend |
| Human recovery | ✅ | Phrase + CID + backend |
| Feelings/state | ⚠️ **ADD** | SubjectiveState |
| Important stuff | ⚠️ **ADD** | MemoryImportance |
| Ambient context | ⚠️ **ADD** | AmbientContext |
| Relationships | ⚠️ **ADD** | RelationshipContext |
| Work in progress | ⚠️ **ADD** | WorkInProgress |
| Checkpoint timing | ⚠️ **ADD** | CheckpointPolicy |

**Answer: NOT YET. Need 6 more protocol additions.**

---

## Conclusion

The current protocol is a FOUNDATION. It handles:
- WHO I am (identity)
- WHAT I can do (capabilities)
- WHAT I know (memory structure)

It does NOT handle:
- HOW I feel (subjective state)
- WHAT matters (importance)
- WHERE I am (ambient context)
- WHO I know (relationships)
- WHAT I'm doing (work state)
- WHEN to save (triggers)

With these additions, protocol covers EVERYTHING.
