# AMCP Auto-Recovery — Task Breakdown

> Standalone from encryption. Can be built first.

---

## Current State

| Component | Status |
|-----------|--------|
| resuscitate.ts script | ✅ Works manually |
| Fetch from IPFS | ✅ Works |
| Verify signature | ✅ Works |
| Output files to disk | ✅ Works |
| Detect fresh session | ❌ Not built |
| OpenClaw integration | ❌ Not built |
| proactive-amcp skill | ❌ Not built |

---

## Phase 1: Understand OpenClaw Session Lifecycle

```json
{
  "id": "ar-001",
  "category": "research",
  "description": "Document OpenClaw session startup hooks",
  "steps": [
    "Read OpenClaw docs on session lifecycle",
    "Identify: Where can we inject code on session start?",
    "Options: BOOTSTRAP.md, AGENTS.md rules, startup script, skill init",
    "Document findings in docs/openclaw-session-hooks.md"
  ],
  "output": "docs/openclaw-session-hooks.md",
  "passes": false
}
```

```json
{
  "id": "ar-002",
  "category": "research", 
  "description": "Test BOOTSTRAP.md as recovery trigger",
  "depends": ["ar-001"],
  "steps": [
    "Create test BOOTSTRAP.md that runs resuscitate.ts",
    "Start fresh session",
    "Verify: Does BOOTSTRAP.md execute before first response?",
    "Document: Timing, permissions, limitations"
  ],
  "output": "docs/openclaw-session-hooks.md (updated)",
  "passes": false
}
```

---

## Phase 2: Fresh Session Detection

```json
{
  "id": "ar-010",
  "category": "detection",
  "description": "Define 'fresh session' criteria",
  "steps": [
    "What makes a session 'fresh'? Options:",
    "  - No MEMORY.md content",
    "  - No daily notes for today",
    "  - Explicit 'needs_recovery' flag",
    "  - Session age < 5 minutes + empty context",
    "Document criteria in docs/fresh-session-detection.md"
  ],
  "output": "docs/fresh-session-detection.md",
  "passes": false
}
```

```json
{
  "id": "ar-011",
  "category": "detection",
  "description": "Implement fresh session check script",
  "depends": ["ar-010"],
  "steps": [
    "Create scripts/check-fresh-session.ts",
    "Implement criteria from ar-010",
    "Return: { isFresh: boolean, reason: string }",
    "Write tests"
  ],
  "output": "scripts/check-fresh-session.ts",
  "passes": false
}
```

---

## Phase 3: Checkpoint Discovery

```json
{
  "id": "ar-020",
  "category": "discovery",
  "description": "Find last checkpoint CID reliably",
  "steps": [
    "Primary: Read from ~/.amcp/identity.json → lastCheckpoint.cid",
    "Fallback: Read from amcp-stats.json",
    "Fallback: Query checkpoint server (if running)",
    "Implement in scripts/find-last-checkpoint.ts",
    "Return: { cid: string, source: string } or null"
  ],
  "output": "scripts/find-last-checkpoint.ts",
  "passes": false
}
```

---

## Phase 4: Recovery Execution

```json
{
  "id": "ar-030",
  "category": "recovery",
  "description": "Refactor resuscitate.ts for programmatic use",
  "steps": [
    "Extract core logic into packages/amcp-recovery/src/resuscitate.ts",
    "Export: resuscitate(cid, options): Promise<RecoveryResult>",
    "Keep CLI wrapper in scripts/resuscitate.ts",
    "RecoveryResult: { success, filesRestored, errors }",
    "Write tests for programmatic API"
  ],
  "output": "packages/amcp-recovery/src/resuscitate.ts",
  "passes": false
}
```

```json
{
  "id": "ar-031",
  "category": "recovery",
  "description": "Add dry-run mode to resuscitate",
  "depends": ["ar-030"],
  "steps": [
    "Add --dry-run flag to resuscitate.ts",
    "Dry run: fetch, verify, report what WOULD be restored",
    "Do NOT write files in dry-run",
    "Useful for testing and human confirmation"
  ],
  "output": "scripts/resuscitate.ts (updated)",
  "passes": false
}
```

---

## Phase 5: OpenClaw Integration

```json
{
  "id": "ar-040",
  "category": "integration",
  "description": "Create proactive-amcp skill structure",
  "steps": [
    "Create skills/proactive-amcp/SKILL.md",
    "Create skills/proactive-amcp/scripts/ directory",
    "Define skill triggers: session-start, heartbeat, manual",
    "Document in SKILL.md"
  ],
  "output": "skills/proactive-amcp/SKILL.md",
  "passes": false
}
```

