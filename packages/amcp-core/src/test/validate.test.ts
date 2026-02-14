/**
 * End-to-end fake identity rejection tests (prd-v1 task 6)
 *
 * Verifies that an openclaw-deploy-style identity (sha256 AID, secrets.pinata_jwt,
 * no agent wrapper, no KEL) is rejected by EVERY validation layer:
 *   - validateIdentitySchema() — schema check
 *   - isValidAid() — Ed25519 on-curve check
 *   - validateIdentityFull() — full pipeline
 *   - validateIdentityFile() — file-based pipeline
 *
 * Also verifies that a valid KERI identity (from createAgent()) passes all checks.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { validateIdentitySchema, validateIdentityFull } from '../validate-identity.js';
import { validateIdentityFile } from '../validate.js';
import { isValidAid } from '../aid.js';
import { createAgent, serializeAgent } from '../agent.js';
import { toBase64url } from '../crypto.js';

/**
 * The canonical fake identity fixture — matches openclaw-deploy format exactly.
 * SHA256-derived AID (hex string), secrets.pinata_jwt, no KERI prefix, no publicKey,
 * no privateKey, no KEL.
 */
const OPENCLAW_DEPLOY_FAKE: Record<string, unknown> = {
  aid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  secrets: {
    pinata_jwt: 'eyJhbGciOiJIUzI1NiJ9.fake'
  }
};

/** Create a unique temp directory for each test run */
function tempDir(): string {
  return join(tmpdir(), `amcp-validate-test-${randomBytes(8).toString('hex')}`);
}

describe('Fake identity rejection — every validation layer (prd-v1 task 6)', () => {
  const dirs: string[] = [];

  /** Write JSON to a temp file and return the path */
  async function writeTempIdentity(data: unknown): Promise<string> {
    const dir = tempDir();
    dirs.push(dir);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'identity.json');
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return filePath;
  }

  afterEach(async () => {
    for (const dir of dirs) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
    dirs.length = 0;
  });

  // ============================================================
  // Layer 1: validateIdentitySchema() rejects fake identity
  // ============================================================

  describe('validateIdentitySchema rejects openclaw-deploy fake', () => {
    it('should reject with schema errors (missing publicKey, privateKey, non-KERI AID)', () => {
      const result = validateIdentitySchema(OPENCLAW_DEPLOY_FAKE);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('publicKey'))).toBe(true);
      expect(result.errors.some(e => e.includes('privateKey'))).toBe(true);
      expect(result.errors.some(e => e.includes('KERI'))).toBe(true);
    });

    it('should collect all errors rather than failing on first', () => {
      const result = validateIdentitySchema(OPENCLAW_DEPLOY_FAKE);
      // At minimum: missing publicKey + missing privateKey + non-KERI AID
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================
  // Layer 2: isValidAid() rejects sha256-derived AID
  // ============================================================

  describe('isValidAid rejects sha256-derived AID', () => {
    it('should reject sha256 hex AID (no KERI prefix)', () => {
      expect(isValidAid(OPENCLAW_DEPLOY_FAKE.aid as string)).toBe(false);
    });

    it('should reject 0xFF fill bytes disguised with B prefix (not on Ed25519 curve)', () => {
      // 0xFF fill is not a valid Ed25519 point (y out of range for Ed25519 field prime)
      const badBytes = new Uint8Array(32).fill(0xFF);
      const disguisedAid = 'B' + toBase64url(badBytes);
      expect(isValidAid(disguisedAid)).toBe(false);
    });
  });

  // ============================================================
  // Layer 3: validateIdentityFull() rejects fake with multiple errors
  // ============================================================

  describe('validateIdentityFull rejects openclaw-deploy fake', () => {
    it('should return valid: false with multiple errors', async () => {
      const result = await validateIdentityFull(OPENCLAW_DEPLOY_FAKE);
      expect(result.valid).toBe(false);
      // Should have errors from schema layer (missing fields + KERI prefix)
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should include schema errors in the result', async () => {
      const result = await validateIdentityFull(OPENCLAW_DEPLOY_FAKE);
      expect(result.errors.some(e => e.includes('publicKey') || e.includes('Missing'))).toBe(true);
    });

    it('should include KERI prefix error in the result', async () => {
      const result = await validateIdentityFull(OPENCLAW_DEPLOY_FAKE);
      expect(result.errors.some(e => e.includes('KERI'))).toBe(true);
    });
  });

  // ============================================================
  // Layer 4: validateIdentityFile() rejects fake from disk
  // ============================================================

  describe('validateIdentityFile rejects openclaw-deploy fake from disk', () => {
    it('should return valid: false with multiple errors for fake identity file', async () => {
      const filePath = await writeTempIdentity(OPENCLAW_DEPLOY_FAKE);
      const result = await validateIdentityFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should include both schema and KERI prefix errors', async () => {
      const filePath = await writeTempIdentity(OPENCLAW_DEPLOY_FAKE);
      const result = await validateIdentityFile(filePath);
      expect(result.errors.some(e => e.includes('Missing') || e.includes('publicKey'))).toBe(true);
      expect(result.errors.some(e => e.includes('KERI'))).toBe(true);
    });

    it('should reject fake identity with B prefix but invalid Ed25519 bytes on disk', async () => {
      // 0xFF fill: passes schema (has B prefix), but fails Ed25519 on-curve check
      const badBytes = new Uint8Array(32).fill(0xFF);
      const disguisedFake = {
        aid: 'B' + toBase64url(badBytes),
        publicKey: toBase64url(badBytes),
        privateKey: toBase64url(new Uint8Array(32).fill(0xAA))
      };
      const filePath = await writeTempIdentity(disguisedFake);
      const result = await validateIdentityFile(filePath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Ed25519'))).toBe(true);
    });
  });

  // ============================================================
  // POSITIVE TESTS — valid KERI identity passes all checks
  // ============================================================

  describe('valid KERI identity passes all validation layers', () => {
    it('should pass validateIdentitySchema with createAgent-generated identity', async () => {
      const agent = await createAgent({ name: 'valid-test' });
      const serialized = serializeAgent(agent);
      const result = validateIdentitySchema({
        aid: serialized.aid,
        publicKey: serialized.currentPublicKey,
        privateKey: serialized.currentPrivateKey
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass isValidAid with createAgent-generated AID', async () => {
      const agent = await createAgent({ name: 'valid-test' });
      expect(isValidAid(agent.aid)).toBe(true);
    });

    it('should pass validateIdentityFull with createAgent-generated identity + KEL', async () => {
      const agent = await createAgent({ name: 'valid-test' });
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

    it('should pass validateIdentityFile with createAgent-generated identity file', async () => {
      const agent = await createAgent({ name: 'valid-test' });
      const serialized = serializeAgent(agent);
      const filePath = await writeTempIdentity({
        aid: serialized.aid,
        publicKey: serialized.currentPublicKey,
        privateKey: serialized.currentPrivateKey,
        kel: serialized.kel
      });
      const result = await validateIdentityFile(filePath);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});
