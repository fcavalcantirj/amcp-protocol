/**
 * Tests for full identity validation (schema + AID crypto + KEL integrity)
 *
 * Validates the validateIdentityFull() function that composes all
 * validation checks for an identity object.
 */

import { describe, it, expect } from 'vitest';
import { validateIdentityFull } from '../validate-identity.js';
import { createAgent, serializeAgent } from '../agent.js';
import { toBase64url } from '../crypto.js';

describe('validateIdentityFull', () => {
  // ============================================================
  // REJECTION CASES — invalid identities must fail all checks
  // ============================================================

  it('should reject empty object with schema errors', async () => {
    const result = await validateIdentityFull({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject openclaw-deploy-style identity (sha256 AID, no KERI fields)', async () => {
    const fakeIdentity = {
      aid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      secrets: { pinata_jwt: 'eyJhbGciOiJIUzI1NiJ9.fake' }
    };
    const result = await validateIdentityFull(fakeIdentity);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KERI') || e.includes('Missing'))).toBe(true);
  });

  it('should reject identity with valid schema but invalid AID (not on Ed25519 curve)', async () => {
    // "B" prefix + 32 bytes of zeros base64url-encoded — passes schema, fails crypto
    const fakePublicKey = new Uint8Array(32).fill(0);
    const fakeAid = 'B' + toBase64url(fakePublicKey);
    const result = await validateIdentityFull({
      aid: fakeAid,
      publicKey: toBase64url(fakePublicKey),
      privateKey: toBase64url(new Uint8Array(32))
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('AID') && e.includes('Ed25519'))).toBe(true);
  });

  it('should reject identity with sha256 hash disguised with B prefix', async () => {
    // 32 bytes of 0xFF — has B prefix, correct length, but not on curve
    const fakePublicKey = new Uint8Array(32).fill(0xff);
    const fakeAid = 'B' + toBase64url(fakePublicKey);
    const result = await validateIdentityFull({
      aid: fakeAid,
      publicKey: toBase64url(fakePublicKey),
      privateKey: toBase64url(new Uint8Array(32))
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Ed25519'))).toBe(true);
  });

  it('should reject identity where AID does not match publicKey', async () => {
    // Create a real agent to get valid keys, then mismatch
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // Use valid AID but a different publicKey
    const differentKey = new Uint8Array(32).fill(0x42);
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: toBase64url(differentKey),
      privateKey: serialized.currentPrivateKey
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('mismatch') || e.includes('does not match'))).toBe(true);
  });

  it('should reject identity with invalid KEL (empty events)', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: { events: [] }
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL'))).toBe(true);
  });

  it('should reject identity with KEL whose AID does not match identity AID', async () => {
    const agent1 = await createAgent({ name: 'agent1' });
    const agent2 = await createAgent({ name: 'agent2' });
    const s1 = serializeAgent(agent1);
    const s2 = serializeAgent(agent2);
    // Use agent1's identity but agent2's KEL
    const result = await validateIdentityFull({
      aid: s1.aid,
      publicKey: s1.currentPublicKey,
      privateKey: s1.currentPrivateKey,
      kel: s2.kel
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL') && e.includes('AID'))).toBe(true);
  });

  // ============================================================
  // ACCEPTANCE CASES — valid identities must pass
  // ============================================================

  it('should accept valid flat identity with real Ed25519 keys (no KEL)', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid identity with KEL', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: serialized.kel
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid old-format identity with agent wrapper', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const result = await validateIdentityFull({
      agent: {
        aid: serialized.aid,
        currentPublicKey: serialized.currentPublicKey,
        currentPrivateKey: serialized.currentPrivateKey,
        createdAt: serialized.createdAt
      },
      kel: serialized.kel
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip KEL check when no KEL is present', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // No kel field — should still pass schema + AID crypto checks
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should collect errors from multiple validation layers', async () => {
    // Invalid schema (missing fields) + invalid AID prefix
    const result = await validateIdentityFull({
      aid: 'not-keri-aid'
    });
    expect(result.valid).toBe(false);
    // Should have schema errors (missing publicKey, privateKey) AND KERI prefix error
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
