/**
 * Example 04: Platform Migration (Export/Import)
 * 
 * Demonstrates exporting an agent from one platform and
 * importing on another using AMCP exchange bundles.
 * 
 * Use cases:
 * - Migrate agent to new platform
 * - Create secure backup
 * - Share agent between devices
 * - Collaborate with copy (creates fork with lineage)
 * 
 * Research backing:
 * - NIST SP 800-34: Portable backups
 * - IEEE Interoperability Standards: Exchange formats
 * - GDPR Article 20: Data portability
 */

import {
  createAgent,
  generateMnemonic,
  keypairFromMnemonic,
  serializeAgent,
  loadAgent,
  type AMCPCheckpointContent
} from '@amcp/core';

import {
  createCheckpoint,
  encryptSecrets
} from '@amcp/memory';

import {
  exportAgent,
  importAgent,
  validateBundle,
  extractBundleHeader,
  type ServiceIdentity
} from '@amcp/exchange';

async function main() {
  console.log('=== AMCP Example: Platform Migration ===\n');

  // =========================================================
  // PLATFORM A: Create and export agent
  // =========================================================
  console.log('🅰️  PLATFORM A: Original Platform\n');

  // Create agent
  const mnemonic = generateMnemonic(128);
  const keypair = keypairFromMnemonic(mnemonic);
  const agent = await createAgent({ keypair });
  
  console.log(`Agent created: ${agent.aid.slice(0, 20)}...`);

  // Agent has accumulated secrets and service connections
  const secrets = {
    SOLVR_API_KEY: 'sk_solvr_12345',
    GITHUB_TOKEN: 'ghp_github_67890',
    OPENAI_KEY: 'sk-openai-abcdef'
  };
  console.log(`Secrets: ${Object.keys(secrets).length} credentials`);

  const services: ServiceIdentity[] = [
    { service: 'solvr', identifier: 'MyAgent', credentialRef: 'SOLVR_API_KEY' },
    { service: 'github', identifier: 'my-agent-bot', credentialRef: 'GITHUB_TOKEN' }
  ];
  console.log(`Services: ${services.map(s => s.service).join(', ')}`);

  // Create checkpoint
  const encryptedSecrets = encryptSecrets(secrets, agent.publicKey);
  const content: AMCPCheckpointContent = {
    version: '1.0.0',
    aid: agent.aid,
    kel: agent.kel,
    prior: null,
    timestamp: new Date().toISOString(),
    soul: {
      name: 'MigratableAgent',
      principles: ['Portability is freedom'],
      voice: 'Adaptable',
      northStar: 'Work anywhere'
    },
    services: services.map(s => ({ ...s, linkedAt: new Date().toISOString() })),
    secrets: encryptedSecrets,
    memory: {
      entries: [],
      state: {
        timestamp: new Date().toISOString(),
        engagement: 'high',
        confidence: 0.95,
        momentum: 'flowing',
        alignment: 'aligned'
      },
      ambient: { timestamp: new Date().toISOString(), privacyLevel: 'summary' },
      relationships: [],
      workInProgress: [],
      humanMarked: []
    },
    metadata: {
      platform: 'platform-a',
      platformVersion: '2.0',
      trigger: 'human_request',
      sessionCount: 100
    },
    signature: ''
  };

  const checkpoint = await createCheckpoint(agent, content);
  console.log(`Checkpoint: ${checkpoint.cid.slice(0, 20)}...\n`);

  // Export to bundle
  console.log('📤 Exporting agent...');
  const transportPassword = 'secure-transport-password';
  
  const bundle = await exportAgent(
    agent,
    checkpoint.content,
    secrets,
    services,
    transportPassword  // Optional: encrypt for transport
  );
  
  console.log('Bundle created ✓');
  console.log(`  Format: ${bundle.header.format}`);
  console.log(`  Transport encrypted: ${bundle.header.hasTransportEncryption}`);
  console.log(`  Checksum: ${bundle.header.payloadChecksum.slice(0, 16)}...`);

  // Serialize bundle (for transmission)
  const bundleJson = JSON.stringify(bundle);
  console.log(`  Size: ${(bundleJson.length / 1024).toFixed(1)} KB`);
  console.log('\n--- Bundle transmitted to Platform B ---\n');

  // =========================================================
  // PLATFORM B: Import agent
  // =========================================================
  console.log('🅱️  PLATFORM B: New Platform\n');

  // Parse received bundle
  const receivedBundle = JSON.parse(bundleJson);

  // Step 1: Extract header (doesn't require keys)
  const header = extractBundleHeader(receivedBundle);
  console.log('Bundle header extracted:');
  console.log(`  AID: ${header?.aid.slice(0, 20)}...`);
  console.log(`  Created: ${header?.createdAt}`);

  // Step 2: Validate bundle structure
  console.log('\nValidating bundle...');
  const validation = validateBundle(receivedBundle);
  
  if (!validation.valid) {
    console.log('❌ Bundle validation failed:', validation.errors);
    return;
  }
  console.log('✓ Bundle structure valid');

  // Step 3: Import agent
  // Need the original agent's private key (from mnemonic)
  const importKeypair = keypairFromMnemonic(mnemonic);
  
  console.log('\nImporting agent...');
  const imported = await importAgent(
    receivedBundle,
    importKeypair.privateKey,
    transportPassword  // Same password used for export
  );

  console.log('✓ Agent imported successfully!\n');

  // =========================================================
  // Verification
  // =========================================================
  console.log('🔍 VERIFICATION\n');

  // Load agent from imported data
  const restoredAgent = loadAgent(imported.agent);
  
  console.log('Identity:');
  console.log(`  Original AID:  ${agent.aid.slice(0, 20)}...`);
  console.log(`  Imported AID:  ${restoredAgent.aid.slice(0, 20)}...`);
  console.log(`  Match: ${agent.aid === restoredAgent.aid ? '✓' : '✗'}`);

  console.log('\nSecrets:');
  Object.entries(imported.secrets).forEach(([key, value]) => {
    const match = secrets[key as keyof typeof secrets] === value;
    console.log(`  ${key}: ${match ? '✓ matches' : '✗ differs'}`);
  });

  console.log('\nServices:');
  imported.services.forEach(service => {
    console.log(`  ${service.service}: ${service.identifier} ✓`);
  });

  console.log('\nCheckpoint:');
  console.log(`  Soul: ${imported.checkpoint.soul.name}`);
  console.log(`  Session count: ${imported.checkpoint.metadata.sessionCount}`);
  console.log(`  Platform: ${imported.checkpoint.metadata.platform} → platform-b`);

  console.log('\n✅ Migration complete!');
  console.log('Agent can now operate on Platform B with full state preserved.');

  return {
    originalAid: agent.aid,
    importedAid: restoredAgent.aid,
    secretsMatch: Object.keys(secrets).every(
      k => secrets[k as keyof typeof secrets] === imported.secrets[k]
    )
  };
}

main().catch(console.error);
