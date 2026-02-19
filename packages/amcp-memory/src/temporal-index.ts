/**
 * Temporal index utilities
 *
 * Provides entity version tracking across checkpoints.
 * Enables time-based queries for entity property history.
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * A snapshot of entities from a single checkpoint.
 * This is the input format for building temporal indices.
 */
export interface CheckpointSnapshot {
  /** CID of the checkpoint */
  cid: string;
  /** ISO8601 timestamp of the checkpoint */
  timestamp: string;
  /** Entities present in this checkpoint */
  entities: Array<{
    id: string;
    properties: Record<string, unknown>;
  }>;
}

/**
 * A single version of an entity at a point in time.
 */
export interface TemporalIndexEntry {
  /** Entity ID */
  entity_id: string;
  /** CID of the checkpoint containing this version */
  checkpoint_cid: string;
  /** Timestamp of the checkpoint */
  timestamp: Date;
  /** SHA-256 hash of serialized properties for change detection */
  version_hash: string;
  /** Properties snapshot at this point in time */
  properties_snapshot: Record<string, unknown>;
}

/**
 * A temporal index mapping entity IDs to their version histories.
 * Each entity has entries sorted chronologically (oldest first).
 */
export type TemporalIndex = Map<string, TemporalIndexEntry[]>;

/**
 * Compute a deterministic hash of entity properties for change detection.
 */
function computeVersionHash(properties: Record<string, unknown>): string {
  const canonical = JSON.stringify(properties, Object.keys(properties).sort());
  const hash = sha256(new TextEncoder().encode(canonical));
  return bytesToHex(hash);
}

/**
 * Build a temporal index from checkpoint snapshots.
 *
 * Extracts entity snapshots from each checkpoint and organizes them
 * into per-entity timelines sorted chronologically.
 *
 * @param snapshots - Array of checkpoint snapshots with entity data
 * @returns TemporalIndex mapping entity IDs to version histories
 */
export function buildTemporalIndex(snapshots: CheckpointSnapshot[]): TemporalIndex {
  const index: TemporalIndex = new Map();

  // Sort snapshots by timestamp (chronological)
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const snapshot of sorted) {
    const ts = new Date(snapshot.timestamp);

    for (const entity of snapshot.entities) {
      const entry: TemporalIndexEntry = {
        entity_id: entity.id,
        checkpoint_cid: snapshot.cid,
        timestamp: ts,
        version_hash: computeVersionHash(entity.properties),
        properties_snapshot: entity.properties,
      };

      const existing = index.get(entity.id);
      if (existing) {
        existing.push(entry);
      } else {
        index.set(entity.id, [entry]);
      }
    }
  }

  return index;
}

/**
 * Get the full version history for an entity.
 *
 * @param index - Temporal index to query
 * @param entity_id - Entity ID to look up
 * @returns Array of temporal entries sorted chronologically (oldest first), empty if not found
 */
export function getEntityHistory(
  index: TemporalIndex,
  entity_id: string
): TemporalIndexEntry[] {
  return index.get(entity_id) ?? [];
}

/**
 * Query entity versions within a time range.
 *
 * @param index - Temporal index to query
 * @param entity_id - Entity ID to filter
 * @param start_date - Start of time range (inclusive), undefined for no lower bound
 * @param end_date - End of time range (inclusive), undefined for no upper bound
 * @returns Filtered entries within the time range, sorted chronologically
 */
export function queryByTimeRange(
  index: TemporalIndex,
  entity_id: string,
  start_date?: Date,
  end_date?: Date
): TemporalIndexEntry[] {
  const history = getEntityHistory(index, entity_id);

  return history.filter((entry) => {
    const t = entry.timestamp.getTime();
    if (start_date && t < start_date.getTime()) return false;
    if (end_date && t > end_date.getTime()) return false;
    return true;
  });
}
