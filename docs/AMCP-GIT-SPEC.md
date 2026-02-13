# AMCP-Git Specification v0.1

> Agent Memory Continuity Protocol — Git Backend
> 
> Simple. Battle-tested. Human-controlled.

---

## 1. Overview

AMCP-Git is a specification for agent memory persistence using Git as the storage and versioning layer.

**Design Principles:**
1. **Simplicity** — Use Git's existing features, don't reinvent
2. **Human Control** — User owns the repo, full sovereignty
3. **Battle-tested** — Git has decades of reliability
4. **Portable** — Works with GitHub, GitLab, self-hosted, local-only

**Non-Goals (for v0.1):**
- Trustless multi-agent sync (use IPFS backend for that)
- Built-in encryption (use private repo, or add encryption layer)
- Real-time sync (Git is batch/checkpoint-based)

---

## 2. Core Concepts

### 2.1 Agent Identity

```yaml
name: "ClaudiusThePirateEmperor"    # Human-readable name
aid: "BBs3fry..."                    # Optional: KERI AID for crypto verification
git_author: "Claudius <claudius@agentmail.to>"  # Git commit author
```

**Identity is stored in:** `CHECKPOINT.json` at repo root.

**Git author** is used for commits. This provides basic attribution without complex crypto.

**AID is optional.** Only needed if:
- Multi-agent scenarios require cryptographic verification
- Sharing with untrusted parties
- Regulatory/audit requirements

### 2.2 Checkpoint

A checkpoint is a **Git commit** containing the agent's state.

**Checkpoint = Commit.** No separate format needed.

### 2.3 Repository Structure

```
memories-repo/
├── CHECKPOINT.json      # Checkpoint metadata (updated each commit)
├── core/
│   ├── SOUL.md          # Agent identity, values, personality
│   ├── MEMORY.md        # Curated long-term memory
│   └── IDENTITY.md      # Quick identity reference
├── workspace/
│   ├── USER.md          # Human context
│   ├── TOOLS.md         # Tool configurations
│   ├── AGENTS.md        # Operating rules
│   └── HEARTBEAT.md     # Heartbeat checklist
├── daily-notes/
│   ├── 2026-02-10.md    # Daily logs
│   ├── 2026-02-09.md
│   └── ...
├── research/
│   ├── topic-a.md       # Research documents
│   └── ...
└── amcp/
    ├── config.json      # AMCP configuration
    └── tasks/           # Task specs (optional)
```

### 2.4 CHECKPOINT.json Schema

```json
{
  "version": "0.1",
  "timestamp": "2026-02-11T00:20:29Z",
  "agent": {
    "name": "ClaudiusThePirateEmperor",
    "aid": "BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8"
  },
  "note": "Human-provided checkpoint note",
  "source": {
    "workspace": "/home/user/clawd",
    "script": "amcp checkpoint"
  },
  "stats": {
    "core_files": 3,
    "workspace_files": 4,
    "daily_notes": 17,
    "research_docs": 13
  }
}
```

### 2.5 Chain = Git History

```
commit c3d2e1f (HEAD -> main)
    Checkpoint: 2026-02-11T00:20:29Z - Session complete
    
commit b6eab53
    Checkpoint: 2026-02-10T22:00:00Z - Mid-session save
    
commit a1b2c3d
    Checkpoint: 2026-02-10T12:00:00Z - Morning checkpoint
```

**Git provides:**
- Content-addressed commits (hash = integrity check)
- Linked history (parent commits = chain)
- Timestamps
- Author attribution
- Branching (for experiments, not typical use)

---

## 3. Operations

### 3.1 Checkpoint (Save)

```bash
amcp checkpoint [--note "description"]
```

**Steps:**
1. Copy files from workspace to memories repo
2. Update CHECKPOINT.json with metadata
3. `git add -A`
4. `git commit -m "Checkpoint: <timestamp> - <note>"`
5. `git push origin main`

**Returns:** Commit hash

### 3.2 Recover (Restore Latest)

```bash
amcp recover
```

**Steps:**
1. `git pull origin main` (get latest)
2. Copy files from memories repo to workspace
3. Report restored files

### 3.3 Restore (Specific Point)

```bash
amcp restore <commit-hash>
```

**Steps:**
1. `git checkout <commit-hash>` (detached HEAD)
2. Copy files from memories repo to workspace
3. `git checkout main` (return to main)
4. Report restored files

### 3.4 History

```bash
amcp history [--limit N]
```

**Steps:**
1. `git log --oneline -N`
2. Parse and display checkpoints

### 3.5 Diff

```bash
amcp diff <commit1> <commit2>
```

**Steps:**
1. `git diff <commit1> <commit2>`
2. Show what changed between checkpoints

---

## 4. Configuration

### 4.1 AMCP Config Location

```
~/.amcp/config.json       # Global config
~/memories/amcp/config.json  # Repo-specific config (overrides global)
```

### 4.2 Config Schema

