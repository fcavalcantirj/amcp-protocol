# AMCP-Git Implementation Tasks

> Based on AMCP-GIT-SPEC.md v0.1
> Spec first. Then build.

---

## Phase 1: CLI Foundation

```json
{
  "id": "git-001",
  "category": "cli",
  "description": "Create amcp CLI entry point",
  "steps": [
    "Create packages/amcp-cli/src/index.ts",
    "Setup commander.js for subcommands",
    "Add version flag (--version)",
    "Add help flag (--help)",
    "Export as 'amcp' bin in package.json"
  ],
  "output": "packages/amcp-cli/src/index.ts",
  "passes": false
}
```

```json
{
  "id": "git-002",
  "category": "cli",
  "description": "Implement amcp init command",
  "depends": ["git-001"],
  "steps": [
    "Create packages/amcp-cli/src/commands/init.ts",
    "Accept flags: --workspace <path>, --repo <path>",
    "If repo doesn't exist: prompt to clone or create",
    "Create ~/.amcp/config.json with defaults",
    "Create repo directory structure (core/, workspace/, etc.)",
    "Create initial CHECKPOINT.json",
    "Write tests"
  ],
  "output": "packages/amcp-cli/src/commands/init.ts",
  "passes": false
}
```

---

## Phase 2: Config Management

```json
{
  "id": "git-010",
  "category": "config",
  "description": "Create config loader/writer",
  "steps": [
    "Create packages/amcp-cli/src/config.ts",
    "loadConfig(): Read ~/.amcp/config.json",
    "saveConfig(): Write ~/.amcp/config.json",
    "mergeConfig(): Merge repo config over global",
    "validateConfig(): Check required fields",
    "Define ConfigSchema type from spec"
  ],
  "output": "packages/amcp-cli/src/config.ts",
  "passes": false
}
```

```json
{
  "id": "git-011",
  "category": "cli",
  "description": "Implement amcp config command",
  "depends": ["git-010"],
  "steps": [
    "Create packages/amcp-cli/src/commands/config.ts",
    "amcp config — show current config",
    "amcp config get <key> — get specific value",
    "amcp config set <key> <value> — set value",
    "Pretty print config with colors"
  ],
  "output": "packages/amcp-cli/src/commands/config.ts",
  "passes": false
}
```

---

## Phase 3: Core Operations

```json
{
  "id": "git-020",
  "category": "core",
  "description": "Create file sync module",
  "steps": [
    "Create packages/amcp-cli/src/sync.ts",
    "copyToRepo(workspace, repo, include, exclude)",
    "copyFromRepo(repo, workspace)",
    "Use glob patterns for include/exclude",
    "Preserve directory structure",
    "Return list of copied files"
  ],
  "output": "packages/amcp-cli/src/sync.ts",
  "passes": false
}
```

```json
{
  "id": "git-021",
  "category": "core",
  "description": "Create git operations module",
  "steps": [
    "Create packages/amcp-cli/src/git.ts",
    "gitAdd(repoPath): git add -A",
    "gitCommit(repoPath, message): git commit -m",
    "gitPush(repoPath, remote, branch)",
    "gitPull(repoPath, remote, branch)",
    "gitLog(repoPath, limit): parse git log",
    "gitCheckout(repoPath, ref)",
    "Use simple-git or shell exec"
  ],
  "output": "packages/amcp-cli/src/git.ts",
  "passes": false
}
```

```json
{
  "id": "git-022",
  "category": "core",
  "description": "Create checkpoint metadata module",
  "steps": [
    "Create packages/amcp-cli/src/checkpoint.ts",
    "createCheckpointMeta(note, stats): CheckpointJson",
    "readCheckpointMeta(repoPath): CheckpointJson",
    "writeCheckpointMeta(repoPath, meta)",
    "Define CheckpointJson type from spec"
  ],
  "output": "packages/amcp-cli/src/checkpoint.ts",
  "passes": false
}
```

---

## Phase 4: CLI Commands

```json
{
  "id": "git-030",
  "category": "cli",
  "description": "Implement amcp checkpoint command",
  "depends": ["git-020", "git-021", "git-022"],
  "steps": [
    "Create packages/amcp-cli/src/commands/checkpoint.ts",
    "Load config",
    "Copy files from workspace to repo (sync.ts)",
    "Count files for stats",
    "Create CHECKPOINT.json",
    "Git add, commit, push",
    "Print summary: commit hash, files, timestamp"
  ],
  "output": "packages/amcp-cli/src/commands/checkpoint.ts",
  "passes": false
}
```

```json
{
  "id": "git-031",
  "category": "cli",
  "description": "Implement amcp recover command",
  "depends": ["git-020", "git-021", "git-022"],
  "steps": [
    "Create packages/amcp-cli/src/commands/recover.ts",
    "Load config",
    "Git pull latest",
    "Read CHECKPOINT.json, show info",
    "Copy files from repo to workspace",
    "Print summary: files restored, checkpoint info"
  ],
  "output": "packages/amcp-cli/src/commands/recover.ts",
  "passes": false
}
```

```json
{
  "id": "git-032",
  "category": "cli",
  "description": "Implement amcp restore command",
  "depends": ["git-031"],
  "steps": [
    "Create packages/amcp-cli/src/commands/restore.ts",
    "Accept commit hash as argument",
    "Git checkout <hash> (detached HEAD)",
    "Copy files from repo to workspace",
    "Git checkout main (return)",
    "Print summary"
  ],
  "output": "packages/amcp-cli/src/commands/restore.ts",
  "passes": false
}
```

