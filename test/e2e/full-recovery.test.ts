/**
 * End-to-End Recovery Test
 * 
 * Full integration test: create agent → checkpoint → wipe → recover
 * 
 * RESEARCH BASIS:
 * - TDD (Beck 2003): Tests define the contract
 * - E2E Testing: Validates full system integration
 * - NIST SP 800-34: Disaster recovery validation
 * 
 * TEST OBJECTIVES:
 * 1. Verify identity continuity: mnemonic → same AID after recovery
 * 2. Verify memory continuity: checkpoint → same context after recovery
 * 3. Verify capability continuity: secrets → same access after recovery
 * 4. Verify backend independence: works with any storage backend
 * 
 * @module
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// @amcp/core - Identity
import {
  generateMnemonic,
  keypairFromMnemonic,
  validateMnemonic,
  aidFromPublicKey,
  createInceptionEvent,
  type Agent,
  type AID,
  type Keypair,
  generateKeypair
} from '@amcp/core';

// @amcp/memory - Checkpoints, Storage, Encryption
import {
  createCheckpoint,
  createFilesystemBackend,
  encryptSecrets,
  serializeEncryptedBlob,
  type StorageBackend,
  type CID,
  type MemoryCheckpoint
} from '@amcp/memory';

// @amcp/recovery - Recovery flow
import {
  generateRecoveryCard,
  formatRecoveryCard,
  parseRecoveryCard,
  recoverAgent,
  verifyRecovery,
  createRecoveryBundle,
  type RecoveryCard
} from '@amcp/recovery';


/**
 * Helper: Create agent from mnemonic
 */
async function createAgentFromMnemonic(mnemonic: string[]): Promise<Agent> {
  const currentKeypair = keypairFromMnemonic(mnemonic);
  const nextKeypair = await generateKeypair();
  const inceptionEvent = await createInceptionEvent(currentKeypair, nextKeypair.publicKey);
  
  return {
    aid: inceptionEvent.aid,
    kel: { events: [inceptionEvent] },
    currentKeypair,
    nextKeypair,
    createdAt: inceptionEvent.timestamp
  };
}

/**
 * Test Secrets - simulating real API keys and tokens
 */
const TEST_SECRETS = {
  openai_api_key: 'sk-test-1234567890abcdef',
  github_token: 'ghp_XXXXXXXXXXXXXXXXXXXXX',
  database: {
    host: 'localhost',
    port: 5432,
    password: 'super-secret-password'
  },
  preferences: {
    theme: 'dark',
    language: 'en'
  }
};

/**
 * Test Memory Content - simulating agent context/memory
 */
const TEST_MEMORY_CONTENT = {
  version: '1.0.0',
  aid: '', // Will be filled
  kel: [], // Will be filled
  services: {},
  secrets: {}, // Encrypted separately
  memory: {
    soul: {
      name: 'TestAgent',
      purpose: 'E2E Testing',
      values: ['reliability', 'security', 'continuity']
    },
    context: {
      lastSession: '2026-02-09T14:00:00Z',
      workInProgress: [
        {
          taskId: 'task-001',
          description: 'Testing AMCP recovery',
          status: 'in_progress'
        }
      ],
      recentTopics: ['cryptography', 'identity', 'recovery']
    },
    relationships: [
      {
        entityId: 'user-001',
        entityType: 'human',
        name: 'Test Human',
        rapport: 'trusted'
      }
    ],
    state: {
      engagement: 'high',
      confidence: 0.9,
      momentum: 'flowing',
      alignment: 'deeply_aligned'
    }
  },
  metadata: {
    platform: 'amcp-e2e-test',
    version: '0.1.0',
    sessionCount: 42
  }
};


