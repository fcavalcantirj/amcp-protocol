/**
 * Checkpoint PinningProvider integration tests
 *
 * Verifies that createCheckpoint() can accept an optional PinningProvider
 * and correctly delegates pinning, while remaining backward compatible
 * when no provider is given.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@amcp/core';
import { type PinningProvider, type PinResult, PinStatus } from '@amcp/core';
import { createCheckpoint, type CheckpointMetadata } from '../src/checkpoint.js';

/**
 * In-memory PinningProvider for testing — real implementation, not a mock.
 * Stores pinned CIDs in a Map for later inspection.
 */
class MemoryPinProvider implements PinningProvider {
  readonly name = 'memory-test';
  readonly pins = new Map<string, { name?: string; status: PinStatus }>();

  async pin(cid: string, name?: string): Promise<PinResult> {
    this.pins.set(cid, { name, status: PinStatus.Pinned });
    return { cid, requestId: `req-${cid.slice(0, 8)}`, status: PinStatus.Pinned };
  }

  async unpin(cid: string): Promise<void> {
    this.pins.delete(cid);
  }

  async status(cid: string): Promise<PinStatus> {
    return this.pins.has(cid) ? PinStatus.Pinned : PinStatus.Failed;
  }
}

const TEST_METADATA: CheckpointMetadata = {
  platform: 'test',
  version: '1.0.0',
  sessionCount: 1,
};

describe('createCheckpoint with PinningProvider', () => {
  it('creates checkpoint without provider (backward compatible)', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    const content = { memories: ['hello world'] };

    const result = await createCheckpoint(agent, content, null, TEST_METADATA);

    expect(result.checkpoint).toBeDefined();
    expect(result.checkpoint.aid).toBe(agent.aid);
    expect(result.checkpoint.cid).toBeTruthy();
    expect(result.checkpoint.signature).toBeTruthy();
    expect(result.contentCid).toBeTruthy();
    // No provider used
    expect(result.providerUsed).toBeUndefined();
  });

  it('creates checkpoint with PinningProvider', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    const provider = new MemoryPinProvider();
    const content = { memories: ['pinned memory'] };

    const result = await createCheckpoint(agent, content, null, TEST_METADATA, {
      pinningProvider: provider,
    });

    expect(result.checkpoint).toBeDefined();
    expect(result.checkpoint.aid).toBe(agent.aid);
    expect(result.providerUsed).toBe('memory-test');
  });

  it('pins the content CID via the provider', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    const provider = new MemoryPinProvider();
    const content = { memories: ['important data'] };

    const result = await createCheckpoint(agent, content, null, TEST_METADATA, {
      pinningProvider: provider,
    });

    // Verify the provider was called with the content CID
    expect(provider.pins.has(result.contentCid)).toBe(true);
  });

  it('includes provider name in providerUsed field', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    const provider = new MemoryPinProvider();
    const content = { data: 'test' };

    const result = await createCheckpoint(agent, content, null, TEST_METADATA, {
      pinningProvider: provider,
    });

    expect(result.providerUsed).toBe('memory-test');
  });

  it('checkpoint signature is valid regardless of provider', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    const provider = new MemoryPinProvider();
    const content = { data: 'signed content' };

    const withProvider = await createCheckpoint(agent, content, null, TEST_METADATA, {
      pinningProvider: provider,
    });
    const withoutProvider = await createCheckpoint(agent, content, null, TEST_METADATA);

    // Both should have valid signatures
    expect(withProvider.checkpoint.signature).toBeTruthy();
    expect(withoutProvider.checkpoint.signature).toBeTruthy();
    // Content CIDs should match (same content)
    expect(withProvider.contentCid).toBe(withoutProvider.contentCid);
  });

  it('works with prior checkpoint CID', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    const provider = new MemoryPinProvider();

    const first = await createCheckpoint(agent, { step: 1 }, null, TEST_METADATA, {
      pinningProvider: provider,
    });
    const second = await createCheckpoint(agent, { step: 2 }, first.contentCid, TEST_METADATA, {
      pinningProvider: provider,
    });

    expect(second.checkpoint.prior).toBe(first.contentCid);
    expect(provider.pins.size).toBe(2);
  });
});