```json
{
  "id": "git-033",
  "category": "cli",
  "description": "Implement amcp history command",
  "depends": ["git-021"],
  "steps": [
    "Create packages/amcp-cli/src/commands/history.ts",
    "Accept --limit N flag (default 10)",
    "Git log, parse commits",
    "Format: hash | timestamp | note",
    "Color output"
  ],
  "output": "packages/amcp-cli/src/commands/history.ts",
  "passes": false
}
```

```json
{
  "id": "git-034",
  "category": "cli",
  "description": "Implement amcp diff command",
  "depends": ["git-021"],
  "steps": [
    "Create packages/amcp-cli/src/commands/diff.ts",
    "Accept two commit hashes",
    "Git diff between them",
    "Pretty print with colors",
    "Optional: --stat for summary only"
  ],
  "output": "packages/amcp-cli/src/commands/diff.ts",
  "passes": false
}
```

---

## Phase 5: Testing

```json
{
  "id": "git-040",
  "category": "testing",
  "description": "Unit tests for config module",
  "depends": ["git-010"],
  "steps": [
    "Create packages/amcp-cli/tests/config.test.ts",
    "Test loadConfig with valid file",
    "Test loadConfig with missing file (defaults)",
    "Test validateConfig",
    "Test mergeConfig"
  ],
  "output": "packages/amcp-cli/tests/config.test.ts",
  "passes": false
}
```

```json
{
  "id": "git-041",
  "category": "testing",
  "description": "Unit tests for sync module",
  "depends": ["git-020"],
  "steps": [
    "Create packages/amcp-cli/tests/sync.test.ts",
    "Test copyToRepo with include patterns",
    "Test copyToRepo with exclude patterns",
    "Test copyFromRepo",
    "Use temp directories"
  ],
  "output": "packages/amcp-cli/tests/sync.test.ts",
  "passes": false
}
```

```json
{
  "id": "git-042",
  "category": "testing",
  "description": "E2E test: checkpoint → recover roundtrip",
  "depends": ["git-030", "git-031"],
  "steps": [
    "Create packages/amcp-cli/tests/e2e.test.ts",
    "Setup: Create temp workspace and repo",
    "Run amcp checkpoint",
    "Delete workspace files",
    "Run amcp recover",
    "Verify files restored correctly"
  ],
  "output": "packages/amcp-cli/tests/e2e.test.ts",
  "passes": false
}
```

---

## Phase 6: Migration from Bash Scripts

```json
{
  "id": "git-050",
  "category": "migration",
  "description": "Migrate existing memories repo to spec format",
  "depends": ["git-030"],
  "steps": [
    "Check if ~/memories exists",
    "Verify structure matches spec",
    "If not: Reorganize directories",
    "Update CHECKPOINT.json to spec schema",
    "Commit migration"
  ],
  "output": "One-time migration script",
  "passes": false
}
```

```json
{
  "id": "git-051",
  "category": "migration",
  "description": "Deprecate bash scripts",
  "depends": ["git-050"],
  "steps": [
    "Add deprecation notice to git-checkpoint.sh",
    "Add deprecation notice to git-recover.sh",
    "Point to amcp CLI as replacement",
    "Keep scripts for reference"
  ],
  "output": "Deprecated bash scripts",
  "passes": false
}
```

---

## Phase 7: Documentation

```json
{
  "id": "git-060",
  "category": "docs",
  "description": "Write AMCP-Git README",
  "depends": ["git-034"],
  "steps": [
    "Create packages/amcp-cli/README.md",
    "Quick start guide",
    "All commands with examples",
    "Config reference",
    "FAQ"
  ],
  "output": "packages/amcp-cli/README.md",
  "passes": false
}
```

```json
{
  "id": "git-061",
  "category": "docs",
  "description": "Update AMCP main README",
  "depends": ["git-060"],
  "steps": [
    "Update amcp-protocol/README.md",
    "Explain Git backend is default",
    "Link to AMCP-GIT-SPEC.md",
    "Explain IPFS backend is optional/future"
  ],
  "output": "amcp-protocol/README.md",
  "passes": false
}
```

---

## Execution Order

### Week 1: Foundation
1. git-001 → CLI entry point
2. git-010 → Config module
3. git-002 → amcp init
4. git-011 → amcp config

### Week 2: Core
5. git-020 → File sync
6. git-021 → Git operations
7. git-022 → Checkpoint metadata
8. git-030 → amcp checkpoint
9. git-031 → amcp recover

### Week 3: Extended
10. git-032 → amcp restore
11. git-033 → amcp history
12. git-034 → amcp diff

### Week 4: Polish
13. git-040, 041, 042 → Tests
14. git-050, 051 → Migration
15. git-060, 061 → Docs

---

## Definition of Done

- [ ] `amcp init` creates proper repo structure
- [ ] `amcp checkpoint` syncs files and commits
- [ ] `amcp recover` restores from latest
- [ ] `amcp restore <hash>` restores specific point
- [ ] `amcp history` shows checkpoint list
- [ ] `amcp config` manages settings
- [ ] All tests pass
- [ ] README complete
- [ ] Bash scripts deprecated

---

## After AMCP-Git is Complete

THEN we build proactive-amcp:
- Hook `amcp checkpoint` into heartbeat
- Hook `amcp recover` into session start
- Simple wrappers, not new logic

---

*Created: 2026-02-11T00:26 UTC*
*Based on: AMCP-GIT-SPEC.md v0.1*