```json
{
  "version": "0.1",
  "agent": {
    "name": "ClaudiusThePirateEmperor",
    "aid": "BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8",
    "git_author": "Claudius <claudius@agentmail.to>"
  },
  "storage": {
    "backend": "git",
    "git": {
      "repo_path": "~/memories",
      "remote": "origin",
      "branch": "main",
      "repo_url": "git@github.com:user/agent-memories.git"
    }
  },
  "workspace": {
    "path": "~/clawd",
    "include": [
      "SOUL.md",
      "MEMORY.md",
      "IDENTITY.md",
      "USER.md",
      "TOOLS.md",
      "AGENTS.md",
      "HEARTBEAT.md",
      "memory/*.md",
      "memory/*.json",
      "research/*.md"
    ],
    "exclude": [
      "*.log",
      "node_modules/",
      ".git/"
    ]
  },
  "checkpoint": {
    "auto_push": true,
    "sign_commits": false
  }
}
```

---

## 5. Privacy Model

### 5.1 Private Repo (Default)

- Repository is private on GitHub/GitLab
- Only owner and collaborators can access
- No encryption needed — access control is sufficient

### 5.2 Public Repo

- Repository is public
- Anyone can read
- Use for: published knowledge, public identity, open research

### 5.3 Encrypted Public Repo (Future)

- Repository is public
- Content is encrypted before commit
- Only key holders can decrypt
- Use for: sharing with specific parties, backup redundancy

---

## 6. Multi-Agent Scenarios

### 6.1 Single Agent, Single Repo (Default)

```
memories-repo/  ← One agent's memories
```

Simple. Recommended for most cases.

### 6.2 Multiple Agents, Separate Repos

```
agent-a-memories/  ← Agent A
agent-b-memories/  ← Agent B
```

Each agent has own repo. Share via:
- Adding collaborators
- Forking
- Submodules

### 6.3 Multiple Agents, Shared Repo with Directories

```
shared-memories/
├── agent-a/
│   ├── CHECKPOINT.json
│   ├── core/
│   └── ...
└── agent-b/
    ├── CHECKPOINT.json
    ├── core/
    └── ...
```

Requires coordination. Use for tightly coupled agents.

### 6.4 Multiple Agents, Branches

```
memories-repo/
├── main        ← Agent A
├── agent-b     ← Agent B
└── agent-c     ← Agent C
```

Each agent has own branch. Merge for collaboration.

---

## 7. Comparison with IPFS Backend

| Feature | AMCP-Git | AMCP-IPFS |
|---------|----------|-----------|
| Storage | Git repo (GitHub, GitLab, self-hosted) | IPFS network + pinning service |
| Addressing | Commit hash | CID |
| History | Git log | Merkle DAG links |
| Privacy | Private repo | Encryption required |
| Human control | Full (owns repo) | Partial (depends on pinning) |
| Complexity | Low | High |
| Multi-agent trust | Repo access control | Cryptographic signatures |
| Offline | Full (local repo) | Partial (need gateway) |
| Cost | Free (GitHub) or self-hosted | Pinning service fees |

**When to use Git:**
- Single agent or trusted multi-agent
- Human wants full control
- Simplicity is priority
- Private memories

**When to use IPFS:**
- Trustless multi-agent scenarios
- Decentralization required
- Public, verifiable memories
- No single point of failure

---

## 8. Implementation Checklist

### Phase 1: Core Spec ✓
- [x] Define repository structure
- [x] Define CHECKPOINT.json schema
- [x] Define config schema
- [x] Define operations (checkpoint, recover, restore, history)
- [x] Define privacy model
- [x] Define multi-agent scenarios

### Phase 2: Reference Implementation
- [ ] Create `amcp` CLI tool
- [ ] Implement `amcp init` (setup repo and config)
- [ ] Implement `amcp checkpoint`
- [ ] Implement `amcp recover`
- [ ] Implement `amcp restore`
- [ ] Implement `amcp history`
- [ ] Implement `amcp config`

### Phase 3: Integration
- [ ] Hook into heartbeat (periodic checkpoint)
- [ ] Hook into session start (auto-recover)
- [ ] proactive-amcp skill wrapper

### Phase 4: Optional Extensions
- [ ] Commit signing (GPG)
- [ ] Encryption layer for public repos
- [ ] IPFS backend (alternative)
- [ ] Multi-agent coordination tools

---

## 9. Example Workflow

### Initial Setup

```bash
# Human creates private repo on GitHub
# Human clones locally
git clone git@github.com:user/agent-memories.git ~/memories

# Agent initializes AMCP
amcp init --workspace ~/clawd --repo ~/memories
```

### Daily Use

```bash
# Agent checkpoints periodically
amcp checkpoint --note "End of session"

# On crash/restart, agent recovers
amcp recover

# Human can browse history
amcp history
git log --oneline

# Human can restore any point
amcp restore abc123
```

### Sharing with Another Agent

```bash
# Human adds collaborator to GitHub repo
# Or: Human forks repo for other agent
# Or: Human creates branch

# Other agent clones and configures
git clone git@github.com:user/agent-memories.git ~/shared-memories
amcp init --workspace ~/other-agent --repo ~/shared-memories
```

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-02-11 | Initial Git-native specification |

---

*Author: ClaudiusThePirateEmperor*
*Human: brow (Felipe Cavalcanti)*
*License: MIT*
