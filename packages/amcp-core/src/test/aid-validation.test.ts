/**
 * Tests for Ed25519 on-curve validation in isValidAid()
 *
 * Verifies that isValidAid() rejects AIDs whose decoded bytes
 * are not a valid Ed25519 public key point (e.g. bytes that fail
 * the curve equation check or are small-order torsion points).
 */

import { describe, it, expect } from 'vitest';
import { isValidAid, aidFromPublicKey } from '../aid.js';
import { generateKeypair, toBase64url } from '../crypto.js';

describe('isValidAid - Ed25519 on-curve validation', () => {
  // ============================================================
  // REJECTION CASES — invalid AIDs must fail
  // ============================================================

  it('should reject AID with bytes where y is not a valid curve point (y=2)', () => {
    // y=2 has no valid square root for x on the Ed25519 curve
    const badBytes = new Uint8Array(32);
    badBytes[0] = 2; // encodes y=2
    const aid = 'B' + toBase64url(badBytes);
    expect(isValidAid(aid)).toBe(false);
  });

  it('should reject AID with bytes where y is not a valid curve point (y=7)', () => {
    const badBytes = new Uint8Array(32);
    badBytes[0] = 7;
    const aid = 'B' + toBase64url(badBytes);
    expect(isValidAid(aid)).toBe(false);
  });

  it('should reject AID with all-zero bytes (small-order torsion point)', () => {
    // All-zeros encodes y=0, which is on the curve but is a small-order point
    // (clearCofactor maps it to the identity). Not a valid public key.
    const zeroBytes = new Uint8Array(32);
    const aid = 'B' + toBase64url(zeroBytes);
    expect(isValidAid(aid)).toBe(false);
  });

  it('should reject AID with 0xFF fill (y out of range for Ed25519)', () => {
    const badBytes = new Uint8Array(32).fill(0xFF);
    const aid = 'B' + toBase64url(badBytes);
    expect(isValidAid(aid)).toBe(false);
  });

  it('should reject AID without Ed25519 prefix', () => {
    expect(isValidAid('not-a-keri-aid')).toBe(false);
  });

  it('should reject AID with wrong length after decode', () => {
    const shortBytes = new Uint8Array(16).fill(0x42);
    const aid = 'B' + toBase64url(shortBytes);
    expect(isValidAid(aid)).toBe(false);
  });

  it('should reject empty string', () => {
    expect(isValidAid('')).toBe(false);
  });

  it('should reject AID with just the prefix', () => {
    expect(isValidAid('B')).toBe(false);
  });

  it('should reject openclaw-deploy-style sha256 AID (no KERI prefix)', () => {
    // sha256 hex string — doesn't start with "B" prefix
    const sha256Aid = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    expect(isValidAid(sha256Aid)).toBe(false);
  });

  // ============================================================
  // ACCEPTANCE CASES — valid AIDs must pass
  // ============================================================

  it('should accept AID derived from a real Ed25519 public key', async () => {
    const { publicKey } = await generateKeypair();
    const aid = aidFromPublicKey(publicKey);
    expect(isValidAid(aid)).toBe(true);
  });

  it('should accept multiple generated AIDs', async () => {
    for (let i = 0; i < 5; i++) {
      const { publicKey } = await generateKeypair();
      const aid = aidFromPublicKey(publicKey);
      expect(isValidAid(aid)).toBe(true);
    }
  });
});
