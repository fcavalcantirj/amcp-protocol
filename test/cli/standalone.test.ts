/**
 * Standalone deployment regression test
 *
 * Simulates a child VM environment where only amcp-cli.ts is present
 * (no monorepo packages/ directory). If someone re-adds a monorepo import
 * or @noble/hashes dependency, this test fails immediately.
 */

import { execSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const CLI_SOURCE = join(__dirname, '../../scripts/amcp-cli.ts');

describe('standalone deployment (no monorepo)', () => {
  let tempDir: string;
  let identityPath: string;

  beforeAll(() => {
    // Create isolated temp directory simulating a child VM
    tempDir = mkdtempSync(join(tmpdir(), 'amcp-standalone-'));
    identityPath = join(tempDir, 'identity.json');

    // Copy ONLY the CLI script (no packages/ directory)
    execSync(`cp ${CLI_SOURCE} ${tempDir}/amcp-cli.ts`);

    // Create a minimal package.json with only @noble/ed25519
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'amcp-standalone-test',
      private: true,
      type: 'module',
      dependencies: {
        '@noble/ed25519': '^2.1.0',
      }
    }, null, 2));

    // Install dependencies (only @noble/ed25519, NO @noble/hashes)
    execSync('npm install --no-fund --no-audit 2>&1', {
      cwd: tempDir,
      timeout: 60000,
    });
  }, 90000);

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates identity without monorepo or @noble/hashes', () => {
    const result = execSync(
      `npx tsx amcp-cli.ts identity create --out ${identityPath}`,
      { cwd: tempDir, timeout: 30000, encoding: 'utf-8' }
    );
    expect(result).toContain('Identity created');

    const identity = JSON.parse(readFileSync(identityPath, 'utf-8'));
    expect(identity.aid).toMatch(/^B/);
    expect(identity.publicKey).toBeTruthy();
    expect(identity.privateKey).toBeTruthy();
  }, 60000);

  it('validates identity without monorepo or @noble/hashes', () => {
    const result = execSync(
      `npx tsx amcp-cli.ts identity validate --path ${identityPath}`,
      { cwd: tempDir, timeout: 30000, encoding: 'utf-8' }
    );
    const parsed = JSON.parse(result);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
  }, 60000);

  it('rejects fake sha256 identity without monorepo', () => {
    const fakePath = join(tempDir, 'fake-identity.json');
    writeFileSync(fakePath, JSON.stringify({
      aid: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      publicKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      privateKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      created: new Date().toISOString()
    }));

    try {
      execSync(
        `npx tsx amcp-cli.ts identity validate --path ${fakePath}`,
        { cwd: tempDir, timeout: 30000, encoding: 'utf-8' }
      );
      expect.fail('Should have exited with code 1');
    } catch (err: any) {
      expect(err.status).toBe(1);
      const output = err.stdout?.toString() || err.stderr?.toString() || '';
      expect(output).toContain('"valid":');
    }
  }, 60000);

  it('shows help without import errors', () => {
    const result = execSync(
      `npx tsx amcp-cli.ts`,
      { cwd: tempDir, timeout: 30000, encoding: 'utf-8' }
    );
    expect(result).toContain('AMCP CLI');
    expect(result).toContain('identity create');
  }, 60000);
});
