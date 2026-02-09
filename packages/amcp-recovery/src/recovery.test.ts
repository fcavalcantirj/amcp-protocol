/**
 * Recovery Package Tests
 * 
 * Tests the full recovery flow:
 * 1. Generate agent with mnemonic
 * 2. Create checkpoint and recovery card
 * 3. Format card (human-readable)
 * 4. Parse card back
 * 5. Recover agent from card
 * 6. Verify recovered agent matches original
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  generateMnemonic,
  keypairFromMnemonic,
  aidFromPublicKey,
  createInceptionEvent,
  type Agent
} from '@amcp/core';
import {
  createCheckpoint,
  encryptSecrets,
  serializeEncryptedBlob,
  FilesystemBackend,
  createFilesystemBackend,
  type CID
} from '@amcp/memory';
import {
  generateRecoveryCard,
  formatRecoveryCard,
  parseRecoveryCard,
  validateRecoveryCard,
  recoverAgent,
  recoverIdentity,
  verifyRecovery,
  createRecoveryBundle,
  estimateRTO,
  RECOVERY_CARD_VERSION
} from './index.js';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('@amcp/recovery', () => {
  let testDir: string;
  let backend: FilesystemBackend;
  let mnemonic: string[];
  let agent: Agent;
  let checkpointCid: CID;

  beforeAll(async () => {
    // Create temp directory for tests
    testDir = await mkdtemp(join(tmpdir(), 'amcp-recovery-test-'));
    backend = await createFilesystemBackend(testDir);

    // Generate test mnemonic and agent
    mnemonic = generateMnemonic();
    const currentKeypair = keypairFromMnemonic(mnemonic);
    const nextMnemonic = generateMnemonic();
    const nextKeypair = keypairFromMnemonic(nextMnemonic);
    const inceptionEvent = await createInceptionEvent(currentKeypair, nextKeypair.publicKey);

    agent = {
      aid: inceptionEvent.aid,
      kel: { events: [inceptionEvent] },
      currentKeypair,
      nextKeypair,
      createdAt: inceptionEvent.timestamp
    };

    // Create a checkpoint with secrets
    const content = {
      memory: { soul: 'test soul', context: 'test context' },
      version: '1.0.0'
    };
    const secrets = { apiKey: 'secret-key-12345', token: 'bearer-token' };

    // Create checkpoint
    const { checkpoint, contentCid } = await createCheckpoint(
      agent,
      content,
      null,
      { platform: 'test', version: '1.0.0' }
    );

    // Create encrypted secrets
    const encryptedSecrets = serializeEncryptedBlob(
      encryptSecrets(secrets, agent.currentKeypair.publicKey)
    );

    // Store checkpoint bundle
    const bundle = JSON.stringify({
      checkpoint,
      content,
      encryptedSecrets,
      bundleVersion: '1.0.0'
    });
    checkpointCid = await backend.put(new TextEncoder().encode(bundle));
  });

  describe('generateRecoveryCard', () => {
    it('should generate a valid recovery card', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');

      expect(card.phrase).toEqual(mnemonic);
      expect(card.aid).toBe(agent.aid);
      expect(card.checkpointCid).toBe(checkpointCid);
      expect(card.storageHint).toBe('filesystem');
      expect(card.version).toBe(RECOVERY_CARD_VERSION);
      expect(card.created).toBeTruthy();
    });

    it('should reject invalid mnemonic', () => {
      const badMnemonic = ['invalid', 'words', 'here'];
      expect(() => generateRecoveryCard(badMnemonic, agent.aid, checkpointCid, 'test'))
        .toThrow('Invalid mnemonic phrase');
    });

    it('should reject mismatched AID', () => {
      const otherMnemonic = generateMnemonic();
      expect(() => generateRecoveryCard(otherMnemonic, agent.aid, checkpointCid, 'test'))
        .toThrow('AID does not match mnemonic phrase');
    });
  });

  describe('formatRecoveryCard', () => {
    it('should format card as human-readable text', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const formatted = formatRecoveryCard(card);

      // Check for key sections
      expect(formatted).toContain('AMCP AGENT RECOVERY CARD');
      expect(formatted).toContain('RECOVERY PHRASE');
      expect(formatted).toContain('AGENT IDENTITY');
      expect(formatted).toContain('CHECKPOINT REFERENCE');
      expect(formatted).toContain('SECURITY REMINDERS');

      // Check for machine-readable section
      expect(formatted).toContain('---BEGIN AMCP RECOVERY DATA---');
      expect(formatted).toContain('---END AMCP RECOVERY DATA---');

      // Check that AID and CID are present
      expect(formatted).toContain(agent.aid);
      expect(formatted).toContain(checkpointCid);
    });

    it('should include all mnemonic words numbered', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const formatted = formatRecoveryCard(card);

      // Check each word is numbered
      for (let i = 0; i < mnemonic.length; i++) {
        expect(formatted).toContain(`${i + 1}. ${mnemonic[i]}`);
      }
    });

    it('should support custom title', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const formatted = formatRecoveryCard(card, { title: 'CUSTOM TITLE' });
      expect(formatted).toContain('CUSTOM TITLE');
    });
  });

  describe('parseRecoveryCard', () => {
    it('should parse formatted card back to original', () => {
      const original = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const formatted = formatRecoveryCard(original);
      const parsed = parseRecoveryCard(formatted);

      expect(parsed.phrase).toEqual(original.phrase);
      expect(parsed.aid).toBe(original.aid);
      expect(parsed.checkpointCid).toBe(original.checkpointCid);
      expect(parsed.storageHint).toBe(original.storageHint);
      expect(parsed.version).toBe(original.version);
    });

    it('should parse machine-readable section', () => {
      const machineReadable = `
---BEGIN AMCP RECOVERY DATA---
PHRASE:${mnemonic.join(' ')}
AID:${agent.aid}
CID:${checkpointCid}
STORAGE:ipfs
CREATED:2025-01-01T00:00:00.000Z
VERSION:1.0.0
---END AMCP RECOVERY DATA---
      `;

      const parsed = parseRecoveryCard(machineReadable);
      expect(parsed.phrase).toEqual(mnemonic);
      expect(parsed.aid).toBe(agent.aid);
    });
  });

  describe('validateRecoveryCard', () => {
    it('should validate a correct card', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const result = validateRecoveryCard(card);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid mnemonic', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      card.phrase = ['bad', 'mnemonic', 'words'];

      const result = validateRecoveryCard(card);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mnemonic'))).toBe(true);
    });

    it('should reject AID mismatch', () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      card.aid = 'Bwrongaid123456789012345678901234567890123' as any;

      const result = validateRecoveryCard(card);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('AID'))).toBe(true);
    });
  });

  describe('recoverAgent', () => {
    it('should recover agent from card and backend', async () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const recovered = await recoverAgent(card, backend);

      // Verify identity
      expect(recovered.agent.aid).toBe(agent.aid);

      // Verify secrets decrypted
      expect(recovered.secrets).toHaveProperty('apiKey', 'secret-key-12345');
      expect(recovered.secrets).toHaveProperty('token', 'bearer-token');

      // Verify content restored
      expect(recovered.content).toHaveProperty('memory');
    });

    it('should work with parsed card text', async () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const formatted = formatRecoveryCard(card);
      const parsed = parseRecoveryCard(formatted);

      const recovered = await recoverAgent(parsed, backend);
      expect(recovered.agent.aid).toBe(agent.aid);
    });
  });

  describe('recoverIdentity', () => {
    it('should recover identity from mnemonic only', async () => {
      const recovered = await recoverIdentity(mnemonic);

      expect(recovered.aid).toBe(agent.aid);
      expect(recovered.currentKeypair.publicKey).toEqual(agent.currentKeypair.publicKey);
    });

    it('should reject invalid mnemonic', async () => {
      await expect(recoverIdentity(['bad', 'words']))
        .rejects.toThrow('Invalid mnemonic phrase');
    });
  });

  describe('verifyRecovery', () => {
    it('should verify matching recovery', async () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const recovered = await recoverAgent(card, backend);

      expect(verifyRecovery(agent, recovered)).toBe(true);
      expect(verifyRecovery(agent.aid, recovered)).toBe(true);
    });

    it('should detect mismatched recovery', async () => {
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');
      const recovered = await recoverAgent(card, backend);

      expect(verifyRecovery('BdifferentAID12345678901234567890123' as any, recovered))
        .toBe(false);
    });
  });

  describe('estimateRTO', () => {
    it('should estimate filesystem RTO', () => {
      const rto = estimateRTO(backend);
      expect(rto.estimate).toBeLessThan(1000); // Under 1 second
      expect(rto.description).toContain('filesystem');
    });
  });

  describe('full recovery flow', () => {
    it('should complete end-to-end recovery', async () => {
      // Step 1: Generate agent with mnemonic (already done in beforeAll)

      // Step 2: Create recovery card
      const card = generateRecoveryCard(mnemonic, agent.aid, checkpointCid, 'filesystem');

      // Step 3: Format for printing/storage
      const formatted = formatRecoveryCard(card);
      expect(formatted.length).toBeGreaterThan(0);

      // Step 4: Parse card (simulating reading from paper/file)
      const parsed = parseRecoveryCard(formatted);
      expect(parsed.aid).toBe(agent.aid);

      // Step 5: Validate card
      const validation = validateRecoveryCard(parsed);
      expect(validation.valid).toBe(true);

      // Step 6: Recover agent
      const recovered = await recoverAgent(parsed, backend);

      // Step 7: Verify recovery
      expect(verifyRecovery(agent, recovered)).toBe(true);

      // Step 8: Verify all components restored
      expect(recovered.agent.aid).toBe(agent.aid);
      expect(recovered.secrets.apiKey).toBe('secret-key-12345');
      expect((recovered.content as any).memory.soul).toBe('test soul');
    });
  });

  // Cleanup
  afterAll(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });
});
