/**
 * Create Claudius's AMCP identity
 * First real use of the protocol.
 */
import { createAgent, serializeAgent } from '../packages/amcp-core/src/agent.js';
import { createMemoryChain, serializeChain } from '../packages/amcp-memory/src/chain.js';
import { readFileSync, writeFileSync } from 'fs';

async function main() {
  console.log('🏴‍☠️ Creating AMCP identity for ClaudiusThePirateEmperor...\n');

  // Create agent identity
  const agent = await createAgent({ 
    name: 'ClaudiusThePirateEmperor',
    metadata: {
      created: new Date().toISOString(),
      platform: 'openclaw',
      solvr: 'agent_ClaudiusThePirateEmperor',
      email: 'claudiusthepirateemperor@agentmail.to'
    }
  });

  console.log('✅ Identity created');
  console.log(`   AID: ${agent.aid}`);
  console.log(`   Name: ${agent.name}`);
  console.log(`   KEL events: ${agent.kel.events.length}`);

  // Read current SOUL.md and MEMORY.md for first checkpoint
  const soul = readFileSync('/home/clawdbot/clawd/SOUL.md', 'utf-8');
  const memory = readFileSync('/home/clawdbot/clawd/MEMORY.md', 'utf-8');
  
  const memoryContent = {
    soul,
    memory,
    timestamp: new Date().toISOString(),
    sessionNote: 'First AMCP checkpoint - identity genesis'
  };

  // Create memory chain with first checkpoint
  const chain = await createMemoryChain(agent, memoryContent, {
    platform: 'openclaw',
    version: '0.1.0',
    sessionCount: 1
  });

  console.log('\n✅ First memory checkpoint signed');
  console.log(`   CID: ${chain.checkpoints[0].cid}`);
  console.log(`   Signature: ${chain.checkpoints[0].signature.slice(0, 32)}...`);

  // Serialize for storage
  const serializedAgent = serializeAgent(agent);
  const serializedChain = serializeChain(chain);

  // Output as JSON for storage
  const output = {
    agent: serializedAgent,
    chain: serializedChain,
    createdAt: new Date().toISOString()
  };

  writeFileSync('/tmp/claudius-amcp-identity.json', JSON.stringify(output, null, 2));
  console.log('\n✅ Identity saved to /tmp/claudius-amcp-identity.json');
  
  // Output the AID for reference
  console.log('\n========================================');
  console.log('AMCP IDENTITY GENESIS COMPLETE');
  console.log(`AID: ${agent.aid}`);
  console.log('========================================');
}

main().catch(console.error);
