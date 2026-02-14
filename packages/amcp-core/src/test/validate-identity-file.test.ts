/**
 * Tests for validateIdentityFile(path) — file-based identity validation
 *
 * Validates the full pipeline: file read → JSON parse → schema + AID crypto + KEL integrity.
 * Uses real temp files on disk, no mocks.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { validateIdentityFile } from '../validate.js';
import { createAgent, serializeAgent } from '../agent.js';
import { toBase64url } from '../crypto.js';

/** Create a unique temp directory for each test run */
function tempDir(): string {
  return join(tmpdir(), `amcp-test-${randomBytes(8).toString('hex')}`);
}

describe('validateIdentityFile', () => {
  const dirs: string[] = [];

  /** Helper: write JSON to a temp file and return the path */
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
  // REJECTION CASES — file-level errors
  // ============================================================

  it('should reject when file does not exist', async () => {
    const result = await validateIdentityFile('/tmp/amcp-nonexistent-path/identity.json');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('read') || e.includes('exist') || e.includes('ENOENT'))).toBe(true);
  });

  it('should reject when file contains invalid JSON', async () => {
    const dir = tempDir();
    dirs.push(dir);
    await mkdir(dir, { recursive: true });
    const filePath = join(dir, 'identity.json');
    await writeFile(filePath, 'not valid json {{{', 'utf-8');

    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('JSON') || e.includes('parse'))).toBe(true);
  });

  it('should reject when file contains a JSON array instead of object', async () => {
    const filePath = await writeTempIdentity([1, 2, 3]);
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('object'))).toBe(true);
  });

  it('should reject when file contains JSON null', async () => {
    const filePath = await writeTempIdentity(null);
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('object'))).toBe(true);
  });

  // ============================================================
  // REJECTION CASES — identity validation errors
  // ============================================================

  it('should reject empty object identity file', async () => {
    const filePath = await writeTempIdentity({});
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should reject openclaw-deploy-style identity file', async () => {
    const filePath = await writeTempIdentity({
      aid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      secrets: { pinata_jwt: 'eyJhbGciOiJIUzI1NiJ9.fake' }
    });
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KERI') || e.includes('Missing'))).toBe(true);
  });

  it('should reject identity file with invalid AID (not on Ed25519 curve)', async () => {
    const fakePublicKey = new Uint8Array(32).fill(0);
    const filePath = await writeTempIdentity({
      aid: 'B' + toBase64url(fakePublicKey),
      publicKey: toBase64url(fakePublicKey),
      privateKey: toBase64url(new Uint8Array(32))
    });
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Ed25519'))).toBe(true);
  });

  it('should reject identity file where AID does not match publicKey', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const differentKey = new Uint8Array(32).fill(0x42);
    const filePath = await writeTempIdentity({
      aid: serialized.aid,
      publicKey: toBase64url(differentKey),
      privateKey: serialized.currentPrivateKey
    });
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('mismatch') || e.includes('does not match'))).toBe(true);
  });

  it('should reject identity file with corrupt KEL', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const filePath = await writeTempIdentity({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey,
      kel: { events: [] }
    });
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('KEL'))).toBe(true);
  });

  // ============================================================
  // ACCEPTANCE CASES — valid identity files
  // ============================================================

  it('should accept valid flat identity file', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const filePath = await writeTempIdentity({
      aid: serialized.aid,
      publicKey: serialized.currentPublicKey,
      privateKey: serialized.currentPrivateKey
    });
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept valid identity file with KEL', async () => {
    const agent = await createAgent({ name: 'test' });
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

  it('should accept valid old-format identity file', async () => {
    const agent = await createAgent({ name: 'test' });
    const serialized = serializeAgent(agent);
    const filePath = await writeTempIdentity({
      agent: {
        aid: serialized.aid,
        currentPublicKey: serialized.currentPublicKey,
        currentPrivateKey: serialized.currentPrivateKey,
        createdAt: serialized.createdAt
      },
      kel: serialized.kel
    });
    const result = await validateIdentityFile(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
