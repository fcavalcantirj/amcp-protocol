/**
 * Tests for identity schema validation
 *
 * Verifies that loadIdentity-style validation rejects identities
 * missing required KERI fields (aid, publicKey, privateKey with correct types).
 */

import { describe, it, expect } from 'vitest';
import { validateIdentitySchema, type IdentityValidationResult } from '../validate-identity.js';

describe('validateIdentitySchema', () => {
  // ============================================================
  // REJECTION CASES — invalid identities must fail
  // ============================================================

  it('should reject empty object', () => {
    const result = validateIdentitySchema({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject identity missing aid', () => {
    const result = validateIdentitySchema({
      publicKey: 'abc123',
      privateKey: 'def456',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: aid (expected string)');
  });

  it('should reject identity missing publicKey', () => {
    const result = validateIdentitySchema({
      aid: 'Babc123',
      privateKey: 'def456',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: publicKey (expected string)');
  });

  it('should reject identity missing privateKey', () => {
    const result = validateIdentitySchema({
      aid: 'Babc123',
      publicKey: 'abc123',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: privateKey (expected string)');
  });

  it('should reject identity with non-string aid', () => {
    const result = validateIdentitySchema({
      aid: 12345,
      publicKey: 'abc123',
      privateKey: 'def456',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: aid (expected string)');
  });

  it('should reject identity with non-string publicKey', () => {
    const result = validateIdentitySchema({
      aid: 'Babc123',
      publicKey: 12345,
      privateKey: 'def456',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: publicKey (expected string)');
  });

  it('should reject identity with non-string privateKey', () => {
    const result = validateIdentitySchema({
      aid: 'Babc123',
      publicKey: 'abc123',
      privateKey: { key: 'nested' },
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: privateKey (expected string)');
  });

  it('should reject identity with aid not starting with KERI Ed25519 prefix "B"', () => {
    const result = validateIdentitySchema({
      aid: 'not-a-keri-aid',
      publicKey: 'abc123',
      privateKey: 'def456',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KERI'))).toBe(true);
  });

  it('should reject openclaw-deploy-style identity (sha256 aid, no KERI prefix)', () => {
    // This mimics the openclaw-deploy format: sha256 AID, secrets.pinata_jwt, no agent wrapper, no KEL
    const fakeIdentity = {
      aid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      secrets: {
        pinata_jwt: 'eyJhbGciOiJIUzI1NiJ9.fake'
      }
    };
    const result = validateIdentitySchema(fakeIdentity);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject identity with null values for required fields', () => {
    const result = validateIdentitySchema({
      aid: null,
      publicKey: null,
      privateKey: null
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required field: aid (expected string)');
    expect(result.errors).toContain('Missing required field: publicKey (expected string)');
    expect(result.errors).toContain('Missing required field: privateKey (expected string)');
  });

  it('should collect multiple errors for multiple missing fields', () => {
    const result = validateIdentitySchema({});
    expect(result.valid).toBe(false);
    // Should report all three missing required fields
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  // ============================================================
  // ACCEPTANCE CASES — valid identities must pass
  // ============================================================

  it('should accept valid flat-format identity with KERI AID', () => {
    // "B" prefix + 43 chars of base64url = valid KERI Ed25519 AID format
    const result = validateIdentitySchema({
      aid: 'BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
      publicKey: 'Bs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
      privateKey: 'someprivatekeybase64url',
      created: '2026-02-14T00:00:00Z'
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept identity without optional created field', () => {
    const result = validateIdentitySchema({
      aid: 'BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
      publicKey: 'Bs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
      privateKey: 'someprivatekeybase64url'
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept identity with optional parentAID field', () => {
    const result = validateIdentitySchema({
      aid: 'BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
      publicKey: 'Bs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
      privateKey: 'someprivatekeybase64url',
      created: '2026-02-14T00:00:00Z',
      parentAID: 'BparentAIDbase64urlvalue'
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // ============================================================
  // OLD FORMAT — agent/chain structure
  // ============================================================

  it('should accept old-format identity with agent wrapper containing required KERI fields', () => {
    const result = validateIdentitySchema({
      agent: {
        aid: 'BBs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
        currentPublicKey: 'Bs3fryhTOhwYv_d5vxG6zZuA8ZC-3ozvpN5y4p8U0j8',
        currentPrivateKey: 'someprivatekeybase64url',
        createdAt: '2026-02-14T00:00:00Z'
      }
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject old-format identity with agent missing aid', () => {
    const result = validateIdentitySchema({
      agent: {
        currentPublicKey: 'abc123',
        currentPrivateKey: 'def456',
        createdAt: '2026-02-14T00:00:00Z'
      }
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('aid'))).toBe(true);
  });

  it('should reject old-format identity with agent.aid missing KERI prefix', () => {
    const result = validateIdentitySchema({
      agent: {
        aid: 'sha256hashnotKERI',
        currentPublicKey: 'abc123',
        currentPrivateKey: 'def456',
        createdAt: '2026-02-14T00:00:00Z'
      }
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KERI'))).toBe(true);
  });
});
