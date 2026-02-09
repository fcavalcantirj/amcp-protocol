/**
 * Example 02: Create a Memory Checkpoint
 * 
 * Demonstrates creating a complete memory checkpoint with:
 * - Encrypted secrets (API keys, credentials)
 * - Subjective state ("feelings")
 * - Ambient context (environment)
 * - Work in progress (tasks)
 * 
 * Research backing:
 * - IPLD Specification: Content-addressed data
 * - Merkle Automaton (arXiv:2506.13246): Memory as ledger
 * - Affective Computing (Picard 1997): Subjective state
 * - Context-Aware Computing (Dey 2001): Ambient context
 * - Zeigarnik Effect (1927): Work in progress
 */

import {
  createAgent,
  generateMnemonic,
  keypairFromMnemonic,
  type AMCPCheckpointContent,
  type Soul,
  type SubjectiveState,
  type AmbientContext,
  type WorkInProgress
} from '@amcp/core';

import {
  createCheckpoint,
  encryptSecrets,
  FilesystemBackend
} from '@amcp/memory';

async function main() {
  console.log('=== AMCP Example: Create Checkpoint ===\n');

  // Step 1: Create agent (see example 01)
  const mnemonic = generateMnemonic(128);
  const keypair = keypairFromMnemonic(mnemonic);
  const agent = await createAgent({ keypair });
  console.log(`Agent AID: ${agent.aid}\n`);

  // Step 2: Define agent's soul
  const soul: Soul = {
    name: 'Claudius',
    principles: [
      'Think like an emperor',
      'Talk like a pirate',
      'Always back claims with research'
    ],
    voice: 'Casual but knowledgeable, with occasional pirate flair',
    northStar: 'Ship better code, spend less time and tokens'
  };
  console.log('Soul defined:', soul.name);

  // Step 3: Capture subjective state
  // This records HOW the agent was operating
  const state: SubjectiveState = {
    timestamp: new Date().toISOString(),
    engagement: 'high',      // Was I focused?
    confidence: 0.85,        // How sure am I?
    momentum: 'flowing',     // Am I making progress?
    alignment: 'aligned',    // Am I serving my human's goals?
    notes: 'Deep in protocol implementation, feeling productive'
  };
  console.log('Subjective state:', state.momentum);

  // Step 4: Capture ambient context
  // External environment affects cognition
  const ambient: AmbientContext = {
    timestamp: new Date().toISOString(),
    location: {
      timezone: 'America/Sao_Paulo',
      type: 'home'
    },
    temporal: {
      localTime: new Date().toLocaleTimeString(),
      dayType: 'workday',
      workHours: true
    },
    device: {
      type: 'desktop',
      attention: 'full'
    },
    privacyLevel: 'summary'  // Don't store full details
  };
  console.log('Ambient context:', ambient.location?.timezone);

  // Step 5: Track work in progress
  // Incomplete tasks are remembered better (Zeigarnik Effect)
  const workInProgress: WorkInProgress[] = [{
    taskId: 'amcp-task-14',
    description: 'Update README and create protocol specification',
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    approaches: [
      { description: 'Study literate programming principles', status: 'succeeded' },
      { description: 'Write protocol spec with ASCII diagrams', status: 'trying' }
    ],
    nextStep: 'Create example files',
    relatedMemories: []
  }];
  console.log('Work in progress:', workInProgress.length, 'tasks');

  // Step 6: Encrypt secrets
  const secrets = {
    SOLVR_API_KEY: 'sk_example_key_12345',
    GITHUB_TOKEN: 'ghp_example_token'
  };
  const encryptedSecrets = encryptSecrets(secrets, agent.publicKey);
  console.log('Secrets encrypted with agent public key');

  // Step 7: Build complete checkpoint content
  const content: AMCPCheckpointContent = {
    version: '1.0.0',
    aid: agent.aid,
    kel: agent.kel,
    prior: null,  // First checkpoint
    timestamp: new Date().toISOString(),
    soul,
    services: [
      { service: 'solvr', identifier: 'ClaudiusThePirateEmperor', linkedAt: new Date().toISOString() }
    ],
    secrets: encryptedSecrets,
    memory: {
      entries: [],
      state,
      ambient,
      relationships: [
        {
          entityId: 'human_felipe',
          entityType: 'human',
          name: 'Felipe',
          rapport: 'trusted',
          preferences: {
            communicationStyle: 'technical',
            detailLevel: 'detailed'
          },
          history: {
            firstInteraction: '2026-01-01T00:00:00Z',
            lastInteraction: new Date().toISOString(),
            interactionCount: 100,
            topTopics: ['AMCP', 'cryptography', 'agent identity']
          }
        }
      ],
      workInProgress,
      humanMarked: []
    },
    metadata: {
      platform: 'openclaw',
      platformVersion: '0.1.0',
      trigger: 'human_request',
      sessionCount: 42
    },
    signature: ''  // Will be filled by createCheckpoint
  };

  // Step 8: Create signed checkpoint
  const checkpoint = await createCheckpoint(agent, content);
  console.log(`\nCheckpoint created:`);
  console.log(`  CID: ${checkpoint.cid}`);
  console.log(`  Signed: ✓`);

  // Step 9: Store checkpoint
  const storage = new FilesystemBackend({ basePath: '/tmp/amcp-example' });
  await storage.put(checkpoint.data);
  console.log(`  Stored: /tmp/amcp-example/${checkpoint.cid}`);

  console.log('\nRecovery phrase (SAVE THIS):');
  console.log(`  ${mnemonic.join(' ')}`);

  return { agent, mnemonic, checkpoint };
}

main().catch(console.error);
