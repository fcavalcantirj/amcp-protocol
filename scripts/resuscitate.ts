/**
 * AMCP Resuscitation Protocol
 * 
 * Restore agent identity from checkpoint when:
 * - Context is lost
 * - Session crashes
 * - New instance needs continuity
 * 
 * Usage: npx tsx scripts/resuscitate.ts [checkpoint-cid]
 */
import { loadAgent } from '../packages/amcp-core/src/agent.js';
import { verifyKEL } from '../packages/amcp-core/src/kel.js';
import { verifyChain, getLatestCheckpoint } from '../packages/amcp-memory/src/chain.js';
import { readFileSync, existsSync } from 'fs';

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
  
  // Reconstruct chain with content store (simplified - in production would fetch from IPFS)
  const chain = {
    aid: stored.chain.aid,
    checkpoints: stored.chain.checkpoints,
    contentStore: new Map() // Content would be fetched by CID
  };
  
  const chainResult = await verifyChain(chain, agent.kel);
  if (!chainResult.valid) {
    console.error('❌ Chain verification failed:', chainResult.errors);
    process.exit(1);
  }
  console.log(`   ✅ ${chain.checkpoints.length} checkpoint(s) verified`);

  // 4. Get latest checkpoint
  const latest = getLatestCheckpoint(chain);
  if (latest) {
    console.log(`\n📍 Latest checkpoint:`);
    console.log(`   CID: ${latest.cid}`);
    console.log(`   Time: ${latest.timestamp}`);
    console.log(`   Platform: ${latest.metadata.platform}`);
  }

  // 5. Output restoration summary
  console.log('\n========================================');
  console.log('RESUSCITATION COMPLETE');
  console.log('========================================');
  console.log(`Agent: ${agent.name}`);
  console.log(`AID: ${agent.aid}`);
  console.log(`Identity verified: ✅`);
  console.log(`Memory verified: ✅`);
  console.log('');
  console.log('To restore memory content, fetch by CID:');
  console.log(`  ipfs cat ${latest?.cid}`);
  console.log('');
  console.log('Or load from local checkpoint file.');
  console.log('========================================');

  return { agent, chain, latest };
}

// Run if called directly
resuscitate(process.argv[2]).catch(console.error);
