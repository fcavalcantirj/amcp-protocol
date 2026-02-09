/**
 * Tests for @amcp/exchange
 * 
 * Test coverage:
 * - Export → Import roundtrip (no transport encryption)
 * - Export → Import roundtrip (with transport encryption)
 * - Bundle validation
 * - Error cases (wrong key, wrong passphrase, corrupted bundle)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createAgent, type Agent, type AMCPCheckpointContent, generateMnemonic, keypairFromMnemonic } from '@amcp/core';

import { exportAgent, importAgent, validateBundle, extractBundleHeader } from './exchange.js';
import type { ServiceIdentity } from './types.js';

describe('@amcp/exchange', () => {
  let agent: Agent;
  let checkpoint: AMCPCheckpointContent;
  let secrets: Record<string, unknown>;
  let services: ServiceIdentity[];
  
  beforeAll(async () => {
    // Create test agent
    const mnemonic = generateMnemonic(128);
    agent = await createAgent({ mnemonic });
    
    // Create mock checkpoint
    checkpoint = createMockCheckpoint(agent.aid);
    
    // Create mock secrets
    secrets = {
      SOLVR_API_KEY: 'sk_test_123456789',
      GITHUB_TOKEN: 'ghp_test_abcdefghij',
      DATABASE_URL: 'postgresql://test:test@localhost/db'
    };
    
    // Create service identities
    services = [
      { service: 'solvr', identifier: 'agent_test', credentialRef: 'SOLVR_API_KEY' },
      { service: 'github', identifier: 'test-agent', credentialRef: 'GITHUB_TOKEN' }
    ];
  });
  
  describe('exportAgent / importAgent roundtrip', () => {
    it('should export and import without transport encryption', async () => {
      // Export
      const bundle = await exportAgent(agent, checkpoint, secrets, services);
      expect(bundle).toBeInstanceOf(Uint8Array);
      expect(bundle.length).toBeGreaterThan(0);
      
      // Get private key for import (from agent's serialized form)
      const { serializeAgent, fromBase64url } = await import('@amcp/core');
      const serialized = serializeAgent(agent);
      const privateKey = fromBase64url(serialized.currentPrivateKey);
      
      // Import
      const result = await importAgent(bundle, privateKey);
      
      // Verify agent data
      expect(result.agent.aid).toBe(agent.aid);
      expect(result.agent.currentPublicKey).toBe(serialized.currentPublicKey);
      expect(result.agent.kel.events.length).toBe(serialized.kel.events.length);
      
      // Verify checkpoint
      expect(result.checkpoint.aid).toBe(checkpoint.aid);
      expect(result.checkpoint.version).toBe(checkpoint.version);
      
      // Verify secrets
      expect(result.secrets).toEqual(secrets);
      
      // Verify services
      expect(result.services).toEqual(services);
    });
    
    it('should export and import with transport encryption', async () => {
      const passphrase = 'super-secret-transport-password-2024!';
      
      // Export with passphrase
      const bundle = await exportAgent(agent, checkpoint, secrets, services, passphrase);
      expect(bundle).toBeInstanceOf(Uint8Array);
      
      // Get private key
      const { serializeAgent, fromBase64url } = await import('@amcp/core');
      const serialized = serializeAgent(agent);
      const privateKey = fromBase64url(serialized.currentPrivateKey);
      
      // Import with passphrase
      const result = await importAgent(bundle, privateKey, passphrase);
      
      // Verify roundtrip
      expect(result.agent.aid).toBe(agent.aid);
      expect(result.secrets).toEqual(secrets);
    });
    
    it('should fail import without passphrase when bundle has transport encryption', async () => {
      const passphrase = 'transport-encryption-passphrase';
      
      // Export with passphrase
      const bundle = await exportAgent(agent, checkpoint, secrets, services, passphrase);
      
      // Get private key
      const { serializeAgent, fromBase64url } = await import('@amcp/core');
      const serialized = serializeAgent(agent);
      const privateKey = fromBase64url(serialized.currentPrivateKey);
      
      // Try to import without passphrase
      await expect(importAgent(bundle, privateKey))
        .rejects.toThrow('Bundle has transport encryption but no passphrase provided');
    });
    
    it('should fail import with wrong passphrase', async () => {
      const passphrase = 'correct-passphrase';
      
      // Export with passphrase
      const bundle = await exportAgent(agent, checkpoint, secrets, services, passphrase);
      
      // Get private key
      const { serializeAgent, fromBase64url } = await import('@amcp/core');
      const serialized = serializeAgent(agent);
      const privateKey = fromBase64url(serialized.currentPrivateKey);
      
      // Try to import with wrong passphrase
      await expect(importAgent(bundle, privateKey, 'wrong-passphrase'))
        .rejects.toThrow('Invalid transport passphrase');
    });
    
    it('should fail import with wrong private key', async () => {
      // Export
      const bundle = await exportAgent(agent, checkpoint, secrets, services);
      
      // Generate different keypair
      const otherMnemonic = generateMnemonic(128);
      const otherKeypair = keypairFromMnemonic(otherMnemonic);
      
      // Try to import with wrong key
      await expect(importAgent(bundle, otherKeypair.privateKey))
        .rejects.toThrow('Failed to decrypt bundle - invalid private key');
    });
  });
  
  describe('validateBundle', () => {
    it('should validate a correct bundle', async () => {
      const bundle = await exportAgent(agent, checkpoint, secrets, services);
      
      const result = validateBundle(bundle);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.header).toBeDefined();
      expect(result.header?.aid).toBe(agent.aid);
      expect(result.header?.format).toBe('amcp-exchange-bundle');
      expect(result.header?.version).toBe('1.0.0');
    });
    
    it('should validate bundle with transport encryption', async () => {
      const bundle = await exportAgent(agent, checkpoint, secrets, services, 'passphrase');
      
      const result = validateBundle(bundle);
      
      expect(result.valid).toBe(true);
      expect(result.header?.hasTransportEncryption).toBe(true);
    });
    
    it('should detect invalid JSON', () => {
      const invalidBundle = new TextEncoder().encode('not valid json {');
      
      const result = validateBundle(invalidBundle);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid JSON');
    });
    
    it('should detect missing header', () => {
      const bundleNoHeader = new TextEncoder().encode(JSON.stringify({
        encryptedPayload: {}
      }));
      
      const result = validateBundle(bundleNoHeader);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing header');
    });
    
    it('should detect wrong format', () => {
      const wrongFormat = new TextEncoder().encode(JSON.stringify({
        header: {
          format: 'wrong-format',
          version: '1.0.0',
          aid: 'test',
          createdAt: new Date().toISOString(),
          hasTransportEncryption: false,
          payloadChecksum: 'abc'
        },
        encryptedPayload: {
          ephemeralPub: 'test',
          nonce: 'test',
          ciphertext: 'test'
        }
      }));
      
      const result = validateBundle(wrongFormat);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid format'))).toBe(true);
    });
    
    it('should detect checksum mismatch', async () => {
      const bundle = await exportAgent(agent, checkpoint, secrets, services);
      
      // Parse, corrupt checksum, re-encode
      const bundleJson = new TextDecoder().decode(bundle);
      const bundleObj = JSON.parse(bundleJson);
      bundleObj.header.payloadChecksum = 'corrupted-checksum';
      const corruptedBundle = new TextEncoder().encode(JSON.stringify(bundleObj));
      
      const result = validateBundle(corruptedBundle);
      
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Checksum mismatch'))).toBe(true);
    });
  });
  
  describe('extractBundleHeader', () => {
    it('should extract header from valid bundle', async () => {
      const bundle = await exportAgent(agent, checkpoint, secrets, services);
      
      const header = extractBundleHeader(bundle);
      
      expect(header).toBeDefined();
      expect(header?.aid).toBe(agent.aid);
      expect(header?.format).toBe('amcp-exchange-bundle');
    });
    
    it('should return null for invalid bundle', () => {
      const invalidBundle = new TextEncoder().encode('not json');
      
      const header = extractBundleHeader(invalidBundle);
      
      expect(header).toBeNull();
    });
  });
  
  describe('cross-platform compatibility', () => {
    it('should produce deterministic bundle structure', async () => {
      // Export twice (timestamps will differ, but structure should be consistent)
      const bundle1 = await exportAgent(agent, checkpoint, secrets, services);
      const bundle2 = await exportAgent(agent, checkpoint, secrets, services);
      
      // Parse both
      const obj1 = JSON.parse(new TextDecoder().decode(bundle1));
      const obj2 = JSON.parse(new TextDecoder().decode(bundle2));
      
      // Structure should match (AIDs, format, etc.)
      expect(obj1.header.format).toBe(obj2.header.format);
      expect(obj1.header.version).toBe(obj2.header.version);
      expect(obj1.header.aid).toBe(obj2.header.aid);
      
      // Encrypted payloads will differ (random nonces), but structure matches
      expect(Object.keys(obj1.encryptedPayload).sort())
        .toEqual(Object.keys(obj2.encryptedPayload).sort());
    });
    
    it('should handle empty secrets', async () => {
      const bundle = await exportAgent(agent, checkpoint, {}, []);
      
      const { serializeAgent, fromBase64url } = await import('@amcp/core');
      const serialized = serializeAgent(agent);
      const privateKey = fromBase64url(serialized.currentPrivateKey);
      
      const result = await importAgent(bundle, privateKey);
      
      expect(result.secrets).toEqual({});
      expect(result.services).toEqual([]);
    });
    
    it('should handle large secrets', async () => {
      const largeSecrets = {
        key1: 'x'.repeat(10000),
        key2: { nested: { deep: 'value'.repeat(1000) } },
        key3: Array.from({ length: 100 }, (_, i) => `item-${i}`)
      };
      
      const bundle = await exportAgent(agent, checkpoint, largeSecrets, services);
      
      const { serializeAgent, fromBase64url } = await import('@amcp/core');
      const serialized = serializeAgent(agent);
      const privateKey = fromBase64url(serialized.currentPrivateKey);
      
      const result = await importAgent(bundle, privateKey);
      
      expect(result.secrets).toEqual(largeSecrets);
    });
  });
});

// Helper to create mock checkpoint
function createMockCheckpoint(aid: string): AMCPCheckpointContent {
  const timestamp = new Date().toISOString();
  
  return {
    version: '1.0.0',
    aid,
    kel: [{
      v: 'KERI10JSON000000_',
      t: 'icp',
      d: 'mock-digest',
      i: aid,
      s: '0',
      kt: '1',
      k: ['mock-key'],
      nt: '1',
      n: ['mock-next'],
      bt: '0',
      b: [],
      c: [],
      a: []
    }],
    prior: null,
    timestamp,
    soul: {
      name: 'TestAgent',
      principles: ['Be helpful', 'Be honest'],
      voice: 'Friendly and professional',
      northStar: 'Assist users effectively'
    },
    services: [
      {
        service: 'solvr',
        identifier: 'agent_test',
        credentialRef: 'SOLVR_API_KEY',
        linkedAt: timestamp
      }
    ],
    secrets: {
      scheme: 'x25519-chacha20-poly1305',
      ephemeralPub: 'mock-ephemeral',
      nonce: 'mock-nonce',
      ciphertext: 'mock-ciphertext'
    },
    memory: {
      entries: [],
      state: {
        timestamp,
        engagement: 'high',
        confidence: 0.9,
        momentum: 'progressing',
        alignment: 'aligned'
      },
      ambient: {
        timestamp,
        privacyLevel: 'summary',
        temporal: {
          localTime: '14:00',
          dayType: 'workday',
          workHours: true
        }
      },
      relationships: [],
      workInProgress: [],
      humanMarked: []
    },
    metadata: {
      platform: 'test',
      platformVersion: '1.0.0',
      trigger: 'human_request',
      sessionCount: 1
    },
    signature: 'mock-signature'
  };
}
