/**
 * Ontology validation tests
 *
 * Tests for validateOntologySchema() — entity and relation schema enforcement
 * for JSONL graph files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateOntologySchema } from '../src/validate-ontology.js';

let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `amcp-ontology-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('validateOntologySchema', () => {
  it('valid graph with 2 entities + 1 relation passes validation', async () => {
    const content = [
      '{"type":"entity","id":"e1","entityType":"Person","properties":{"name":"Alice"},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"entity","id":"e2","entityType":"Task","properties":{"title":"Fix bug"},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"relation","from_id":"e1","relation_type":"owns","to_id":"e2"}',
    ].join('\n');
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, content);

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(true);
    expect(result.entity_count).toBe(2);
    expect(result.relation_count).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('invalid JSON on line 3 fails with parse error', async () => {
    const content = [
      '{"type":"entity","id":"e1","entityType":"Person","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"entity","id":"e2","entityType":"Task","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      'this is not valid json',
    ].join('\n');
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, content);

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('Line 3'))).toBe(true);
  });

  it('entity missing id field fails with required field error', async () => {
    const content = [
      '{"type":"entity","entityType":"Person","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
    ].join('\n');
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, content);

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('relation with from_id referencing non-existent entity fails', async () => {
    const content = [
      '{"type":"entity","id":"e1","entityType":"Person","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"relation","from_id":"nonexistent","relation_type":"owns","to_id":"e1"}',
    ].join('\n');
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, content);

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('nonexistent'))).toBe(true);
  });

  it('circular dependency (blocks) fails with cycle detection error', async () => {
    const content = [
      '{"type":"entity","id":"task-A","entityType":"Task","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"entity","id":"task-B","entityType":"Task","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"relation","from_id":"task-A","relation_type":"blocks","to_id":"task-B"}',
      '{"type":"relation","from_id":"task-B","relation_type":"blocks","to_id":"task-A"}',
    ].join('\n');
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, content);

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.toLowerCase().includes('circular') || e.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('empty file passes validation', async () => {
    const filePath = join(testDir, 'empty.jsonl');
    await writeFile(filePath, '');

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(true);
    expect(result.entity_count).toBe(0);
    expect(result.relation_count).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('mixed valid/invalid lines returns errors for invalid lines only', async () => {
    const content = [
      '{"type":"entity","id":"e1","entityType":"Person","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      'not json',
      '{"type":"entity","id":"e2","entityType":"Task","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
      '{"type":"entity","properties":{},"created":"2026-02-18","updated":"2026-02-18"}',
    ].join('\n');
    const filePath = join(testDir, 'graph.jsonl');
    await writeFile(filePath, content);

    const result = await validateOntologySchema(filePath);

    expect(result.valid).toBe(false);
    // Should have errors for line 2 (invalid JSON) and line 4 (missing id)
    expect(result.errors.some(e => e.includes('Line 2'))).toBe(true);
    expect(result.errors.some(e => e.includes('Line 4'))).toBe(true);
    // Valid entities should still be counted
    expect(result.entity_count).toBe(2);
  });
});