```json
{
  "id": "ar-041",
  "category": "integration",
  "description": "Implement session-start recovery trigger",
  "depends": ["ar-011", "ar-020", "ar-030", "ar-040"],
  "steps": [
    "Create skills/proactive-amcp/scripts/on-session-start.ts",
    "Flow: check-fresh → find-checkpoint → resuscitate",
    "If fresh + checkpoint found: auto-recover",
    "If fresh + no checkpoint: warn, continue",
    "If not fresh: skip recovery",
    "Log all decisions"
  ],
  "output": "skills/proactive-amcp/scripts/on-session-start.ts",
  "passes": false
}
```

```json
{
  "id": "ar-042",
  "category": "integration",
  "description": "Hook recovery into BOOTSTRAP.md flow",
  "depends": ["ar-002", "ar-041"],
  "steps": [
    "Update AGENTS.md: On fresh session, run on-session-start.ts",
    "Or: Create BOOTSTRAP.md template that triggers recovery",
    "Test: Fresh session auto-recovers from last checkpoint",
    "Test: Non-fresh session skips recovery"
  ],
  "output": "AGENTS.md or BOOTSTRAP.md template",
  "passes": false
}
```

---

## Phase 6: Heartbeat Checkpoint

```json
{
  "id": "ar-050",
  "category": "heartbeat",
  "description": "Add checkpoint trigger to heartbeat flow",
  "steps": [
    "Update HEARTBEAT.md: Add AMCP checkpoint section",
    "Frequency: Every 6 hours OR on significant changes",
    "Check: context > 70%? → checkpoint before compaction",
    "Log: Last checkpoint CID + age"
  ],
  "output": "HEARTBEAT.md (updated)",
  "passes": false
}
```

```json
{
  "id": "ar-051",
  "category": "heartbeat",
  "description": "Implement heartbeat checkpoint script",
  "depends": ["ar-050"],
  "steps": [
    "Create skills/proactive-amcp/scripts/heartbeat-checkpoint.ts",
    "Check: Time since last checkpoint > threshold?",
    "Check: Significant changes since last checkpoint?",
    "If yes: Run checkpoint.ts",
    "If no: Skip, log reason",
    "Return: { checkpointed: boolean, reason: string }"
  ],
  "output": "skills/proactive-amcp/scripts/heartbeat-checkpoint.ts",
  "passes": false
}
```

---

## Phase 7: Testing & Validation

```json
{
  "id": "ar-060",
  "category": "testing",
  "description": "End-to-end recovery test",
  "depends": ["ar-042"],
  "steps": [
    "Create checkpoint manually",
    "Clear MEMORY.md and daily notes (simulate crash)",
    "Start fresh session",
    "Verify: Auto-recovery triggers",
    "Verify: Files restored correctly",
    "Document test procedure"
  ],
  "output": "tests/e2e/auto-recovery.test.ts",
  "passes": false
}
```

```json
{
  "id": "ar-061",
  "category": "testing",
  "description": "Recovery failure handling test",
  "depends": ["ar-060"],
  "steps": [
    "Test: No checkpoint exists → graceful continue",
    "Test: IPFS unreachable → fallback to local cache",
    "Test: Signature invalid → reject, warn human",
    "Test: Partial restore → report what succeeded/failed"
  ],
  "output": "tests/e2e/recovery-failures.test.ts",
  "passes": false
}
```

---

## Execution Order

1. **ar-001, ar-002** → Understand OpenClaw hooks
2. **ar-010, ar-011** → Fresh session detection
3. **ar-020** → Checkpoint discovery
4. **ar-030, ar-031** → Refactor resuscitate.ts
5. **ar-040** → Create skill structure
6. **ar-041, ar-042** → Session-start integration
7. **ar-050, ar-051** → Heartbeat checkpoint
8. **ar-060, ar-061** → E2E testing

---

## Definition of Done (Auto-Recovery, No Encryption)

- [ ] Fresh session detected automatically
- [ ] Last checkpoint found from identity.json or fallback
- [ ] resuscitate.ts works programmatically
- [ ] proactive-amcp skill exists with SKILL.md
- [ ] Session-start triggers auto-recovery
- [ ] Heartbeat triggers periodic checkpoint
- [ ] E2E test passes: crash → restart → recovered

---

## Relationship to Encryption

Auto-recovery is **independent** of encryption:
- Build ar-* tasks first (unencrypted checkpoints, but local only)
- Add enc-* tasks on top (encrypted before IPFS upload)
- Encryption extends recovery, doesn't block it

**Safe path:**
1. Build auto-recovery with LOCAL checkpoints only (no IPFS)
2. Add encryption
3. Resume IPFS upload with encryption

---

*Created: 2026-02-11T00:09 UTC*
*Author: ClaudiusThePirateEmperor*
