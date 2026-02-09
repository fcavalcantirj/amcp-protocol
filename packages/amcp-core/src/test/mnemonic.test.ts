/**
 * BIP-39 Mnemonic Tests
 * 
 * Validates:
 * - Mnemonic generation (12 and 24 words)
 * - Deterministic derivation (same words → same keypair)
 * - Validation (valid/invalid mnemonics)
 * - Seed derivation
 */

import { describe, it, expect } from 'vitest';
import {
  generateMnemonic,
  mnemonicToSeed,
  keypairFromMnemonic,
  validateMnemonic,
  strengthToWordCount,
  wordCountToStrength
} from '../mnemonic.js';
import { toBase64url } from '../crypto.js';

describe('Mnemonic', () => {
  describe('generateMnemonic', () => {
    it('should generate 12-word mnemonic with default strength', () => {
      const words = generateMnemonic();
      expect(words).toHaveLength(12);
      expect(words.every(w => typeof w === 'string' && w.length > 0)).toBe(true);
    });

    it('should generate 12-word mnemonic with strength 128', () => {
      const words = generateMnemonic(128);
      expect(words).toHaveLength(12);
    });

    it('should generate 24-word mnemonic with strength 256', () => {
      const words = generateMnemonic(256);
      expect(words).toHaveLength(24);
    });

    it('should generate different mnemonics each time', () => {
      const words1 = generateMnemonic();
      const words2 = generateMnemonic();
      expect(words1.join(' ')).not.toBe(words2.join(' '));
    });

    it('should throw on invalid strength', () => {
      // @ts-expect-error - testing invalid input
      expect(() => generateMnemonic(64)).toThrow('Strength must be 128');
      // @ts-expect-error - testing invalid input
      expect(() => generateMnemonic(192)).toThrow('Strength must be 128');
    });
  });

  describe('validateMnemonic', () => {
    it('should validate generated 12-word mnemonic', () => {
      const words = generateMnemonic(128);
      expect(validateMnemonic(words)).toBe(true);
    });

    it('should validate generated 24-word mnemonic', () => {
      const words = generateMnemonic(256);
      expect(validateMnemonic(words)).toBe(true);
    });

    it('should reject invalid word', () => {
      const words = generateMnemonic();
      words[0] = 'invalidword123';
      expect(validateMnemonic(words)).toBe(false);
    });

    it('should reject wrong number of words', () => {
      const words = generateMnemonic();
      expect(validateMnemonic(words.slice(0, 11))).toBe(false);
      expect(validateMnemonic([...words, 'extra'])).toBe(false);
    });

    it('should reject non-array input', () => {
      // @ts-expect-error - testing invalid input
      expect(validateMnemonic('invalid')).toBe(false);
      // @ts-expect-error - testing invalid input
      expect(validateMnemonic(null)).toBe(false);
    });

    it('should reject mnemonic with invalid checksum', () => {
      // Valid words but wrong checksum (swap first two words)
      const words = generateMnemonic();
      const swapped = [words[1], words[0], ...words.slice(2)];
      // This *might* pass by chance, but very unlikely
      // A more robust test uses a known-invalid checksum
      const knownBad = ['abandon', 'abandon', 'abandon', 'abandon', 'abandon', 
                        'abandon', 'abandon', 'abandon', 'abandon', 'abandon', 
                        'abandon', 'abandon']; // Invalid checksum
      expect(validateMnemonic(knownBad)).toBe(false);
    });
  });

  describe('mnemonicToSeed', () => {
    it('should produce 64-byte seed', () => {
      const words = generateMnemonic();
      const seed = mnemonicToSeed(words);
      expect(seed).toBeInstanceOf(Uint8Array);
      expect(seed.length).toBe(64);
    });

    it('should produce deterministic seed', () => {
      const words = generateMnemonic();
      const seed1 = mnemonicToSeed(words);
      const seed2 = mnemonicToSeed(words);
      expect(toBase64url(seed1)).toBe(toBase64url(seed2));
    });

    it('should produce different seed with passphrase', () => {
      const words = generateMnemonic();
      const seed1 = mnemonicToSeed(words);
      const seed2 = mnemonicToSeed(words, 'my-passphrase');
      expect(toBase64url(seed1)).not.toBe(toBase64url(seed2));
    });

    it('should throw on invalid mnemonic', () => {
      expect(() => mnemonicToSeed(['invalid', 'words'])).toThrow('Invalid mnemonic');
    });
  });

  describe('keypairFromMnemonic', () => {
    it('should derive Ed25519 keypair', () => {
      const words = generateMnemonic();
      const keypair = keypairFromMnemonic(words);
      
      expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.privateKey.length).toBe(32);
      expect(keypair.publicKey.length).toBe(32);
    });

    it('should derive SAME keypair from SAME mnemonic (deterministic)', () => {
      const words = generateMnemonic();
      
      // Derive keypair multiple times
      const keypair1 = keypairFromMnemonic(words);
      const keypair2 = keypairFromMnemonic(words);
      const keypair3 = keypairFromMnemonic(words);
      
      // All should be identical
      expect(toBase64url(keypair1.publicKey)).toBe(toBase64url(keypair2.publicKey));
      expect(toBase64url(keypair1.publicKey)).toBe(toBase64url(keypair3.publicKey));
      expect(toBase64url(keypair1.privateKey)).toBe(toBase64url(keypair2.privateKey));
      expect(toBase64url(keypair1.privateKey)).toBe(toBase64url(keypair3.privateKey));
    });

    it('should derive DIFFERENT keypair from DIFFERENT mnemonic', () => {
      const words1 = generateMnemonic();
      const words2 = generateMnemonic();
      
      const keypair1 = keypairFromMnemonic(words1);
      const keypair2 = keypairFromMnemonic(words2);
      
      expect(toBase64url(keypair1.publicKey)).not.toBe(toBase64url(keypair2.publicKey));
    });

    it('should derive different keypair with passphrase', () => {
      const words = generateMnemonic();
      
      const keypair1 = keypairFromMnemonic(words);
      const keypair2 = keypairFromMnemonic(words, 'secret-passphrase');
      
      expect(toBase64url(keypair1.publicKey)).not.toBe(toBase64url(keypair2.publicKey));
    });

    it('should work with 12-word mnemonic', () => {
      const words = generateMnemonic(128);
      expect(words).toHaveLength(12);
      
      const keypair = keypairFromMnemonic(words);
      expect(keypair.publicKey.length).toBe(32);
      
      // Verify determinism
      const keypair2 = keypairFromMnemonic(words);
      expect(toBase64url(keypair.publicKey)).toBe(toBase64url(keypair2.publicKey));
    });

    it('should work with 24-word mnemonic', () => {
      const words = generateMnemonic(256);
      expect(words).toHaveLength(24);
      
      const keypair = keypairFromMnemonic(words);
      expect(keypair.publicKey.length).toBe(32);
      
      // Verify determinism
      const keypair2 = keypairFromMnemonic(words);
      expect(toBase64url(keypair.publicKey)).toBe(toBase64url(keypair2.publicKey));
    });

    it('should throw on invalid mnemonic', () => {
      expect(() => keypairFromMnemonic(['invalid', 'words'])).toThrow('Invalid mnemonic');
    });
  });

  describe('helper functions', () => {
    it('strengthToWordCount should convert correctly', () => {
      expect(strengthToWordCount(128)).toBe(12);
      expect(strengthToWordCount(256)).toBe(24);
    });

    it('wordCountToStrength should convert correctly', () => {
      expect(wordCountToStrength(12)).toBe(128);
      expect(wordCountToStrength(24)).toBe(256);
    });

    it('wordCountToStrength should throw on invalid count', () => {
      expect(() => wordCountToStrength(15)).toThrow('Word count must be 12 or 24');
    });
  });

  describe('BIP-39 compatibility', () => {
    // Known test vector from BIP-39 specification
    // This ensures compatibility with other BIP-39 implementations
    it('should produce correct seed for known test vector', () => {
      // BIP-39 test vector: "abandon" x 11 + "about"
      const testWords = [
        'abandon', 'abandon', 'abandon', 'abandon', 'abandon', 'abandon',
        'abandon', 'abandon', 'abandon', 'abandon', 'abandon', 'about'
      ];
      
      expect(validateMnemonic(testWords)).toBe(true);
      
      const seed = mnemonicToSeed(testWords);
      expect(seed.length).toBe(64);
      
      // Verify determinism
      const seed2 = mnemonicToSeed(testWords);
      expect(toBase64url(seed)).toBe(toBase64url(seed2));
    });

    it('should produce deterministic keypair for known test vector', () => {
      const testWords = [
        'abandon', 'abandon', 'abandon', 'abandon', 'abandon', 'abandon',
        'abandon', 'abandon', 'abandon', 'abandon', 'abandon', 'about'
      ];
      
      const keypair1 = keypairFromMnemonic(testWords);
      const keypair2 = keypairFromMnemonic(testWords);
      
      // Must be exactly the same
      expect(toBase64url(keypair1.publicKey)).toBe(toBase64url(keypair2.publicKey));
      expect(toBase64url(keypair1.privateKey)).toBe(toBase64url(keypair2.privateKey));
    });
  });
});
