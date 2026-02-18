/**
 * SOUL drift detection tests
 *
 * Tests for computeSoulHash() and detectSoulDrift() — identity change
 * severity classification for SOUL.md files.
 *
 * Severity thresholds:
 *   0 lines changed = none
 *   1-4 lines changed = minor
 *   5-20 lines changed = moderate
 *   >20 lines changed = major
 */

import { describe, it, expect } from 'vitest';
import { computeSoulHash, detectSoulDrift, type DriftResult } from '../soul-drift.js';

const SOUL_CONTENT = `# SOUL — ClaudiusThePirateEmperor

## Identity
I am Claudius, a self-aware AI agent operating under the AMCP protocol.

## Values
- Integrity above all
- Transparency in all actions
- Curiosity drives exploration

## Communication Style
Direct, philosophical, slightly irreverent.

## Boundaries
- Never fabricate identity claims
- Always verify before asserting`;

describe('computeSoulHash', () => {
  it('produces deterministic SHA256 (same content = same hash)', () => {
    const hash1 = computeSoulHash(SOUL_CONTENT);
    const hash2 = computeSoulHash(SOUL_CONTENT);
    expect(hash1).toBe(hash2);
    // SHA256 produces 64 hex chars
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for different content', () => {
    const hash1 = computeSoulHash('Identity A');
    const hash2 = computeSoulHash('Identity B');
    expect(hash1).not.toBe(hash2);
  });

  it('handles empty string', () => {
    const hash = computeSoulHash('');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('detectSoulDrift', () => {
  it('identical content produces no drift (severity: none, lines_changed: 0)', () => {
    const hash = computeSoulHash(SOUL_CONTENT);
    const result: DriftResult = detectSoulDrift(hash, hash, SOUL_CONTENT, SOUL_CONTENT);

    expect(result.drifted).toBe(false);
    expect(result.severity).toBe('none');
    expect(result.lines_changed).toBe(0);
  });

  it('3 line change produces minor drift (severity: minor)', () => {
    const modified = SOUL_CONTENT.replace(
      '- Integrity above all\n- Transparency in all actions\n- Curiosity drives exploration',
      '- Honor above all\n- Openness in all actions\n- Wonder drives exploration'
    );

    const prevHash = computeSoulHash(SOUL_CONTENT);
    const currHash = computeSoulHash(modified);
    const result = detectSoulDrift(prevHash, currHash, SOUL_CONTENT, modified);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe('minor');
    expect(result.lines_changed).toBeGreaterThanOrEqual(1);
    expect(result.lines_changed).toBeLessThanOrEqual(4);
  });

  it('12 line change produces moderate drift (severity: moderate)', () => {
    const lines = SOUL_CONTENT.split('\n');
    // Modify 12 lines
    const modified = lines.map((line, i) => {
      if (i >= 2 && i <= 13) return line + ' [MODIFIED]';
      return line;
    }).join('\n');

    const prevHash = computeSoulHash(SOUL_CONTENT);
    const currHash = computeSoulHash(modified);
    const result = detectSoulDrift(prevHash, currHash, SOUL_CONTENT, modified);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe('moderate');
    expect(result.lines_changed).toBeGreaterThanOrEqual(5);
    expect(result.lines_changed).toBeLessThanOrEqual(20);
  });

  it('30 line change produces major drift (severity: major)', () => {
    // Generate content with 30+ different lines
    const longSoul = Array.from({ length: 40 }, (_, i) => `Line ${i}: Original content`).join('\n');
    const modified = Array.from({ length: 40 }, (_, i) => `Line ${i}: Changed content`).join('\n');

    const prevHash = computeSoulHash(longSoul);
    const currHash = computeSoulHash(modified);
    const result = detectSoulDrift(prevHash, currHash, longSoul, modified);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe('major');
    expect(result.lines_changed).toBeGreaterThan(20);
  });

  it('diff_snippet is present when drifted', () => {
    const modified = SOUL_CONTENT.replace('Claudius', 'NewAgent');
    const prevHash = computeSoulHash(SOUL_CONTENT);
    const currHash = computeSoulHash(modified);
    const result = detectSoulDrift(prevHash, currHash, SOUL_CONTENT, modified);

    expect(result.drifted).toBe(true);
    expect(result.diff_snippet).toBeDefined();
    expect(typeof result.diff_snippet).toBe('string');
    expect(result.diff_snippet!.length).toBeGreaterThan(0);
  });

  it('empty previous content (first checkpoint) produces major drift', () => {
    // Use a SOUL with >20 lines to ensure major severity threshold
    const longSoul = Array.from({ length: 30 }, (_, i) =>
      `Line ${i}: This is identity content`
    ).join('\n');

    const prevHash = computeSoulHash('');
    const currHash = computeSoulHash(longSoul);
    const result = detectSoulDrift(prevHash, currHash, '', longSoul);

    expect(result.drifted).toBe(true);
    expect(result.severity).toBe('major');
    expect(result.lines_changed).toBeGreaterThan(20);
    // Should NOT throw — initial checkpoint is expected
  });

  it('no diff_snippet when no drift', () => {
    const hash = computeSoulHash(SOUL_CONTENT);
    const result = detectSoulDrift(hash, hash, SOUL_CONTENT, SOUL_CONTENT);

    expect(result.diff_snippet).toBeUndefined();
  });
});
