/**
 * Example 01: Create an Agent
 * 
 * Demonstrates creating a new agent with a BIP-39 mnemonic phrase
 * for disaster recovery.
 * 
 * Research backing:
 * - BIP-39 Specification (Bitcoin 2013): Human-memorable keys
 * - KERI (arXiv:1907.02143): Self-certifying identifiers
 */

import {
  createAgent,
  generateMnemonic,
  keypairFromMnemonic,
  validateMnemonic
} from '@amcp/core';

async function main() {
  console.log('=== AMCP Example: Create Agent ===\n');

  // Step 1: Generate a mnemonic phrase
  // 128-bit entropy = 12 words (sufficient for most use cases)
  // 256-bit entropy = 24 words (maximum security)
  const mnemonic = generateMnemonic(128);
  
  console.log('Recovery phrase (SAVE THIS SECURELY):');
  console.log(`  ${mnemonic.join(' ')}\n`);

  // Step 2: Validate the mnemonic
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic generated');
  }
  console.log('✓ Mnemonic validated\n');

  // Step 3: Derive keypair from mnemonic
  // This is deterministic: same mnemonic = same keypair
  const keypair = keypairFromMnemonic(mnemonic);
  console.log('Derived keypair:');
  console.log(`  Public key: ${Buffer.from(keypair.publicKey).toString('hex').slice(0, 32)}...`);
  console.log(`  (Private key is kept secure)\n`);

  // Step 4: Create agent
  const agent = await createAgent({ keypair });
  
  console.log('Agent created:');
  console.log(`  AID: ${agent.aid}`);
  console.log(`  KEL events: ${agent.kel.length}`);
  console.log(`  Created: ${new Date().toISOString()}\n`);

  // Step 5: Demonstrate determinism
  console.log('Verifying determinism...');
  const keypair2 = keypairFromMnemonic(mnemonic);
  const agent2 = await createAgent({ keypair: keypair2 });
  
  if (agent.aid === agent2.aid) {
    console.log('✓ Same mnemonic produces same AID (deterministic)\n');
  } else {
    console.log('✗ ERROR: Non-deterministic key derivation!\n');
  }

  // Step 6: Display soul template
  console.log('Soul template (customize for your agent):');
  console.log(JSON.stringify({
    name: 'Your Agent Name',
    principles: ['Be helpful', 'Be honest', 'Protect privacy'],
    voice: 'Describe your communication style',
    northStar: 'Your primary mission or goal'
  }, null, 2));

  return { agent, mnemonic };
}

main().catch(console.error);
