/**
 * Checkpoint ontology metadata extension tests
 *
 * Verifies that CheckpointMetadata supports ontologyGraphCID, soulHash,
 * and reconstructionSeam fields, and that createCheckpoint() correctly
 * handles them while remaining backward compatible.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@amcp/core';
import { createCheckpoint, verifyCheckpoint, type CheckpointMetadata } from '../src/checkpoint.js';

const BASE_METADATA: CheckpointMetadata = {
  platform: 'test',
  version: '1.0.0',
  sessionCount: 1,
};

describe('CheckpointMetadata ontology extensions', () => {
  describe('ontologyGraphCID field', () => {
    it('accepts ontologyGraphCID in metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        ontologyGraphCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77y4',
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.ontologyGraphCID).toBe(
        'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77y4'
      );
    });

    it('omits ontologyGraphCID when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.ontologyGraphCID).toBeUndefined();
    });
  });

  describe('soulHash field', () => {
    it('accepts soulHash in metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        soulHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.soulHash).toBe(
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
      );
    });

    it('omits soulHash when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.soulHash).toBeUndefined();
    });
  });

  describe('reconstructionSeam field', () => {
    it('accepts reconstructionSeam value 0 (SOUL step)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        reconstructionSeam: 0,
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.reconstructionSeam).toBe(0);
    });

    it('accepts reconstructionSeam value 7 (post-context-load)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        reconstructionSeam: 7,
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.reconstructionSeam).toBe(7);
    });

    it('omits reconstructionSeam when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.reconstructionSeam).toBeUndefined();
    });
  });

  describe('all ontology fields together', () => {
    it('accepts all three ontology fields simultaneously', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        ontologyGraphCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77y4',
        soulHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
        reconstructionSeam: 7,
      };

      const result = await createCheckpoint(agent, { data: 'full ontology' }, null, metadata);

      expect(result.checkpoint.metadata.ontologyGraphCID).toBe(
        'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77y4'
      );
      expect(result.checkpoint.metadata.soulHash).toBe(
        'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
      );
      expect(result.checkpoint.metadata.reconstructionSeam).toBe(7);
    });

    it('ontology metadata survives JSON roundtrip', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        ontologyGraphCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77y4',
        soulHash: 'deadbeef'.repeat(8),
        reconstructionSeam: 4,
      };

      const result = await createCheckpoint(agent, { roundtrip: true }, null, metadata);

      // Simulate JSON roundtrip (as would happen in storage/retrieval)
      const serialized = JSON.stringify(result.checkpoint);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.metadata.ontologyGraphCID).toBe(metadata.ontologyGraphCID);
      expect(deserialized.metadata.soulHash).toBe(metadata.soulHash);
      expect(deserialized.metadata.reconstructionSeam).toBe(metadata.reconstructionSeam);
    });

    it('signature is valid with ontology metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        ontologyGraphCID: 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenosa77y4',
        soulHash: 'cafebabe'.repeat(8),
        reconstructionSeam: 7,
      };

      const result = await createCheckpoint(agent, { signed: true }, null, metadata);

      // Verify signature is valid for the checkpoint with ontology fields
      const isValid = await verifyCheckpoint(result.checkpoint, agent.kel);
      expect(isValid).toBe(true);
    });

    it('existing checkpoints without ontology fields remain valid', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { legacy: true }, null, BASE_METADATA);

      // Verify old-style checkpoint is still valid
      const isValid = await verifyCheckpoint(result.checkpoint, agent.kel);
      expect(isValid).toBe(true);

      // No ontology fields present
      expect(result.checkpoint.metadata.ontologyGraphCID).toBeUndefined();
      expect(result.checkpoint.metadata.soulHash).toBeUndefined();
      expect(result.checkpoint.metadata.reconstructionSeam).toBeUndefined();
    });
  });
});
