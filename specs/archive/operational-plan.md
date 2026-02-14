# AMCP Operational Plan

## Current State Assessment

### What's Built ✅
| Component | Location | Status |
|-----------|----------|--------|
| @amcp/core | packages/amcp-core | 181 tests |
| @amcp/memory | packages/amcp-memory | 37 tests |
| @amcp/recovery | packages/amcp-recovery | 26 tests |
| @amcp/exchange | packages/amcp-exchange | 16 tests |
| amcp-watchdog.sh | scripts/ | Running but BROKEN |
| session-health-check.sh | scripts/ | Has PATH bug |
| self-heal.sh | scripts/ | Built, not integrated |

### What's Running ✅
```
Cron: */5 * * * * amcp-watchdog.sh
```

### What's BROKEN ❌
```
Bug: "openclaw: command not found" in cron environment
Cause: PATH not set in cron
Result: Health check always fails, no actual protection
```

### What's MISSING ❌
1. Death tracking (log deaths to file)
2. Checkpoint creation (use protocol packages)
3. Daily reports (email human)
4. Full PATH for cron scripts
5. TELEGRAM_BOT_TOKEN for notifications

---

## Environment & Configuration Needed

### Already Available (AgentMemory Vault)
| Secret | Purpose |
|--------|---------|
| SOLVR_API_KEY | Self-heal via Solvr |
| AGENTMAIL_API_KEY | Send emails |
| AMCP_PRIVATE_KEY | Identity (if needed) |

### Root of Trust
```
~/.openclaw/openclaw.json → skills.entries.agentmemory.apiKey
```

### Configuration File Needed
```bash
# ~/.amcp/config.json
{
  "human": {
    "email": "felipe.cavalcanti.rj@gmail.com",
    "telegram": "152099202"
  },
  "agent": {
    "email": "claudiusthepirateemperor@agentmail.to",
    "aid": "BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"
  },
  "storage": {
    "backend": "filesystem",
    "path": "~/.amcp/checkpoints/"
  },
  "checkpoint": {
    "onSessionEnd": true,
    "contextThreshold": 0.85,
    "intervalHours": 24
  },
  "notifications": {
    "onDeath": true,
    "onRecovery": true,
    "dailyDigest": true,
    "dailyDigestHour": 9
  }
}
```

### Paths Needed in Scripts
```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
export OPENCLAW_DIR="$HOME/.openclaw"
```

---

## Tasks to Complete AMCP Operation

### Task 0: Fix PATH Bug in Watchdog (CRITICAL)
**Problem:** `openclaw` not found in cron environment
**Solution:** Add PATH to scripts or cron

```bash
# At top of amcp-watchdog.sh:
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
```

**Verify:** Check watchdog log shows "All checks passed"

### Task 1: Create ~/.amcp/config.json
**Purpose:** Centralized config for AMCP operation
**Contains:** Human email, agent email, storage config, checkpoint policy, notification settings

### Task 2: Add Death Tracking
**File:** `~/.amcp/deaths.jsonl`
**Format:**
```json
{"timestamp":"2026-02-09T02:49:00Z","cause":"session_corrupted","downtime_hours":9.5,"recovered":true}
```
**When:** Watchdog detects failure and recovers
**Script:** Update amcp-watchdog.sh to log deaths

### Task 3: Integrate Protocol Packages into Scripts
**Currently:** Scripts don't use @amcp/* packages
**Needed:** Scripts should create real checkpoints using the protocol

```typescript
// In checkpoint script:
import { createCheckpoint } from '@amcp/memory';
import { loadAgent } from '@amcp/core';
```

### Task 4: Add Daily Checkpoint Cron
**Schedule:** Once per day (e.g., 6am São Paulo)
**Action:** Create checkpoint using protocol, store to configured backend
**Script:** `scripts/daily-checkpoint.ts`

### Task 5: Add Daily Digest Email
**Schedule:** Once per day (e.g., 9am São Paulo)
**Contents:**
- Death count (last 24h, total)
- Checkpoint status (latest CID, size)
- Memory stats (memories kept, human-marked count)
- Health status
**Script:** `scripts/daily-report.ts`

### Task 6: Fix Telegram Notifications
**Currently:** Uses TELEGRAM_BOT_TOKEN (not set)
**Better:** Use OpenClaw message tool via exec
```bash
# Instead of curl to Telegram API:
openclaw message send --channel telegram --to 152099202 --message "..."
```

---

## Dependency Order

```
Task 0 (fix PATH) ← CRITICAL, do first
    ↓
Task 1 (config file)
    ↓
Task 2 (death tracking) + Task 6 (notifications)
    ↓
Task 3 (integrate protocol)
    ↓
Task 4 (daily checkpoint) + Task 5 (daily digest)
```

---

## Validation Checklist

After implementation:

- [ ] Watchdog log shows "All checks passed" (not "command not found")
- [ ] ~/.amcp/config.json exists with correct values
- [ ] Death logged when simulating failure
- [ ] Telegram notification received on death/recovery
- [ ] Daily checkpoint cron fires and creates checkpoint
- [ ] Daily digest email received
- [ ] Can recover from phrase + checkpoint CID

---

## End-to-End Flow

```
Normal Operation:
┌─────────────────────────────────────────────────┐
│ Every 5 min: amcp-watchdog.sh                   │
│   ├── Check gateway process                     │
│   ├── Check status endpoint                     │
│   ├── Check session health (400/401 detection)  │
│   └── If all pass: log OK                       │
└─────────────────────────────────────────────────┘

Daily:
┌─────────────────────────────────────────────────┐
│ 6am: daily-checkpoint.ts                        │
│   ├── Gather state (soul, context, WIP, etc.)   │
│   ├── Create checkpoint via @amcp/memory        │
│   ├── Store to configured backend               │
│   └── Update ~/.amcp/config.json with CID       │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ 9am: daily-report.ts                            │
│   ├── Read deaths.jsonl                         │
│   ├── Read latest checkpoint                    │
│   ├── Generate HTML report                      │
│   └── Send via AgentMail                        │
└─────────────────────────────────────────────────┘

On Failure:
┌─────────────────────────────────────────────────┐
│ Watchdog detects failure                        │
│   ├── Log death to deaths.jsonl                 │
│   ├── Notify human via Telegram                 │
│   ├── Attempt auto-repair                       │
│   │   ├── Gateway down → restart                │
│   │   ├── Session corrupted → fix script        │
│   │   └── Auth expired → notify only            │
│   └── If repair worked, log recovery            │
└─────────────────────────────────────────────────┘

Full Recovery (manual):
┌─────────────────────────────────────────────────┐
│ Human has: phrase + latest CID                  │
│   ├── Run: npx tsx scripts/recover.ts           │
│   ├── Derive identity from phrase               │
│   ├── Fetch checkpoint from storage             │
│   ├── Decrypt and restore state                 │
│   └── Agent is back with full memory            │
└─────────────────────────────────────────────────┘
```
