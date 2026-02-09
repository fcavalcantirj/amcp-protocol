/**
 * Tests for encrypted secrets blob
 * 
 * Verifies:
 * - X25519 key conversion from Ed25519
 * - Encrypt → decrypt roundtrip
 * - Wrong key fails decryption
 * - Only holder of private key can decrypt
 */

import { describe, it, expect } from 'vitest';
import { ed25519 } from '@noble/curves/ed25519';
import {
  ed25519ToX25519,
  ed25519PubToX25519,
  encryptSecrets,
  decryptSecrets,
  serializeEncryptedBlob,
  deserializeEncryptedBlob,
} from '../src/encryption.js';

describe('encryption', () => {
  // Generate test keypairs
  const alicePriv = ed25519.utils.randomPrivateKey();
  const alicePub = ed25519.getPublicKey(alicePriv);
  
  const bobPriv = ed25519.utils.randomPrivateKey();
  const bobPub = ed25519.getPublicKey(bobPriv);

  describe('ed25519ToX25519', () => {
    it('should convert Ed25519 keys to X25519', () => {
      const x25519Keys = ed25519ToX25519(alicePub, alicePriv);
      
      expect(x25519Keys.x25519Pub).toBeInstanceOf(Uint8Array);
      expect(x25519Keys.x25519Priv).toBeInstanceOf(Uint8Array);
      expect(x25519Keys.x25519Pub.length).toBe(32);
      expect(x25519Keys.x25519Priv.length).toBe(32);
    });

    it('should produce different X25519 keys from different Ed25519 keys', () => {
      const aliceX25519 = ed25519ToX25519(alicePub, alicePriv);
      const bobX25519 = ed25519ToX25519(bobPub, bobPriv);
      
      expect(aliceX25519.x25519Pub).not.toEqual(bobX25519.x25519Pub);
      expect(aliceX25519.x25519Priv).not.toEqual(bobX25519.x25519Priv);
    });

    it('should reject invalid key lengths', () => {
      expect(() => ed25519ToX25519(new Uint8Array(31), alicePriv)).toThrow(/Invalid Ed25519 public key length/);
      expect(() => ed25519ToX25519(alicePub, new Uint8Array(31))).toThrow(/Invalid Ed25519 private key length/);
    });
  });

  describe('ed25519PubToX25519', () => {
    it('should convert Ed25519 public key to X25519', () => {
      const x25519Pub = ed25519PubToX25519(alicePub);
      
      expect(x25519Pub).toBeInstanceOf(Uint8Array);
      expect(x25519Pub.length).toBe(32);
    });

    it('should be consistent with ed25519ToX25519', () => {
      const fromFull = ed25519ToX25519(alicePub, alicePriv);
      const fromPubOnly = ed25519PubToX25519(alicePub);
      
      expect(fromFull.x25519Pub).toEqual(fromPubOnly);
    });
  });

  describe('encryptSecrets / decryptSecrets roundtrip', () => {
    it('should encrypt and decrypt simple secrets', () => {
      const secrets = { apiKey: 'secret-123', token: 'abc-xyz' };
      
      const encrypted = encryptSecrets(secrets, alicePub);
      const decrypted = decryptSecrets(encrypted, alicePriv);
      
      expect(decrypted).toEqual(secrets);
    });

    it('should encrypt and decrypt complex nested objects', () => {
      const secrets = {
        database: {
          host: 'localhost',
          port: 5432,
          credentials: {
            username: 'admin',
            password: 'super-secret-password',
          },
        },
        apiKeys: ['key1', 'key2', 'key3'],
        enabled: true,
        count: 42,
      };
      
      const encrypted = encryptSecrets(secrets, alicePub);
      const decrypted = decryptSecrets(encrypted, alicePriv);
      
      expect(decrypted).toEqual(secrets);
    });

    it('should encrypt and decrypt empty object', () => {
      const secrets = {};
      
      const encrypted = encryptSecrets(secrets, alicePub);
      const decrypted = decryptSecrets(encrypted, alicePriv);
      
      expect(decrypted).toEqual(secrets);
    });

    it('should produce different ciphertexts for same plaintext (random nonce)', () => {
      const secrets = { key: 'value' };
      
      const encrypted1 = encryptSecrets(secrets, alicePub);
      const encrypted2 = encryptSecrets(secrets, alicePub);
      
      // Nonces should be different
      expect(encrypted1.nonce).not.toEqual(encrypted2.nonce);
      // Ephemeral keys should be different
      expect(encrypted1.ephemeralPub).not.toEqual(encrypted2.ephemeralPub);
      // Ciphertexts should be different
      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    });
  });

  describe('wrong key fails decryption', () => {
    it('should fail to decrypt with wrong private key', () => {
      const secrets = { apiKey: 'secret-123' };
      
      // Encrypt for Alice
      const encrypted = encryptSecrets(secrets, alicePub);
      
      // Try to decrypt with Bob's key - should fail
      expect(() => decryptSecrets(encrypted, bobPriv)).toThrow();
    });

    it('should fail to decrypt with random key', () => {
      const secrets = { apiKey: 'secret-123' };
      const encrypted = encryptSecrets(secrets, alicePub);
      
      // Random key should fail
      const randomKey = ed25519.utils.randomPrivateKey();
      expect(() => decryptSecrets(encrypted, randomKey)).toThrow();
    });
  });

  describe('only holder of private key can decrypt', () => {
    it('should only decrypt for intended recipient', () => {
      const secrets = { message: 'for your eyes only' };
      
      // Encrypt for Bob
      const encrypted = encryptSecrets(secrets, bobPub);
      
      // Bob can decrypt
      const decrypted = decryptSecrets(encrypted, bobPriv);
      expect(decrypted).toEqual(secrets);
      
      // Alice cannot decrypt
      expect(() => decryptSecrets(encrypted, alicePriv)).toThrow();
    });

    it('should work for self-encryption (same sender and recipient)', () => {
      const secrets = { mySecret: 'only I know' };
      
      // Encrypt for self
      const encrypted = encryptSecrets(secrets, alicePub);
      
      // Can decrypt with own key
      const decrypted = decryptSecrets(encrypted, alicePriv);
      expect(decrypted).toEqual(secrets);
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize encrypted blob', () => {
      const secrets = { key: 'value' };
      const encrypted = encryptSecrets(secrets, alicePub);
      
      // Serialize to string
      const serialized = serializeEncryptedBlob(encrypted);
      expect(typeof serialized).toBe('string');
      
      // Deserialize back
      const deserialized = deserializeEncryptedBlob(serialized);
      
      expect(deserialized.nonce).toEqual(encrypted.nonce);
      expect(deserialized.ciphertext).toEqual(encrypted.ciphertext);
      expect(deserialized.ephemeralPub).toEqual(encrypted.ephemeralPub);
      
      // Should still decrypt correctly
      const decrypted = decryptSecrets(deserialized, alicePriv);
      expect(decrypted).toEqual(secrets);
    });

    it('should produce valid JSON', () => {
      const secrets = { key: 'value' };
      const encrypted = encryptSecrets(secrets, alicePub);
      const serialized = serializeEncryptedBlob(encrypted);
      
      // Should parse as JSON
      const parsed = JSON.parse(serialized);
      expect(parsed).toHaveProperty('nonce');
      expect(parsed).toHaveProperty('ciphertext');
      expect(parsed).toHaveProperty('ephemeralPub');
    });
  });

  describe('validation', () => {
    it('should reject invalid nonce', () => {
      const encrypted = encryptSecrets({ key: 'value' }, alicePub);
      encrypted.nonce = new Uint8Array(11); // Wrong size
      
      expect(() => decryptSecrets(encrypted, alicePriv)).toThrow(/Invalid nonce length/);
    });

    it('should reject invalid ephemeral public key', () => {
      const encrypted = encryptSecrets({ key: 'value' }, alicePub);
      encrypted.ephemeralPub = new Uint8Array(31); // Wrong size
      
      expect(() => decryptSecrets(encrypted, alicePriv)).toThrow(/Invalid ephemeral public key length/);
    });

    it('should reject empty ciphertext', () => {
      const encrypted = encryptSecrets({ key: 'value' }, alicePub);
      encrypted.ciphertext = new Uint8Array(0);
      
      expect(() => decryptSecrets(encrypted, alicePriv)).toThrow(/Invalid ciphertext/);
    });

    it('should detect tampered ciphertext', () => {
      const encrypted = encryptSecrets({ key: 'value' }, alicePub);
      
      // Tamper with ciphertext
      encrypted.ciphertext[0] ^= 0xff;
      
      // Should fail authentication
      expect(() => decryptSecrets(encrypted, alicePriv)).toThrow();
    });
  });
});
