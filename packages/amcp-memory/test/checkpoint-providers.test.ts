/**
 * Checkpoint pinning provider metadata tests
 *
 * Verifies that CheckpointMetadata supports pinningProviders and
 * primaryProvider fields, and that they survive checkpoint creation
 * and JSON roundtrip while maintaining backward compatibility.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@amcp/core';
import { createCheckpoint, verifyCheckpoint, type CheckpointMetadata } from '../src/checkpoint.js';

const BASE_METADATA: CheckpointMetadata = {
  platform: 'test',
  version: '1.0.0',
  sessionCount: 1,
};

describe('CheckpointMetadata pinning provider fields', () => {
  describe('pinningProviders field', () => {
    it('accepts pinningProviders array in metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        pinningProviders: [
          { name: 'pinata', cid: 'bafkrei123', requestId: 'req-001' },
          { name: 'solvr', cid: 'bafkrei123', requestId: 'req-002' },
        ],
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.pinningProviders).toHaveLength(2);
      expect(result.checkpoint.metadata.pinningProviders![0].name).toBe('pinata');
      expect(result.checkpoint.metadata.pinningProviders![1].name).toBe('solvr');
    });

    it('supports provider entry without requestId', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        pinningProviders: [
          { name: 'pinata', cid: 'bafkrei456' },
        ],
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.pinningProviders![0].requestId).toBeUndefined();
      expect(result.checkpoint.metadata.pinningProviders![0].cid).toBe('bafkrei456');
    });

    it('omits pinningProviders when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.pinningProviders).toBeUndefined();
    });
  });

  describe('primaryProvider field', () => {
    it('accepts primaryProvider string in metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        primaryProvider: 'pinata',
      };

      const result = await createCheckpoint(agent, { test: true }, null, metadata);

      expect(result.checkpoint.metadata.primaryProvider).toBe('pinata');
    });

    it('omits primaryProvider when not provided (backward compatible)', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { test: true }, null, BASE_METADATA);

      expect(result.checkpoint.metadata.primaryProvider).toBeUndefined();
    });
  });

  describe('both fields together', () => {
    it('accepts both pinningProviders and primaryProvider', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        pinningProviders: [
          { name: 'pinata', cid: 'bafkrei123', requestId: 'req-pinata' },
          { name: 'solvr', cid: 'bafkrei123', requestId: 'req-solvr' },
        ],
        primaryProvider: 'pinata',
      };

      const result = await createCheckpoint(agent, { data: 'multi-pin' }, null, metadata);

      expect(result.checkpoint.metadata.pinningProviders).toHaveLength(2);
      expect(result.checkpoint.metadata.primaryProvider).toBe('pinata');
    });

    it('survives JSON roundtrip', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        pinningProviders: [
          { name: 'pinata', cid: 'bafkrei789', requestId: 'req-001' },
          { name: 'solvr', cid: 'bafkrei789' },
        ],
        primaryProvider: 'solvr',
      };

      const result = await createCheckpoint(agent, { roundtrip: true }, null, metadata);
      const serialized = JSON.stringify(result.checkpoint);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.metadata.pinningProviders).toHaveLength(2);
      expect(deserialized.metadata.pinningProviders[0].name).toBe('pinata');
      expect(deserialized.metadata.pinningProviders[0].requestId).toBe('req-001');
      expect(deserialized.metadata.pinningProviders[1].name).toBe('solvr');
      expect(deserialized.metadata.pinningProviders[1].requestId).toBeUndefined();
      expect(deserialized.metadata.primaryProvider).toBe('solvr');
    });

    it('signature is valid with provider metadata', async () => {
      const agent = await createAgent({ name: 'TestAgent' });
      const metadata: CheckpointMetadata = {
        ...BASE_METADATA,
        pinningProviders: [
          { name: 'pinata', cid: 'bafkrei123' },
        ],
        primaryProvider: 'pinata',
      };

      const result = await createCheckpoint(agent, { signed: true }, null, metadata);
      const isValid = await verifyCheckpoint(result.checkpoint, agent.kel);

      expect(isValid).toBe(true);
    });

    it('existing checkpoints without provider fields remain valid', async () => {
      const agent = await createAgent({ name: 'TestAgent' });

      const result = await createCheckpoint(agent, { legacy: true }, null, BASE_METADATA);
      const isValid = await verifyCheckpoint(result.checkpoint, agent.kel);

      expect(isValid).toBe(true);
      expect(result.checkpoint.metadata.pinningProviders).toBeUndefined();
      expect(result.checkpoint.metadata.primaryProvider).toBeUndefined();
    });
  });
});
