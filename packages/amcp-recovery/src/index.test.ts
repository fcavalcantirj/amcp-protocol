/**
 * Basic index export tests
 * 
 * Verifies that all exports are properly available.
 * More comprehensive tests are in recovery.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  RECOVERY_CARD_VERSION,
  // Card functions
  generateRecoveryCard,
  formatRecoveryCard,
  parseRecoveryCard,
  validateRecoveryCard,
  // Recovery functions
  recoverIdentity,
  verifyRecovery,
  estimateRTO
} from './index.js';
import { 
  generateMnemonic, 
  keypairFromMnemonic, 
  aidFromPublicKey 
} from '@amcp/core';

describe('@amcp/recovery exports', () => {
  // Generate proper test data that matches mnemonic → AID
  const testPhrase = generateMnemonic();
  const testKeypair = keypairFromMnemonic(testPhrase);
  const testAid = aidFromPublicKey(testKeypair.publicKey);
  const testCid = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';
  const testStorage = 'filesystem:/tmp/test';

  describe('generateRecoveryCard', () => {
    it('should create a recovery card with all fields', () => {
      const card = generateRecoveryCard(testPhrase, testAid, testCid, testStorage);

      expect(card.phrase).toEqual(testPhrase);
      expect(card.aid).toBe(testAid);
      expect(card.checkpointCid).toBe(testCid);
      expect(card.storageHint).toBe(testStorage);
      expect(card.created).toBeDefined();
      expect(card.version).toBe(RECOVERY_CARD_VERSION);
    });
  });

  describe('formatRecoveryCard', () => {
    it('should format card as human-readable text', () => {
      const card = generateRecoveryCard(testPhrase, testAid, testCid, testStorage);
      const text = formatRecoveryCard(card);

      expect(text).toContain('AMCP AGENT RECOVERY CARD');
      expect(text).toContain('1. ' + testPhrase[0]);
      expect(text).toContain(testAid);
      expect(text).toContain(testCid);
      expect(text).toContain('---BEGIN AMCP RECOVERY DATA---');
    });
  });

  describe('parseRecoveryCard', () => {
    it('should roundtrip through format and parse', () => {
      const original = generateRecoveryCard(testPhrase, testAid, testCid, testStorage);
      const text = formatRecoveryCard(original);
      const parsed = parseRecoveryCard(text);

      expect(parsed.phrase).toEqual(testPhrase);
      expect(parsed.aid).toBe(testAid);
      expect(parsed.checkpointCid).toBe(testCid);
      expect(parsed.storageHint).toBe(testStorage);
    });
  });

  describe('validateRecoveryCard', () => {
    it('should validate a correct card', () => {
      const card = generateRecoveryCard(testPhrase, testAid, testCid, testStorage);
      const result = validateRecoveryCard(card);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject card with wrong AID', () => {
      const card = generateRecoveryCard(testPhrase, testAid, testCid, testStorage);
      card.aid = 'BwrongAID123456789012345678901234567890123' as any;
      
      const result = validateRecoveryCard(card);
      expect(result.valid).toBe(false);
    });
  });

  describe('recoverIdentity', () => {
    it('should recover identity from mnemonic', async () => {
      const recovered = await recoverIdentity(testPhrase);
      expect(recovered.aid).toBe(testAid);
    });
  });

  describe('estimateRTO', () => {
    it('should be exported', () => {
      expect(typeof estimateRTO).toBe('function');
    });
  });
});