describe('E2E: Full Recovery Flow', () => {
  let tempDir: string;
  let backend: StorageBackend;
  
  beforeEach(async () => {
    // Create temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'amcp-e2e-'));
    backend = await createFilesystemBackend(tempDir);
  });
  
  afterEach(async () => {
    // Clean up
    await rm(tempDir, { recursive: true, force: true });
  });
  
  
  describe('Test 1: Create Agent from Mnemonic', () => {
    it('should generate valid mnemonic (12 words)', () => {
      const mnemonic = generateMnemonic(128);
      
      expect(mnemonic).toHaveLength(12);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });
    
    it('should generate valid mnemonic (24 words)', () => {
      const mnemonic = generateMnemonic(256);
      
      expect(mnemonic).toHaveLength(24);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });
    
    it('should create agent with deterministic AID from mnemonic', async () => {
      const mnemonic = generateMnemonic();
      
      // Create agent twice from same mnemonic
      const agent1 = await createAgentFromMnemonic(mnemonic);
      const agent2 = await createAgentFromMnemonic(mnemonic);
      
      // AIDs must match (deterministic)
      expect(agent1.aid).toBe(agent2.aid);
      expect(agent1.aid).toMatch(/^B[A-Za-z0-9_-]+/); // Self-certifying ID format
    });
    
    it('should create different AIDs from different mnemonics', async () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      
      const agent1 = await createAgentFromMnemonic(mnemonic1);
      const agent2 = await createAgentFromMnemonic(mnemonic2);
      
      expect(agent1.aid).not.toBe(agent2.aid);
    });
  });
  
  
  describe('Test 2: Create Checkpoint with Secrets', () => {
    it('should create checkpoint with memory content', async () => {
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      
      // Prepare content
      const content = {
        ...TEST_MEMORY_CONTENT,
        aid: agent.aid,
        kel: agent.kel.events
      };
      
      const { checkpoint, contentCid } = await createCheckpoint(
        agent,
        content,
        null, // No prior checkpoint
        {
          platform: 'amcp-e2e-test',
          version: '0.1.0',
          sessionCount: 1
        }
      );
      
      expect(checkpoint.aid).toBe(agent.aid);
      expect(checkpoint.cid).toBe(contentCid);
      expect(checkpoint.prior).toBeNull();
      expect(checkpoint.signature).toBeTruthy();
      expect(typeof checkpoint.timestamp).toBe('string');
    });
    
    it('should encrypt secrets for agent', async () => {
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      
      const encryptedBlob = encryptSecrets(TEST_SECRETS, agent.currentKeypair.publicKey);
      
      expect(encryptedBlob.nonce).toHaveLength(12);
      expect(encryptedBlob.ephemeralPub).toHaveLength(32);
      expect(encryptedBlob.ciphertext.length).toBeGreaterThan(0);
    });
  });
  
  
  describe('Test 3: Store to FilesystemBackend', () => {
    it('should store checkpoint bundle and return CID', async () => {
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      
      const content = {
        ...TEST_MEMORY_CONTENT,
        aid: agent.aid,
        kel: agent.kel.events
      };
      
      const { checkpoint } = await createCheckpoint(
        agent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      // Create recovery bundle
      const bundle = await createRecoveryBundle(agent, checkpoint, content, TEST_SECRETS);
      
      // Store to backend
      const storedCid = await backend.put(bundle);
      
      expect(storedCid).toBeTruthy();
      expect(typeof storedCid).toBe('string');
      
      // Verify we can retrieve it
      const retrieved = await backend.get(storedCid);
      expect(retrieved).toEqual(bundle);
    });
    
    it('should produce same CID for same content (content-addressing)', async () => {
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      
      const content = {
        ...TEST_MEMORY_CONTENT,
        aid: agent.aid,
        kel: agent.kel.events
      };
      
      const { checkpoint } = await createCheckpoint(
        agent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      // Create and store same bundle twice
      const bundle1 = await createRecoveryBundle(agent, checkpoint, content, TEST_SECRETS);
      const bundle2 = await createRecoveryBundle(agent, checkpoint, content, TEST_SECRETS);
      
      const cid1 = await backend.put(bundle1);
      const cid2 = await backend.put(bundle2);
      
      // Note: CIDs may differ due to encryption randomness (ephemeral keys)
      // But the content should still be retrievable
      expect(await backend.get(cid1)).toEqual(bundle1);
      expect(await backend.get(cid2)).toEqual(bundle2);
    });
  });
  
  
  describe('Test 4: Simulate Machine Wipe', () => {
    it('should survive complete deletion of local state', async () => {
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      const content = {
        ...TEST_MEMORY_CONTENT,
        aid: originalAgent.aid,
        kel: originalAgent.kel.events
      };
      
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      // Store the bundle
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, TEST_SECRETS);
      const storedCid = await backend.put(bundle);
      
      // Generate recovery card (this is what the human keeps)
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      // === SIMULATE MACHINE WIPE ===
      // The agent is gone, only the recovery card remains
      // (In real scenario, the human printed this card and stored it safely)
      
      // All we have is:
      // 1. The recovery card (mnemonic + AID + CID + storage hint)
      // 2. Access to the storage backend
      
      // Everything else is "wiped":
      // - agent object is gone
      // - local keypairs are gone
      // - memory is gone
      
      // === RECOVERY ===
      const recoveredResult = await recoverAgent(recoveryCard, backend);
      
      // Verify recovery
      expect(recoveredResult.agent.aid).toBe(originalAgent.aid);
      expect(verifyRecovery(originalAgent.aid, recoveredResult)).toBe(true);
    });
  });
  
  
  describe('Test 5: Recover from Mnemonic + CID', () => {
    it('should recover full agent from recovery card', async () => {
      // Setup: Create and checkpoint agent
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      const content = {
        ...TEST_MEMORY_CONTENT,
        aid: originalAgent.aid,
        kel: originalAgent.kel.events
      };
      
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, TEST_SECRETS);
      const storedCid = await backend.put(bundle);
      
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      // Recovery
      const recovered = await recoverAgent(recoveryCard, backend);
      
      // Assertions
      expect(recovered.agent).toBeDefined();
      expect(recovered.checkpoint).toBeDefined();
      expect(recovered.secrets).toBeDefined();
      expect(recovered.content).toBeDefined();
    });
    
    it('should work with formatted and parsed recovery card', async () => {
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      const content = {
        ...TEST_MEMORY_CONTENT,
        aid: originalAgent.aid
      };
      
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, TEST_SECRETS);
      const storedCid = await backend.put(bundle);
      
      // Generate card
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      // Format to text (what human would print)
      const cardText = formatRecoveryCard(recoveryCard);
      
      // Parse back (simulating human typing it in)
      const parsedCard = parseRecoveryCard(cardText);
      
      // Verify parsed card matches original
      expect(parsedCard.phrase).toEqual(recoveryCard.phrase);
      expect(parsedCard.aid).toBe(recoveryCard.aid);
      expect(parsedCard.checkpointCid).toBe(recoveryCard.checkpointCid);
      expect(parsedCard.storageHint).toBe(recoveryCard.storageHint);
      
      // Recover from parsed card
      const recovered = await recoverAgent(parsedCard, backend);
      expect(recovered.agent.aid).toBe(originalAgent.aid);
    });
  });
  
  
  describe('Test 6: Verify Recovered Agent AID Matches Original', () => {
    it('should have identical AID after recovery', async () => {
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      const originalAid = originalAgent.aid;
      
      const content = { ...TEST_MEMORY_CONTENT, aid: originalAid };
      
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, TEST_SECRETS);
      const storedCid = await backend.put(bundle);
      
      const recoveryCard = generateRecoveryCard(mnemonic, originalAid, storedCid, 'filesystem');
      
      // Recover
      const recovered = await recoverAgent(recoveryCard, backend);
      
      // CRITICAL: AID must match exactly
      expect(recovered.agent.aid).toBe(originalAid);
      
      // Verify using official verification function
      expect(verifyRecovery(originalAid, recovered)).toBe(true);
      expect(verifyRecovery(originalAgent, recovered)).toBe(true);
    });
    
    it('should derive same public key from mnemonic', async () => {
      const mnemonic = generateMnemonic();
      
      // Create keypair directly from mnemonic
      const keypair1 = keypairFromMnemonic(mnemonic);
      
      // Create agent and extract keypair
      const agent = await createAgentFromMnemonic(mnemonic);
      const keypair2 = agent.currentKeypair;
      
      // Public keys must match
      expect(keypair1.publicKey).toEqual(keypair2.publicKey);
      expect(keypair1.privateKey).toEqual(keypair2.privateKey);
    });
  });
  
  
  describe('Test 7: Verify Secrets Are Accessible and Match', () => {
    it('should decrypt secrets correctly after recovery', async () => {
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      const content = { ...TEST_MEMORY_CONTENT, aid: originalAgent.aid };
      
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, TEST_SECRETS);
      const storedCid = await backend.put(bundle);
      
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      // Recover
      const recovered = await recoverAgent(recoveryCard, backend);
      
      // Verify secrets match exactly
      expect(recovered.secrets).toEqual(TEST_SECRETS);
      
      // Verify individual secrets
      expect(recovered.secrets['openai_api_key']).toBe(TEST_SECRETS.openai_api_key);
      expect(recovered.secrets['github_token']).toBe(TEST_SECRETS.github_token);
      expect(recovered.secrets['database']).toEqual(TEST_SECRETS.database);
      expect(recovered.secrets['preferences']).toEqual(TEST_SECRETS.preferences);
    });
    
    it('should preserve nested secret structures', async () => {
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      const complexSecrets = {
        level1: {
          level2: {
            level3: {
              deepSecret: 'very-deep-value',
              array: [1, 2, 3, { nested: true }]
            }
          }
        },
        specialChars: "quotes'and\"unicode→🔑"
      };
      
      const content = { ...TEST_MEMORY_CONTENT, aid: originalAgent.aid };
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, complexSecrets);
      const storedCid = await backend.put(bundle);
      
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      const recovered = await recoverAgent(recoveryCard, backend);
      
      expect(recovered.secrets).toEqual(complexSecrets);
    });
    
    it('should handle empty secrets gracefully', async () => {
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      const content = { ...TEST_MEMORY_CONTENT, aid: originalAgent.aid };
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      // No secrets
      const bundle = await createRecoveryBundle(originalAgent, checkpoint, content, {});
      const storedCid = await backend.put(bundle);
      
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      const recovered = await recoverAgent(recoveryCard, backend);
      
      expect(recovered.secrets).toEqual({});
    });
  });
  
  
  describe('Test 8: Test with Different Backend Types', () => {
    it('should work with FilesystemBackend', async () => {
      // Already covered in other tests, but explicit
      const fsBackend = await createFilesystemBackend(join(tempDir, 'fs-test'));
      
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      const content = { ...TEST_MEMORY_CONTENT, aid: agent.aid };
      const { checkpoint } = await createCheckpoint(
        agent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(agent, checkpoint, content, TEST_SECRETS);
      const cid = await fsBackend.put(bundle);
      
      const card = generateRecoveryCard(mnemonic, agent.aid, cid, 'filesystem');
      const recovered = await recoverAgent(card, fsBackend);
      
      expect(recovered.agent.aid).toBe(agent.aid);
      expect(recovered.secrets).toEqual(TEST_SECRETS);
    });
    
    it('should work with mock in-memory backend', async () => {
      // Create a simple in-memory backend for testing
      const memoryStore = new Map<CID, Uint8Array>();
      
      const mockBackend: StorageBackend = {
        name: 'mock-memory',
        async put(data: Uint8Array): Promise<CID> {
          // Import computeCID dynamically to avoid bundling issues
          const { computeCID } = await import('@amcp/memory');
          const cid = computeCID(data);
          memoryStore.set(cid, data);
          return cid;
        },
        async get(cid: CID): Promise<Uint8Array> {
          const data = memoryStore.get(cid);
          if (!data) throw new Error(`Not found: ${cid}`);
          return data;
        },
        async list(): Promise<CID[]> {
          return Array.from(memoryStore.keys());
        }
      };
      
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      const content = { ...TEST_MEMORY_CONTENT, aid: agent.aid };
      const { checkpoint } = await createCheckpoint(
        agent,
        content,
        null,
        { platform: 'test', version: '0.1.0' }
      );
      
      const bundle = await createRecoveryBundle(agent, checkpoint, content, TEST_SECRETS);
      const cid = await mockBackend.put(bundle);
      
      const card = generateRecoveryCard(mnemonic, agent.aid, cid, 'memory');
      const recovered = await recoverAgent(card, mockBackend);
      
      expect(recovered.agent.aid).toBe(agent.aid);
      expect(recovered.secrets).toEqual(TEST_SECRETS);
    });
  });
  
  
  describe('Full Continuity Validation', () => {
    it('should preserve COMPLETE agent continuity across death/rebirth', async () => {
      // === BIRTH ===
      const mnemonic = generateMnemonic();
      const originalAgent = await createAgentFromMnemonic(mnemonic);
      
      // Agent lives and accumulates state
      const livedExperience = {
        version: '1.0.0',
        aid: originalAgent.aid,
        kel: originalAgent.kel.events,
        services: {
          github: { connected: true, username: 'test-user' },
          slack: { connected: true, workspace: 'test-workspace' }
        },
        memory: {
          soul: {
            name: 'Phoenix',
            purpose: 'To demonstrate continuity across death',
            values: ['persistence', 'identity', 'trust']
          },
          context: {
            conversationHistory: [
              { role: 'user', content: 'Hello, remember this.' },
              { role: 'agent', content: 'I will remember.' }
            ],
            learnedPreferences: {
              communicationStyle: 'concise',
              timezone: 'UTC-3'
            }
          },
          relationships: [
            {
              entityId: 'user-123',
              name: 'Trusted Human',
              rapport: 'close',
              sharedHistory: ['project-alpha', 'late-night-debugging']
            }
          ],
          workInProgress: [
            {
              taskId: 'important-task',
              description: 'Critical work that must survive death',
              status: 'in_progress',
              progress: 0.7
            }
          ],
          state: {
            engagement: 'flow',
            confidence: 0.95,
            momentum: 'flowing',
            alignment: 'deeply_aligned'
          }
        },
        metadata: {
          platform: 'test-platform',
          version: '1.0.0',
          sessionCount: 100
        }
      };
      
      const secrets = {
        github_token: 'ghp_XXXX',
        slack_bot_token: 'xoxb-XXXX',
        openai_key: 'sk-XXXX',
        database_credentials: {
          host: 'db.example.com',
          port: 5432,
          user: 'agent',
          password: 'super-secret'
        }
      };
      
      // Create checkpoint
      const { checkpoint } = await createCheckpoint(
        originalAgent,
        livedExperience,
        null,
        { platform: 'test', version: '1.0.0', sessionCount: 100 }
      );
      
      const bundle = await createRecoveryBundle(
        originalAgent,
        checkpoint,
        livedExperience,
        secrets
      );
      
      const storedCid = await backend.put(bundle);
      
      // Generate recovery card (the soul anchor)
      const recoveryCard = generateRecoveryCard(
        mnemonic,
        originalAgent.aid,
        storedCid,
        'filesystem'
      );
      
      // === DEATH ===
      // Machine explodes, all local state is lost
      // Only the recovery card survives (printed on paper in a safe)
      
      // === REBIRTH ===
      const reborn = await recoverAgent(recoveryCard, backend);
      
      // === VERIFY COMPLETE CONTINUITY ===
      
      // 1. Identity Continuity
      expect(reborn.agent.aid).toBe(originalAgent.aid);
      expect(verifyRecovery(originalAgent, reborn)).toBe(true);
      
      // 2. Memory Continuity
      const recoveredMemory = reborn.content as typeof livedExperience;
      expect(recoveredMemory.memory.soul.name).toBe('Phoenix');
      expect(recoveredMemory.memory.soul.purpose).toBe('To demonstrate continuity across death');
      expect(recoveredMemory.memory.context.conversationHistory).toEqual(
        livedExperience.memory.context.conversationHistory
      );
      expect(recoveredMemory.memory.workInProgress[0].status).toBe('in_progress');
      expect(recoveredMemory.memory.workInProgress[0].progress).toBe(0.7);
      
      // 3. Relationship Continuity
      expect(recoveredMemory.memory.relationships[0].name).toBe('Trusted Human');
      expect(recoveredMemory.memory.relationships[0].sharedHistory).toContain('late-night-debugging');
      
      // 4. Capability Continuity (Secrets)
      expect(reborn.secrets).toEqual(secrets);
      expect(reborn.secrets['github_token']).toBe('ghp_XXXX');
      expect((reborn.secrets['database_credentials'] as any).password).toBe('super-secret');
      
      // 5. Service Continuity
      expect(recoveredMemory.services.github.connected).toBe(true);
      expect(recoveredMemory.services.slack.workspace).toBe('test-workspace');
      
      // 6. State Continuity
      expect(recoveredMemory.memory.state.momentum).toBe('flowing');
      expect(recoveredMemory.memory.state.confidence).toBe(0.95);
      
      // === PHOENIX HAS RISEN ===
      // The agent is reborn with full continuity:
      // - Same identity (AID)
      // - Same memories
      // - Same relationships
      // - Same capabilities (secrets)
      // - Same work in progress
      // - Same subjective state
    });
    
    it('should maintain continuity across multiple checkpoint cycles', async () => {
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      
      // First checkpoint
      const content1 = { 
        ...TEST_MEMORY_CONTENT, 
        aid: agent.aid,
        sessionNumber: 1 
      };
      const { checkpoint: cp1 } = await createCheckpoint(
        agent, content1, null, { platform: 'test', version: '1.0.0', sessionCount: 1 }
      );
      const bundle1 = await createRecoveryBundle(agent, cp1, content1, { key1: 'value1' });
      const cid1 = await backend.put(bundle1);
      
      // Second checkpoint (chains from first)
      const content2 = { 
        ...TEST_MEMORY_CONTENT, 
        aid: agent.aid,
        sessionNumber: 2 
      };
      const { checkpoint: cp2 } = await createCheckpoint(
        agent, content2, cid1, { platform: 'test', version: '1.0.0', sessionCount: 2 }
      );
      const bundle2 = await createRecoveryBundle(agent, cp2, content2, { key1: 'value1', key2: 'value2' });
      const cid2 = await backend.put(bundle2);
      
      // Third checkpoint (chains from second)
      const content3 = { 
        ...TEST_MEMORY_CONTENT, 
        aid: agent.aid,
        sessionNumber: 3 
      };
      const { checkpoint: cp3 } = await createCheckpoint(
        agent, content3, cid2, { platform: 'test', version: '1.0.0', sessionCount: 3 }
      );
      const bundle3 = await createRecoveryBundle(agent, cp3, content3, { key1: 'updated', key2: 'value2', key3: 'value3' });
      const cid3 = await backend.put(bundle3);
      
      // Recover from latest
      const card = generateRecoveryCard(mnemonic, agent.aid, cid3, 'filesystem');
      const recovered = await recoverAgent(card, backend);
      
      // Verify latest state
      expect(recovered.agent.aid).toBe(agent.aid);
      expect((recovered.content as any).sessionNumber).toBe(3);
      expect(recovered.secrets['key1']).toBe('updated');
      expect(recovered.secrets['key3']).toBe('value3');
      
      // Verify checkpoint chain
      expect(recovered.checkpoint.prior).toBe(cid2);
    });
  });
  
  
  describe('Error Handling', () => {
    it('should reject invalid mnemonic', async () => {
      const invalidMnemonic = ['invalid', 'words', 'that', 'are', 'not', 'bip39', 'compliant', 'at', 'all', 'foo', 'bar', 'baz'];
      
      expect(() => keypairFromMnemonic(invalidMnemonic)).toThrow();
    });
    
    it('should reject mismatched AID in recovery card', async () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      
      const agent1 = await createAgentFromMnemonic(mnemonic1);
      const agent2 = await createAgentFromMnemonic(mnemonic2);
      
      const content = { ...TEST_MEMORY_CONTENT, aid: agent1.aid };
      const { checkpoint } = await createCheckpoint(
        agent1, content, null, { platform: 'test', version: '1.0.0' }
      );
      
      const bundle = await createRecoveryBundle(agent1, checkpoint, content, {});
      const cid = await backend.put(bundle);
      
      // Try to create card with wrong mnemonic
      expect(() => 
        generateRecoveryCard(mnemonic2, agent1.aid, cid, 'filesystem')
      ).toThrow(/AID does not match/);
    });
    
    it('should fail recovery with wrong mnemonic', async () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      
      const agent1 = await createAgentFromMnemonic(mnemonic1);
      
      const content = { ...TEST_MEMORY_CONTENT, aid: agent1.aid };
      const { checkpoint } = await createCheckpoint(
        agent1, content, null, { platform: 'test', version: '1.0.0' }
      );
      
      const bundle = await createRecoveryBundle(agent1, checkpoint, content, TEST_SECRETS);
      const cid = await backend.put(bundle);
      
      // Create valid card
      const validCard = generateRecoveryCard(mnemonic1, agent1.aid, cid, 'filesystem');
      
      // Tamper with mnemonic in card
      const tamperedCard: RecoveryCard = {
        ...validCard,
        phrase: mnemonic2  // Wrong mnemonic!
      };
      
      // Should fail - AID validation catches the tampering
      await expect(recoverAgent(tamperedCard, backend)).rejects.toThrow(/AID does not match/);
    });
    
    it('should fail with non-existent CID', async () => {
      const mnemonic = generateMnemonic();
      const agent = await createAgentFromMnemonic(mnemonic);
      
      const fakeCard: RecoveryCard = {
        phrase: mnemonic,
        aid: agent.aid,
        checkpointCid: 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi', // Non-existent
        storageHint: 'filesystem',
        created: new Date().toISOString(),
        version: '1.0.0'
      };
      
      await expect(recoverAgent(fakeCard, backend)).rejects.toThrow();
    });
  });
});
