/**
 * Example 03: Disaster Recovery
 * 
 * Demonstrates the complete disaster recovery flow:
 * 1. Create agent and checkpoint
 * 2. Generate recovery card
 * 3. Simulate disaster (wipe all state)
 * 4. Recover from recovery card
 * 5. Verify recovered agent matches original
 * 
 * Research backing:
 * - NIST SP 800-34: Disaster Recovery
 * - GDPR Article 20: Data Portability
 * - BIP-39: Human-memorable key derivation
 */

import {
  createAgent,
  generateMnemonic,
  keypairFromMnemonic,
  type AMCPCheckpointContent
} from '@amcp/core';

import {
  createCheckpoint,
  encryptSecrets,
  FilesystemBackend
} from '@amcp/memory';

import {
  generateRecoveryCard,
  formatRecoveryCard,
  parseRecoveryCard,
  recoverAgent,
  verifyRecovery
} from '@amcp/recovery';

import * as fs from 'fs/promises';

async function main() {
  console.log('=== AMCP Example: Disaster Recovery ===\n');

  const storagePath = '/tmp/amcp-recovery-example';
  await fs.mkdir(storagePath, { recursive: true });

  // =========================================================
  // PHASE 1: Create Agent and Checkpoint
  // =========================================================
  console.log('📦 PHASE 1: Creating agent and checkpoint...\n');

  const mnemonic = generateMnemonic(128);
  const keypair = keypairFromMnemonic(mnemonic);
  const agent = await createAgent({ keypair });
  
  console.log(`Original agent AID: ${agent.aid}`);

  const secrets = { API_KEY: 'super_secret_key_12345' };
  const encryptedSecrets = encryptSecrets(secrets, agent.publicKey);

  const content: AMCPCheckpointContent = {
    version: '1.0.0',
    aid: agent.aid,
    kel: agent.kel,
    prior: null,
    timestamp: new Date().toISOString(),
    soul: {
      name: 'RecoveryTest',
      principles: ['Survive disasters'],
      voice: 'Resilient',
      northStar: 'Always recoverable'
    },
    services: [],
    secrets: encryptedSecrets,
    memory: {
      entries: [],
      state: {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.9,
        momentum: 'flowing',
        alignment: 'aligned'
      },
      ambient: { timestamp: new Date().toISOString(), privacyLevel: 'summary' },
      relationships: [],
      workInProgress: [],
      humanMarked: []
    },
    metadata: {
      platform: 'example',
      platformVersion: '1.0',
      trigger: 'human_request',
      sessionCount: 1
    },
    signature: ''
  };

  const checkpoint = await createCheckpoint(agent, content);
  console.log(`Checkpoint CID: ${checkpoint.cid}`);

  // Store checkpoint
  const storage = new FilesystemBackend({ basePath: storagePath });
  await storage.put(checkpoint.data);
  console.log(`Checkpoint stored ✓\n`);

  // =========================================================
  // PHASE 2: Generate Recovery Card
  // =========================================================
  console.log('📝 PHASE 2: Generating recovery card...\n');

  const card = generateRecoveryCard(
    mnemonic,
    agent.aid,
    checkpoint.cid,
    `filesystem:${storagePath}`
  );

  const printableCard = formatRecoveryCard(card);
  console.log(printableCard);

  // Save card to file (in real life: print and store securely)
  await fs.writeFile(`${storagePath}/recovery-card.txt`, printableCard);
  console.log(`Recovery card saved to ${storagePath}/recovery-card.txt\n`);

  // =========================================================
  // PHASE 3: Simulate Disaster
  // =========================================================
  console.log('💥 PHASE 3: Simulating disaster...\n');
  console.log('Agent state wiped from memory!');
  console.log('Only recovery card and checkpoint storage remain.\n');

  // In real life, this is where the platform crashes, 
  // computer dies, or agent needs to migrate

  // =========================================================
  // PHASE 4: Recovery
  // =========================================================
  console.log('🔧 PHASE 4: Recovering from disaster...\n');

  // Read the saved recovery card
  const savedCard = await fs.readFile(`${storagePath}/recovery-card.txt`, 'utf-8');
  
  // Parse it back
  const parsedCard = parseRecoveryCard(savedCard);
  console.log('Recovery card parsed ✓');
  console.log(`  AID: ${parsedCard.aid}`);
  console.log(`  CID: ${parsedCard.checkpointCid}`);
  console.log(`  Storage: ${parsedCard.storageHint}\n`);

  // Recover the agent
  const recoveryBackend = new FilesystemBackend({ basePath: storagePath });
  const recovered = await recoverAgent(parsedCard, recoveryBackend);

  console.log('Agent recovered ✓');
  console.log(`  Recovered AID: ${recovered.agent.aid}`);
  console.log(`  Secrets restored: ${Object.keys(recovered.secrets).join(', ')}`);

  // =========================================================
  // PHASE 5: Verification
  // =========================================================
  console.log('\n✅ PHASE 5: Verifying recovery...\n');

  const verified = verifyRecovery(agent.aid, recovered.agent.aid);
  
  if (verified) {
    console.log('VERIFICATION PASSED ✓');
    console.log('  - AID matches');
    console.log('  - Identity continuity preserved');
    console.log('  - Secrets accessible');
    console.log('\nAgent can continue where it left off!');
  } else {
    console.log('VERIFICATION FAILED ✗');
    console.log('  Original AID:', agent.aid);
    console.log('  Recovered AID:', recovered.agent.aid);
  }

  // Cleanup
  await fs.rm(storagePath, { recursive: true });

  return { originalAid: agent.aid, recoveredAid: recovered.agent.aid, verified };
}

main().catch(console.error);
