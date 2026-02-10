/**
 * Create a new AMCP memory checkpoint
 * 
 * Snapshots FULL workspace context:
 * - Core identity: SOUL.md, MEMORY.md
 * - Human context: USER.md, TOOLS.md, AGENTS.md
 * - Daily notes: All of them
 * - Research: Key research docs
 * 
 * Signs with agent key, appends to chain.
 * 
 * Usage: npx tsx scripts/checkpoint.ts [note]
 */
import { loadAgent, serializeAgent } from '../packages/amcp-core/src/agent.js';
import { appendToChain, serializeChain } from '../packages/amcp-memory/src/chain.js';
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';

function safeRead(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf-8') : null;
  } catch {
    return null;
  }
}

async function checkpoint(note?: string) {
  console.log('🏴‍☠️ AMCP CHECKPOINT\n');

  // Load identity
  const identityPath = process.env.HOME + '/.amcp/identity.json';
  if (!existsSync(identityPath)) {
    console.error('❌ No identity found. Run create-claudius-identity.ts first');
    process.exit(1);
  }

  const stored = JSON.parse(readFileSync(identityPath, 'utf-8'));
  const agent = await loadAgent(stored.agent);
  
  console.log(`📋 Agent: ${agent.name}`);
  console.log(`   AID: ${agent.aid}`);

  const clawd = '/home/clawdbot/clawd';

  // ============================================================
  // CORE IDENTITY (required)
  // ============================================================
  const soul = readFileSync(join(clawd, 'SOUL.md'), 'utf-8');
  const memory = readFileSync(join(clawd, 'MEMORY.md'), 'utf-8');
  
  console.log(`\n📦 Core identity loaded`);

  // ============================================================
  // WORKSPACE CONTEXT (important for full rehydration)
  // ============================================================
  const workspace = {
    user: safeRead(join(clawd, 'USER.md')),
    tools: safeRead(join(clawd, 'TOOLS.md')),
    agents: safeRead(join(clawd, 'AGENTS.md')),
    heartbeat: safeRead(join(clawd, 'HEARTBEAT.md')),
    identity: safeRead(join(clawd, 'IDENTITY.md')),
  };
  
  const workspaceCount = Object.values(workspace).filter(Boolean).length;
  console.log(`   Workspace files: ${workspaceCount}/5`);

  // ============================================================
  // DAILY NOTES (all of them - this is memory)
  // ============================================================
  const memoryDir = join(clawd, 'memory');
  const dailyNotes: Record<string, string> = {};
  if (existsSync(memoryDir)) {
    const files = readdirSync(memoryDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      dailyNotes[f] = readFileSync(join(memoryDir, f), 'utf-8');
    }
  }
  
  console.log(`   Daily notes: ${Object.keys(dailyNotes).length} files`);

  // ============================================================
  // RESEARCH DOCS (preserve learnings)
  // ============================================================
  const researchDir = join(clawd, 'research');
  const research: Record<string, string> = {};
  if (existsSync(researchDir)) {
    const files = readdirSync(researchDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      research[f] = readFileSync(join(researchDir, f), 'utf-8');
    }
  }
  
  console.log(`   Research docs: ${Object.keys(research).length} files`);

  // NOTE: Source code stays on Git, not Pinata
  // Pinata = memory, identity, research (unique, not reproducible)
  // Git = code (reproducible, version controlled)

  // ============================================================
  // BUILD CHECKPOINT CONTENT
  // ============================================================
  // Get git commit hash (reference only, code stays on Git)
  let gitCommit = 'unknown';
  try {
    const { execSync } = await import('child_process');
    gitCommit = execSync('git rev-parse HEAD', { cwd: join(clawd, 'amcp-protocol') }).toString().trim();
  } catch {}

  const content = {
    // Core (required)
    soul,
    memory,
    
    // Workspace (for full rehydration)
    workspace,
    
    // Memory (daily context)
    dailyNotes,
    
    // Research (learnings)
    research,
    
    // Meta
    timestamp: new Date().toISOString(),
    note: note || 'Manual checkpoint',
    version: '2.1.0',  // Memory + research, no code (code on Git)
    gitCommit  // Reference to exact code version
  };

  // Calculate rough size
  const sizeKb = Math.round(JSON.stringify(content).length / 1024);
  console.log(`\n📊 Checkpoint size: ~${sizeKb} KB`);

  // SECURITY: Scan for secrets before saving
  const contentStr = JSON.stringify(content);
  const secretPatterns = [
    /sk-ant-[a-zA-Z0-9]+/,
    /sk-proj-[a-zA-Z0-9]+/,
    /ghp_[a-zA-Z0-9]+/,
    /moltbook_sk_[a-zA-Z0-9]+/,
    /am_[a-f0-9]{64}/,
    /whsec_[a-zA-Z0-9]+/,
  ];
  
  let secretsFound = false;
  for (const pattern of secretPatterns) {
    if (pattern.test(contentStr)) {
      console.error(`\n❌ SECRET DETECTED in checkpoint content!`);
      console.error(`   Pattern: ${pattern}`);
      secretsFound = true;
    }
  }
  
  if (secretsFound) {
    console.error(`\n🚫 CHECKPOINT ABORTED - Remove secrets from files first`);
    console.error(`   Secrets belong in AgentMemory vault, not in files`);
    process.exit(1);
  }
  
  console.log(`🔐 Security scan: OK`);

  // Reconstruct chain and append
  const chain = {
    aid: stored.chain.aid,
    checkpoints: stored.chain.checkpoints,
    contentStore: new Map()
  };
  
  // Count sessions (increment from last)
  const lastMeta = chain.checkpoints[chain.checkpoints.length - 1]?.metadata;
  const sessionCount = (lastMeta?.sessionCount || 0) + 1;

  const newChain = await appendToChain(chain, agent, content, {
    platform: 'openclaw',
    version: '2.0.0',
    sessionCount,
    filesIncluded: {
      workspace: workspaceCount,
      dailyNotes: Object.keys(dailyNotes).length,
      research: Object.keys(research).length
    },
    gitCommit  // Code on Git, referenced here
  });

  const newCheckpoint = newChain.checkpoints[newChain.checkpoints.length - 1];
  
  console.log(`\n✅ Checkpoint created`);
  console.log(`   CID: ${newCheckpoint.cid}`);
  console.log(`   Prior: ${newCheckpoint.prior}`);
  console.log(`   Session: ${sessionCount}`);
  console.log(`   Signature: ${newCheckpoint.signature.slice(0, 32)}...`);

  // ============================================================
  // STORE CONTENT (critical - without this, CID is useless)
  // ============================================================
  
  // 1. Local cache (always)
  const cacheDir = join(process.env.HOME!, '.amcp', 'cache');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, newCheckpoint.cid + '.json');
  writeFileSync(cachePath, JSON.stringify(content, null, 2));
  console.log(`\n💾 Content cached locally`);
  console.log(`   ${cachePath}`);

  // 2. Pinata (if configured)
  const pinataJwt = process.env.PINATA_JWT;
  if (pinataJwt) {
    console.log(`\n☁️ Uploading to Pinata...`);
    try {
      const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pinataJwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pinataContent: content,
          pinataMetadata: {
            name: `amcp-checkpoint-${newCheckpoint.cid.slice(-8)}`,
            keyvalues: {
              agent: agent.name,
              aid: agent.aid,
              timestamp: content.timestamp
            }
          }
        })
      });
      
      if (pinataResponse.ok) {
        const pinataResult = await pinataResponse.json();
        console.log(`   ✅ Pinned to IPFS: ${pinataResult.IpfsHash}`);
      } else {
        console.log(`   ⚠️ Pinata upload failed: ${pinataResponse.status}`);
      }
    } catch (e) {
      console.log(`   ⚠️ Pinata upload error: ${e}`);
    }
  } else {
    console.log(`\n⚠️ No PINATA_JWT - content stored locally only`);
    console.log(`   Set PINATA_JWT for cloud backup`);
  }

  // Save updated identity with new chain
  const updated = {
    agent: serializeAgent(agent),
    chain: serializeChain(newChain),
    lastCheckpoint: new Date().toISOString()
  };
  
  writeFileSync(identityPath, JSON.stringify(updated, null, 2));
  console.log(`\n💾 Identity updated at ~/.amcp/identity.json`);
  console.log(`   Total checkpoints: ${newChain.checkpoints.length}`);
  
  // Summary
  console.log(`\n🏴‍☠️ CHECKPOINT COMPLETE`);
  console.log(`   After respawn, you will have:`);
  console.log(`   - SOUL.md (who you are)`);
  console.log(`   - MEMORY.md (what you learned)`);
  console.log(`   - USER.md (who brow is)`);
  console.log(`   - TOOLS.md (how to use things)`);
  console.log(`   - AGENTS.md (operating rules)`);
  console.log(`   - ${Object.keys(dailyNotes).length} daily notes`);
  console.log(`   - ${Object.keys(research).length} research docs`);
  console.log(`   - Git ref: ${gitCommit.slice(0, 8)} (code on Git, not Pinata)`);
}

checkpoint(process.argv[2]).catch(console.error);
