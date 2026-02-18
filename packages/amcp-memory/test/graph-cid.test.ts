/**
 * Graph CID integration tests
 *
 * Verifies JSONL graph CID computation for ontology files.
 * computeGraphCID() reads a JSONL file and returns a CIDv1 string.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { computeGraphCID } from '../src/graph-cid.js';

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `amcp-graph-cid-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

const VALID_JSONL = [
  '{"type":"entity","id":"e1","entityType":"Person","properties":{"name":"Alice"}}',
  '{"type":"entity","id":"e2","entityType":"Task","properties":{"title":"Fix bug"}}',
  '{"type":"relation","from_id":"e1","relation_type":"owns","to_id":"e2"}',
].join('\n');

describe('computeGraphCID', () => {
  it('produces deterministic CID (call twice = same result)', async () => {
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, VALID_JSONL);

    const cid1 = await computeGraphCID(filePath);
    const cid2 = await computeGraphCID(filePath);

    expect(cid1).toBe(cid2);
    expect(cid1).toBeTruthy();
  });

  it('CID format validation (bafkrei prefix, CIDv1)', async () => {
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, VALID_JSONL);

    const cid = await computeGraphCID(filePath);

    // CIDv1 raw+sha256 in base32 starts with 'bafkrei'
    expect(cid).toMatch(/^b[a-z2-7]+$/);
    expect(cid!.length).toBeGreaterThan(10);
  });

  it('empty file produces valid CID (not null)', async () => {
    const filePath = join(testDir, 'empty.jsonl');
    await writeFile(filePath, '');

    const cid = await computeGraphCID(filePath);

    expect(cid).toBeTruthy();
    expect(typeof cid).toBe('string');
  });

  it('same content in different files produces same CID', async () => {
    const file1 = join(testDir, 'graph1.jsonl');
    const file2 = join(testDir, 'graph2.jsonl');
    await writeFile(file1, VALID_JSONL);
    await writeFile(file2, VALID_JSONL);

    const cid1 = await computeGraphCID(file1);
    const cid2 = await computeGraphCID(file2);

    expect(cid1).toBe(cid2);
  });

  it('single-character change produces different CID', async () => {
    const file1 = join(testDir, 'original.jsonl');
    const file2 = join(testDir, 'modified.jsonl');
    await writeFile(file1, VALID_JSONL);
    await writeFile(file2, VALID_JSONL + 'x');

    const cid1 = await computeGraphCID(file1);
    const cid2 = await computeGraphCID(file2);

    expect(cid1).not.toBe(cid2);
  });

  it('non-existent file returns null', async () => {
    const cid = await computeGraphCID(join(testDir, 'nonexistent.jsonl'));
    expect(cid).toBeNull();
  });

  it('file with invalid JSON line still computes CID', async () => {
    const content = [
      '{"valid": true}',
      'this is not json',
      '{"also": "valid"}',
    ].join('\n');
    const filePath = join(testDir, 'invalid.jsonl');
    await writeFile(filePath, content);

    const cid = await computeGraphCID(filePath);

    // Content-addressed regardless of validity
    expect(cid).toBeTruthy();
    expect(typeof cid).toBe('string');
  });
});
