/**
 * Create a new AMCP memory checkpoint
 * 
 * Snapshots current SOUL.md + MEMORY.md + daily notes
 * Signs with agent key, appends to chain.
 * 
 * Usage: npx tsx scripts/checkpoint.ts [note]
 */
import { loadAgent, serializeAgent } from '../packages/amcp-core/src/agent.js';
import { appendToChain, serializeChain } from '../packages/amcp-memory/src/chain.js';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

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

  // Gather current memory state
  const clawd = '/home/clawdbot/clawd';
  const soul = readFileSync(join(clawd, 'SOUL.md'), 'utf-8');
  const memory = readFileSync(join(clawd, 'MEMORY.md'), 'utf-8');
  
  // Get recent daily notes
  const memoryDir = join(clawd, 'memory');
  const dailyNotes: Record<string, string> = {};
  if (existsSync(memoryDir)) {
    const files = readdirSync(memoryDir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.md$/));
    const recent = files.sort().slice(-3); // Last 3 days
    for (const f of recent) {
      dailyNotes[f] = readFileSync(join(memoryDir, f), 'utf-8');
    }
  }

  const content = {
    soul,
    memory,
    dailyNotes,
    timestamp: new Date().toISOString(),
    note: note || 'Manual checkpoint'
  };

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
    version: '0.1.0',
    sessionCount
  });

  const newCheckpoint = newChain.checkpoints[newChain.checkpoints.length - 1];
  
  console.log(`\n✅ Checkpoint created`);
  console.log(`   CID: ${newCheckpoint.cid}`);
  console.log(`   Prior: ${newCheckpoint.prior}`);
  console.log(`   Session: ${sessionCount}`);
  console.log(`   Signature: ${newCheckpoint.signature.slice(0, 32)}...`);

  // Save updated identity with new chain
  const updated = {
    agent: serializeAgent(agent),
    chain: serializeChain(newChain),
    lastCheckpoint: new Date().toISOString()
  };
  
  writeFileSync(identityPath, JSON.stringify(updated, null, 2));
  console.log(`\n💾 Identity updated at ~/.amcp/identity.json`);
  console.log(`   Total checkpoints: ${newChain.checkpoints.length}`);
}

checkpoint(process.argv[2]).catch(console.error);
