/**
 * AMCP CLI integration tests
 *
 * Runs the actual CLI binary via execSync to test real behavior.
 * Tests identity CRUD, validation (accept + reject), and checkpoint roundtrip.
 */

import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const CLI_PATH = join(__dirname, '../../scripts/amcp-cli.ts');
const PROTO_ROOT = join(__dirname, '../..');

function runCli(args: string, opts: { cwd?: string } = {}): string {
  return execSync(`npx tsx ${CLI_PATH} ${args}`, {
    cwd: opts.cwd || PROTO_ROOT,
    timeout: 30000,
    encoding: 'utf-8',
    env: { ...process.env, HOME: process.env.HOME },
  });
}

function runCliFail(args: string, opts: { cwd?: string } = {}): { status: number; output: string } {
  try {
    const output = runCli(args, opts);
    return { status: 0, output };
  } catch (err: any) {
    return {
      status: err.status ?? 1,
      output: (err.stdout?.toString() || '') + (err.stderr?.toString() || '')
    };
  }
}

describe('amcp-cli integration', () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'amcp-cli-test-'));
  });

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('shows help with no args (exit 0)', () => {
    const output = runCli('');
    expect(output).toContain('AMCP CLI');
    expect(output).toContain('identity create');
    expect(output).toContain('checkpoint create');
    expect(output).toContain('resuscitate');
    expect(output).toContain('verify');
  });

  describe('identity create', () => {
    const identityPath = () => join(tempDir, 'test-identity.json');

    it('creates valid identity JSON', () => {
      const output = runCli(`identity create --out ${identityPath()}`);
      expect(output).toContain('Identity created');

      const identity = JSON.parse(readFileSync(identityPath(), 'utf-8'));
      expect(identity).toHaveProperty('aid');
      expect(identity).toHaveProperty('publicKey');
      expect(identity).toHaveProperty('privateKey');
      expect(identity).toHaveProperty('created');
    });

    it('AID starts with B, publicKey is base64url', () => {
      const identity = JSON.parse(readFileSync(identityPath(), 'utf-8'));
      expect(identity.aid).toMatch(/^B[A-Za-z0-9_-]+$/);
      expect(identity.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('creates identity with parent AID', () => {
      const parentPath = join(tempDir, 'parent-identity.json');
      const output = runCli(`identity create --out ${parentPath} --parent-aid BfakeParentAID123`);
      expect(output).toContain('Parent AID: BfakeParentAID123');

      const identity = JSON.parse(readFileSync(parentPath, 'utf-8'));
      expect(identity.parentAID).toBe('BfakeParentAID123');
    });
  });

  describe('identity validate', () => {
    it('accepts valid identity', () => {
      const idPath = join(tempDir, 'valid-for-validate.json');
      runCli(`identity create --out ${idPath}`);

      const output = runCli(`identity validate --path ${idPath}`);
      const result = JSON.parse(output);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects fake sha256 identity', () => {
      const fakePath = join(tempDir, 'fake-sha256.json');
      writeFileSync(fakePath, JSON.stringify({
        aid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        privateKey: 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        created: new Date().toISOString()
      }));

      const { status, output } = runCliFail(`identity validate --path ${fakePath}`);
      expect(status).toBe(1);
      const result = JSON.parse(output);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects empty object', () => {
      const emptyPath = join(tempDir, 'empty.json');
      writeFileSync(emptyPath, '{}');

      const { status, output } = runCliFail(`identity validate --path ${emptyPath}`);
      expect(status).toBe(1);
      const result = JSON.parse(output);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects identity with mismatched AID and publicKey', () => {
      // Create two identities, swap the AID of one with the publicKey of another
      const id1Path = join(tempDir, 'mismatch-id1.json');
      const id2Path = join(tempDir, 'mismatch-id2.json');
      runCli(`identity create --out ${id1Path}`);
      runCli(`identity create --out ${id2Path}`);

      const id1 = JSON.parse(readFileSync(id1Path, 'utf-8'));
      const id2 = JSON.parse(readFileSync(id2Path, 'utf-8'));

      // Write identity with id1's AID but id2's publicKey
      const mismatchPath = join(tempDir, 'mismatched.json');
      writeFileSync(mismatchPath, JSON.stringify({
        aid: id1.aid,
        publicKey: id2.publicKey,
        privateKey: id2.privateKey,
        created: new Date().toISOString()
      }));

      const { status, output } = runCliFail(`identity validate --path ${mismatchPath}`);
      expect(status).toBe(1);
      const result = JSON.parse(output);
      expect(result.valid).toBe(false);
    });
  });

  describe('identity show', () => {
    it('displays identity details', () => {
      const idPath = join(tempDir, 'show-test.json');
      runCli(`identity create --out ${idPath}`);

      const output = runCli(`identity show --identity ${idPath}`);
      expect(output).toContain('AID:');
      expect(output).toContain('Public Key:');
      expect(output).toContain('Created:');
    });
  });

  describe('checkpoint roundtrip', () => {
    it('creates and verifies a checkpoint', () => {
      const idPath = join(tempDir, 'checkpoint-id.json');
      const contentDir = join(tempDir, 'checkpoint-content');
      const checkpointPath = join(tempDir, 'test-checkpoint.amcp');

      // Create identity
      runCli(`identity create --out ${idPath}`);

      // Create content directory with test files
      mkdirSync(contentDir, { recursive: true });
      writeFileSync(join(contentDir, 'SOUL.md'), '# Test Soul\nI am a test agent.');
      writeFileSync(join(contentDir, 'MEMORY.md'), '# Test Memory\nI remember things.');
      writeFileSync(join(contentDir, 'config.json'), '{"key": "value"}');

      // Create checkpoint
      const createOutput = runCli(
        `checkpoint create --identity ${idPath} --content ${contentDir} --out ${checkpointPath}`
      );
      expect(createOutput).toContain('Checkpoint created');

      // Verify checkpoint
      const verifyOutput = runCli(`verify --checkpoint ${checkpointPath}`);
      expect(verifyOutput).toContain('VALID');
    });

    it('creates checkpoint with secrets and resuscitates', () => {
      const idPath = join(tempDir, 'resus-id.json');
      const contentDir = join(tempDir, 'resus-content');
      const checkpointPath = join(tempDir, 'resus-checkpoint.amcp');
      const restoredDir = join(tempDir, 'restored-content');
      const restoredSecrets = join(tempDir, 'restored-secrets.json');
      const secretsPath = join(tempDir, 'test-secrets.json');

      // Create identity and content
      runCli(`identity create --out ${idPath}`);
      mkdirSync(contentDir, { recursive: true });
      writeFileSync(join(contentDir, 'SOUL.md'), '# Resuscitate Test');

      // Create secrets file
      writeFileSync(secretsPath, JSON.stringify([
        {
          key: 'PINATA_JWT',
          value: 'test-jwt-token-12345',
          type: 'jwt',
          targets: [{ kind: 'file', path: '~/.amcp/config.json', jsonPath: 'pinata.jwt' }]
        }
      ]));

      // Create checkpoint with secrets
      runCli(
        `checkpoint create --identity ${idPath} --content ${contentDir} --secrets ${secretsPath} --out ${checkpointPath}`
      );

      // Resuscitate
      const resusOutput = runCli(
        `resuscitate --checkpoint ${checkpointPath} --identity ${idPath} --out-content ${restoredDir} --out-secrets ${restoredSecrets}`
      );
      expect(resusOutput).toContain('verified and decrypted');

      // Verify restored content
      const restoredSoul = readFileSync(join(restoredDir, 'SOUL.md'), 'utf-8');
      expect(restoredSoul).toBe('# Resuscitate Test');

      // Verify restored secrets
      const secrets = JSON.parse(readFileSync(restoredSecrets, 'utf-8'));
      expect(secrets).toHaveLength(1);
      expect(secrets[0].key).toBe('PINATA_JWT');
      expect(secrets[0].value).toBe('test-jwt-token-12345');
    });
  });
});
