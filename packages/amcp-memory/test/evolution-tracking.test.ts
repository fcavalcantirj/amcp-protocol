/**
 * Evolution tracking metadata tests
 *
 * Verifies that CheckpointMetadata supports evolutionChainCID and
 * relatedEntitiesCount fields for tracking memory evolution chains
 * across checkpoints. Backward compatible with existing checkpoints.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@amcp/core';
import { createCheckpoint, verifyCheckpoint, type CheckpointMetadata } from '../src/checkpoint.js';

const BASE_METADATA: CheckpointMetadata = {
  platform: 'test',
  version: '1.0.0',
  sessionCount: 1,
};

describe('CheckpointMetadata evolution tracking fields', () => {
  describe('evolutionChainCID field', () => {
    it('accepts evolutionChainCID in metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        evolutionChainCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora',
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.evolutionChainCID).toBe(
        'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora'
      );
    });

    it('omits evolutionChainCID when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.evolutionChainCID).toBeUndefined();
    });
  });

  describe('relatedEntitiesCount field', () => {
    it('accepts relatedEntitiesCount = 5 in metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        relatedEntitiesCount: 5,
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.relatedEntitiesCount).toBe(5);
    });

    it('accepts relatedEntitiesCount = 0 (no evolution in this period)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        relatedEntitiesCount: 0,
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.relatedEntitiesCount).toBe(0);
    });

    it('omits relatedEntitiesCount when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.relatedEntitiesCount).toBeUndefined();
    });
  });

  describe('both evolution fields together', () => {
    it('accepts both evolutionChainCID and relatedEntitiesCount', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        evolutionChainCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora',
        relatedEntitiesCount: 12,
      };

      const result = await createCheckpoint(agent, { data: 'evolution' }, null, metadata);

      expect(result.checkpoint.metadata.evolutionChainCID).toBe(
        'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora'
      );
      expect(result.checkpoint.metadata.relatedEntitiesCount).toBe(12);
    });

    it('preserves relatedEntitiesCount through serialize/deserialize cycle', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        evolutionChainCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora',
        relatedEntitiesCount: 5,
      };

      const result = await createCheckpoint(agent, { roundtrip: true }, null, metadata);
      const serialized = JSON.stringify(result.checkpoint);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.metadata.evolutionChainCID).toBe(
        'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora'
      );
      expect(deserialized.metadata.relatedEntitiesCount).toBe(5);
    });

    it('signature is valid with evolution metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        evolutionChainCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenora',
        relatedEntitiesCount: 8,
      };

      const result = await createCheckpoint(agent, { signed: true }, null, metadata);
      const isValid = await verifyCheckpoint(result.checkpoint, agent.kel);

      expect(isValid).toBe(true);
    });

    it('existing checkpoints without evolution fields remain valid', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { legacy: true }, null, BASE_METADATA);
      const isValid = await verifyCheckpoint(result.checkpoint, agent.kel);

      expect(isValid).toBe(true);
      expect(result.checkpoint.metadata.evolutionChainCID).toBeUndefined();
      expect(result.checkpoint.metadata.relatedEntitiesCount).toBeUndefined();
    });
  });
});
