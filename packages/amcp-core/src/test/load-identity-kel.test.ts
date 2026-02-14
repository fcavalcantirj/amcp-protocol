/**
 * Tests for KEL integrity check in loadIdentity() flow
 *
 * prd-v1 task 4: loadIdentity() should call verifyKEL() on load,
 * rejecting corrupt/missing inception events.
 *
 * Since loadIdentity() is in the CLI (scripts/amcp-cli.ts) and reads from files,
 * we test the underlying validateIdentityFull() function which loadIdentity()
 * delegates to. These tests verify the KEL integrity layer specifically.
 */

import { describe, it, expect } from 'vitest';
import { validateIdentityFull } from '../validate-identity.js';
import { createAgent, serializeAgent } from '../agent.js';
import { toBase64url, fromBase64url } from '../crypto.js';
import { type KeyEventLog, type InceptionEvent } from '../kel.js';

describe('KEL integrity check in loadIdentity flow (prd-v1 task 4)', () => {
  // ============================================================
  // REJECTION CASES — corrupt/invalid KELs must fail
  // ============================================================

  it('should reject identity with empty KEL (no events)', async () => {
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

  it('should reject identity with KEL missing inception event (starts with rotation)', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // Create a fake KEL where the first event is a rotation, not inception
    const fakeKel: KeyEventLog = {
      events: [{
        type: 'rotation',
        aid: serialized.aid,
        sn: 1,
        prior: 'fakehash',
        keys: [serialized.currentPublicKey],
        next: 'fakecommitment',
        timestamp: new Date().toISOString(),
        signature: 'fakesig'
      }]
    };
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: fakeKel
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL'))).toBe(true);
  });

  it('should reject identity with KEL where inception has wrong sn (not 0)', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // Tamper with the KEL: change inception sn from 0 to 1
    const tamperedKel: KeyEventLog = JSON.parse(JSON.stringify(serialized.kel));
    (tamperedKel.events[0] as unknown as { sn: number }).sn = 1;
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: tamperedKel
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL'))).toBe(true);
  });

  it('should reject identity with KEL where signature is corrupted', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // Tamper with the inception event signature
    const tamperedKel: KeyEventLog = JSON.parse(JSON.stringify(serialized.kel));
    tamperedKel.events[0].signature = toBase64url(new Uint8Array(64).fill(0xAB));
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: tamperedKel
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL'))).toBe(true);
  });

  it('should reject identity with KEL where AID was tampered', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // Tamper with the KEL event's AID field
    const tamperedKel: KeyEventLog = JSON.parse(JSON.stringify(serialized.kel));
    tamperedKel.events[0].aid = 'B' + toBase64url(new Uint8Array(32).fill(0x42));
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: tamperedKel
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL'))).toBe(true);
  });

  it('should reject identity with KEL whose inception AID does not match identity AID', async () => {
    const agent1 = await createAgent({ name: 'agent1' });
    const agent2 = await createAgent({ name: 'agent2' });
    const s1 = serializeAgent(agent1);
    const s2 = serializeAgent(agent2);
    // Use agent1's identity but agent2's valid KEL
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
  // ACCEPTANCE CASES — valid KELs must pass
  // ============================================================

  it('should accept identity with valid KEL from createAgent', async () => {
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

  it('should accept identity without KEL (flat CLI identities)', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    // No kel field — should still pass all non-KEL checks
    const result = await validateIdentityFull({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept old-format identity with valid KEL', async () => {
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
});
