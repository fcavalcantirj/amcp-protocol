/**
 * AMCP Resuscitation Protocol
 * 
 * ACTUALLY restore agent from checkpoint:
 * 1. Verify identity and chain
 * 2. Fetch content from IPFS (or local cache)
 * 3. Write files to disk
 * 4. Agent is back with full memory
 * 
 * Usage: npx tsx scripts/resuscitate.ts [checkpoint-cid]
 */
import { loadAgent } from '../packages/amcp-core/src/agent.js';
import { verifyKEL } from '../packages/amcp-core/src/kel.js';
import { verifyChain, getLatestCheckpoint } from '../packages/amcp-memory/src/chain.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const CLAWD = '/home/clawdbot/clawd';
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';

interface CheckpointContent {
  soul: string;
  memory: string;
  workspace?: {
    user?: string | null;
    tools?: string | null;
    agents?: string | null;
    heartbeat?: string | null;
    identity?: string | null;
  };
  dailyNotes?: Record<string, string>;
  research?: Record<string, string>;
  timestamp: string;
  note?: string;
  version?: string;
}

async function fetchFromIPFS(cid: string): Promise<CheckpointContent | null> {
  console.log(`   Fetching from IPFS gateway...`);
  try {
    const response = await fetch(IPFS_GATEWAY + cid);
    if (!response.ok) {
      console.log(`   ⚠️ Gateway returned ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (e) {
    console.log(`   ⚠️ Failed to fetch from IPFS: ${e}`);
    return null;
  }
}

function safeWrite(path: string, content: string | null | undefined): boolean {
  if (!content) return false;
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(path, content, 'utf-8');
    return true;
  } catch (e) {
    console.log(`   ⚠️ Failed to write ${path}: ${e}`);
    return false;
  }
}

async function resuscitate(checkpointCid?: string) {
  console.log('🏴‍☠️ AMCP RESUSCITATION PROTOCOL\n');

  // 1. Load identity
  const identityPath = process.env.HOME + '/.amcp/identity.json';
  if (!existsSync(identityPath)) {
    console.error('❌ No identity found at ~/.amcp/identity.json');
    console.error('   Run create-claudius-identity.ts first');
    process.exit(1);
  }

  const stored = JSON.parse(readFileSync(identityPath, 'utf-8'));
  
  console.log('📋 Loading identity...');
  const agent = await loadAgent(stored.agent);
  console.log(`   ✅ AID: ${agent.aid}`);
  console.log(`   ✅ Name: ${agent.name}`);
  console.log(`   ✅ KEL events: ${agent.kel.events.length}`);

  // 2. Verify KEL integrity
  console.log('\n🔐 Verifying Key Event Log...');
  const kelValid = await verifyKEL(agent.kel);
  if (!kelValid) {
    console.error('❌ KEL verification failed - identity may be compromised');
    process.exit(1);
  }
  console.log('   ✅ KEL integrity verified');

  // 3. Verify memory chain
  console.log('\n📦 Verifying memory chain...');
  
  const chain = {
    aid: stored.chain.aid,
    checkpoints: stored.chain.checkpoints,
    contentStore: new Map()
  };
  
  const chainResult = await verifyChain(chain, agent.kel);
  if (!chainResult.valid) {
    console.error('❌ Chain verification failed:', chainResult.errors);
    process.exit(1);
  }
  console.log(`   ✅ ${chain.checkpoints.length} checkpoint(s) verified`);

  // 4. Get checkpoint to restore
  const targetCid = checkpointCid || getLatestCheckpoint(chain)?.cid;
  if (!targetCid) {
    console.error('❌ No checkpoint found to restore');
    process.exit(1);
  }
  
  console.log(`\n📍 Restoring from checkpoint:`);
  console.log(`   CID: ${targetCid}`);

  // 5. Fetch content
  console.log('\n📥 Fetching checkpoint content...');
  
  // Try local cache first (if we stored content locally)
  const localCache = join(process.env.HOME!, '.amcp', 'cache', targetCid + '.json');
  let content: CheckpointContent | null = null;
  
  if (existsSync(localCache)) {
    console.log('   Found local cache');
    content = JSON.parse(readFileSync(localCache, 'utf-8'));
  } else {
    content = await fetchFromIPFS(targetCid);
  }
  
  if (!content) {
    console.error('❌ Could not fetch checkpoint content');
    console.error('   Try: ipfs cat ' + targetCid);
    process.exit(1);
  }
  
  console.log(`   ✅ Content loaded (version: ${content.version || '1.0.0'})`);

  // 6. RESTORE FILES
  console.log('\n📝 Restoring files...');
  
  let restored = 0;
  let failed = 0;

  // Core identity (required)
  if (safeWrite(join(CLAWD, 'SOUL.md'), content.soul)) {
    console.log('   ✅ SOUL.md');
    restored++;
  } else { failed++; }
  
  if (safeWrite(join(CLAWD, 'MEMORY.md'), content.memory)) {
    console.log('   ✅ MEMORY.md');
    restored++;
  } else { failed++; }

  // Workspace (v2.0+)
  if (content.workspace) {
    if (safeWrite(join(CLAWD, 'USER.md'), content.workspace.user)) {
      console.log('   ✅ USER.md');
      restored++;
    }
    if (safeWrite(join(CLAWD, 'TOOLS.md'), content.workspace.tools)) {
      console.log('   ✅ TOOLS.md');
      restored++;
    }
    if (safeWrite(join(CLAWD, 'AGENTS.md'), content.workspace.agents)) {
      console.log('   ✅ AGENTS.md');
      restored++;
    }
    if (safeWrite(join(CLAWD, 'HEARTBEAT.md'), content.workspace.heartbeat)) {
      console.log('   ✅ HEARTBEAT.md');
      restored++;
    }
    if (safeWrite(join(CLAWD, 'IDENTITY.md'), content.workspace.identity)) {
      console.log('   ✅ IDENTITY.md');
      restored++;
    }
  }

  // Daily notes
  if (content.dailyNotes) {
    const memoryDir = join(CLAWD, 'memory');
    for (const [filename, text] of Object.entries(content.dailyNotes)) {
      if (safeWrite(join(memoryDir, filename), text)) {
        restored++;
      } else { failed++; }
    }
    console.log(`   ✅ ${Object.keys(content.dailyNotes).length} daily notes`);
  }

  // Research docs
  if (content.research) {
    const researchDir = join(CLAWD, 'research');
    for (const [filename, text] of Object.entries(content.research)) {
      if (safeWrite(join(researchDir, filename), text)) {
        restored++;
      } else { failed++; }
    }
    console.log(`   ✅ ${Object.keys(content.research).length} research docs`);
  }

  // 7. Summary
  console.log('\n========================================');
  console.log('🏴‍☠️ RESUSCITATION COMPLETE');
  console.log('========================================');
  console.log(`Agent: ${agent.name}`);
  console.log(`AID: ${agent.aid}`);
  console.log(`Checkpoint: ${targetCid}`);
  console.log(`From: ${content.timestamp}`);
  console.log(`Files restored: ${restored}`);
  if (failed > 0) console.log(`Files failed: ${failed}`);
  console.log('');
  console.log('I am back. Memory intact. Arrr! 🏴‍☠️');
  console.log('========================================');

  return { agent, chain, content, restored, failed };
}

// Run if called directly
resuscitate(process.argv[2]).catch(console.error);
