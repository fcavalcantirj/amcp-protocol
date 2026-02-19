/**
 * Temporal index tests
 *
 * Verifies buildTemporalIndex(), queryByTimeRange(), and getEntityHistory()
 * for tracking entity version history across checkpoints.
 */

import { describe, it, expect } from 'vitest';
import {
  buildTemporalIndex,
  queryByTimeRange,
  getEntityHistory,
  type TemporalIndexEntry,
  type CheckpointSnapshot,
} from '../src/temporal-index.js';

function makeSnapshot(
  cid: string,
  timestamp: string,
  entities: Array<{ id: string; properties: Record<string, unknown> }>
): CheckpointSnapshot {
  return { cid, timestamp, entities };
}

describe('Temporal index utilities', () => {
  describe('buildTemporalIndex()', () => {
    it('builds index from 3 snapshots sorted chronologically', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-3', '2026-02-15T00:00:00Z', [
          { id: 'entity-A', properties: { name: 'Alice v3' } },
        ]),
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-A', properties: { name: 'Alice v1' } },
        ]),
        makeSnapshot('cid-2', '2026-02-12T00:00:00Z', [
          { id: 'entity-A', properties: { name: 'Alice v2' } },
          { id: 'entity-B', properties: { role: 'admin' } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);

      // entity-A should have 3 entries, sorted chronologically
      const historyA = index.get('entity-A');
      expect(historyA).toBeDefined();
      expect(historyA).toHaveLength(3);
      expect(historyA![0].checkpoint_cid).toBe('cid-1');
      expect(historyA![1].checkpoint_cid).toBe('cid-2');
      expect(historyA![2].checkpoint_cid).toBe('cid-3');

      // entity-B should have 1 entry
      const historyB = index.get('entity-B');
      expect(historyB).toBeDefined();
      expect(historyB).toHaveLength(1);
      expect(historyB![0].checkpoint_cid).toBe('cid-2');
    });

    it('produces deterministic index (same input = same output)', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-X', properties: { value: 42 } },
        ]),
      ];

      const index1 = buildTemporalIndex(snapshots);
      const index2 = buildTemporalIndex(snapshots);

      const entries1 = index1.get('entity-X')!;
      const entries2 = index2.get('entity-X')!;

      expect(entries1).toHaveLength(1);
      expect(entries1[0].version_hash).toBe(entries2[0].version_hash);
      expect(entries1[0].checkpoint_cid).toBe(entries2[0].checkpoint_cid);
    });

    it('returns empty index for empty snapshot list', () => {
      const index = buildTemporalIndex([]);

      expect(index.size).toBe(0);
    });
  });

  describe('getEntityHistory()', () => {
    it('returns full timeline for entity with 2 versions', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-123', properties: { status: 'draft' } },
        ]),
        makeSnapshot('cid-2', '2026-02-12T00:00:00Z', [
          { id: 'entity-123', properties: { status: 'published' } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      const history = getEntityHistory(index, 'entity-123');

      expect(history).toHaveLength(2);
      expect(history[0].properties_snapshot.status).toBe('draft');
      expect(history[1].properties_snapshot.status).toBe('published');
    });

    it('returns empty array for non-existent entity', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-A', properties: { name: 'Alice' } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      const history = getEntityHistory(index, 'entity-MISSING');

      expect(history).toEqual([]);
    });

    it('detects unchanged properties via identical version_hash', () => {
      const sameProps = { status: 'active', level: 5 };
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-X', properties: { ...sameProps } },
        ]),
        makeSnapshot('cid-2', '2026-02-12T00:00:00Z', [
          { id: 'entity-X', properties: { ...sameProps } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      const history = getEntityHistory(index, 'entity-X');

      expect(history).toHaveLength(2);
      expect(history[0].version_hash).toBe(history[1].version_hash);
    });
  });

  describe('queryByTimeRange()', () => {
    it('filters entries within date range', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-A', properties: { v: 1 } },
        ]),
        makeSnapshot('cid-2', '2026-02-15T00:00:00Z', [
          { id: 'entity-A', properties: { v: 2 } },
        ]),
        makeSnapshot('cid-3', '2026-02-20T00:00:00Z', [
          { id: 'entity-A', properties: { v: 3 } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      const results = queryByTimeRange(
        index,
        'entity-A',
        new Date('2026-02-10T00:00:00Z'),
        new Date('2026-02-15T23:59:59Z')
      );

      expect(results).toHaveLength(2);
      expect(results[0].properties_snapshot.v).toBe(1);
      expect(results[1].properties_snapshot.v).toBe(2);
    });

    it('returns empty for entity created after query range', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-3', '2026-02-20T00:00:00Z', [
          { id: 'entity-late', properties: { v: 1 } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      const results = queryByTimeRange(
        index,
        'entity-late',
        new Date('2026-02-01T00:00:00Z'),
        new Date('2026-02-15T00:00:00Z')
      );

      expect(results).toEqual([]);
    });

    it('returns all entries when no date bounds specified', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-A', properties: { v: 1 } },
        ]),
        makeSnapshot('cid-2', '2026-02-20T00:00:00Z', [
          { id: 'entity-A', properties: { v: 2 } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      const results = queryByTimeRange(index, 'entity-A');

      expect(results).toHaveLength(2);
    });

    it('handles timestamps with different time zones correctly', () => {
      const snapshots: CheckpointSnapshot[] = [
        makeSnapshot('cid-1', '2026-02-10T00:00:00Z', [
          { id: 'entity-TZ', properties: { v: 1 } },
        ]),
        // +03:00 = 2026-02-10T09:00:00Z
        makeSnapshot('cid-2', '2026-02-10T12:00:00+03:00', [
          { id: 'entity-TZ', properties: { v: 2 } },
        ]),
      ];

      const index = buildTemporalIndex(snapshots);
      // Query range that includes both (both are on 2026-02-10 UTC)
      const results = queryByTimeRange(
        index,
        'entity-TZ',
        new Date('2026-02-10T00:00:00Z'),
        new Date('2026-02-10T23:59:59Z')
      );

      expect(results).toHaveLength(2);
      // Verify chronological order (00:00 UTC before 09:00 UTC)
      expect(results[0].checkpoint_cid).toBe('cid-1');
      expect(results[1].checkpoint_cid).toBe('cid-2');
    });
  });
});
