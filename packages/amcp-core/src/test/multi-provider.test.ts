/**
 * MultiProvider tests
 *
 * Verifies multi-provider pinning for redundancy: parallel pin to
 * multiple services, requireAll vs requireOne mode, partial failure
 * handling, and result tracking.
 */

import { describe, it, expect } from 'vitest';
import {
  type PinningProvider,
  type PinResult,
  PinStatus,
} from '../pinning.js';
import {
  MultiProvider,
  type MultiPinResult,
} from '../multi-provider.js';

/**
 * In-memory PinningProvider for testing — real implementation.
 */
class MemoryProvider implements PinningProvider {
  readonly name: string;
  readonly pins = new Map<string, PinStatus>();

  constructor(name: string) {
    this.name = name;
  }

  async pin(cid: string, name?: string): Promise<PinResult> {
    this.pins.set(cid, PinStatus.Pinned);
    return { cid, requestId: `req-${this.name}-${cid.slice(0, 8)}`, status: PinStatus.Pinned };
  }

  async unpin(cid: string): Promise<void> {
    this.pins.delete(cid);
  }

  async status(cid: string): Promise<PinStatus> {
    return this.pins.has(cid) ? PinStatus.Pinned : PinStatus.Failed;
  }
}

/**
 * Provider that always fails — for testing partial failure.
 */
class FailingProvider implements PinningProvider {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async pin(): Promise<PinResult> {
    throw new Error(`${this.name} pin failed`);
  }

  async unpin(): Promise<void> {
    throw new Error(`${this.name} unpin failed`);
  }

  async status(): Promise<PinStatus> {
    return PinStatus.Failed;
  }
}

describe('MultiProvider', () => {
  it('implements PinningProvider interface', () => {
    const providers = [new MemoryProvider('a'), new MemoryProvider('b')];
    const multi = new MultiProvider(providers);

    expect(multi.name).toBe('multi');
    expect(typeof multi.pin).toBe('function');
    expect(typeof multi.unpin).toBe('function');
    expect(typeof multi.status).toBe('function');
  });

  it('accepts PinningProvider[] in constructor', () => {
    const providers: PinningProvider[] = [
      new MemoryProvider('pinata'),
      new MemoryProvider('solvr'),
    ];
    const multi = new MultiProvider(providers);

    expect(multi).toBeDefined();
  });

  describe('pin() — requireOne mode (default)', () => {
    it('pins to all providers in parallel, returns first success', async () => {
      const providerA = new MemoryProvider('a');
      const providerB = new MemoryProvider('b');
      const multi = new MultiProvider([providerA, providerB]);

      const result = await multi.pin('bafkrei123', 'test-pin');

      expect(result.cid).toBe('bafkrei123');
      expect(result.status).toBe(PinStatus.Pinned);
      // Both providers should have been called
      expect(providerA.pins.has('bafkrei123')).toBe(true);
      expect(providerB.pins.has('bafkrei123')).toBe(true);
    });

    it('succeeds if at least one provider succeeds', async () => {
      const goodProvider = new MemoryProvider('good');
      const badProvider = new FailingProvider('bad');
      const multi = new MultiProvider([goodProvider, badProvider]);

      const result = await multi.pin('bafkrei456', 'test-pin');

      expect(result.status).toBe(PinStatus.Pinned);
      expect(goodProvider.pins.has('bafkrei456')).toBe(true);
    });

    it('fails if all providers fail', async () => {
      const multi = new MultiProvider([
        new FailingProvider('bad1'),
        new FailingProvider('bad2'),
      ]);

      await expect(multi.pin('bafkrei789')).rejects.toThrow();
    });
  });

  describe('pin() — requireAll mode', () => {
    it('succeeds when all providers succeed', async () => {
      const providerA = new MemoryProvider('a');
      const providerB = new MemoryProvider('b');
      const multi = new MultiProvider([providerA, providerB], { requireAll: true });

      const result = await multi.pin('bafkrei123');

      expect(result.status).toBe(PinStatus.Pinned);
    });

    it('fails if any provider fails', async () => {
      const multi = new MultiProvider(
        [new MemoryProvider('good'), new FailingProvider('bad')],
        { requireAll: true }
      );

      await expect(multi.pin('bafkrei456')).rejects.toThrow();
    });
  });

  describe('result tracking', () => {
    it('tracks individual provider results via pinWithDetails()', async () => {
      const providerA = new MemoryProvider('a');
      const providerB = new MemoryProvider('b');
      const multi = new MultiProvider([providerA, providerB]);

      const result: MultiPinResult = await multi.pinWithDetails('bafkrei123', 'test');

      expect(result.cid).toBe('bafkrei123');
      expect(result.providerResults).toHaveLength(2);
      expect(result.providerResults.every(r => r.success)).toBe(true);
      expect(result.providerResults.map(r => r.provider)).toContain('a');
      expect(result.providerResults.map(r => r.provider)).toContain('b');
    });

    it('tracks partial failure in provider results', async () => {
      const good = new MemoryProvider('good');
      const bad = new FailingProvider('bad');
      const multi = new MultiProvider([good, bad]);

      const result = await multi.pinWithDetails('bafkrei456');

      const goodResult = result.providerResults.find(r => r.provider === 'good');
      const badResult = result.providerResults.find(r => r.provider === 'bad');

      expect(goodResult?.success).toBe(true);
      expect(goodResult?.cid).toBe('bafkrei456');
      expect(badResult?.success).toBe(false);
      expect(badResult?.error).toBeTruthy();
    });
  });

  describe('unpin()', () => {
    it('unpins from all providers', async () => {
      const providerA = new MemoryProvider('a');
      const providerB = new MemoryProvider('b');
      const multi = new MultiProvider([providerA, providerB]);

      await multi.pin('bafkrei123');
      expect(providerA.pins.has('bafkrei123')).toBe(true);
      expect(providerB.pins.has('bafkrei123')).toBe(true);

      await multi.unpin('bafkrei123');
      expect(providerA.pins.has('bafkrei123')).toBe(false);
      expect(providerB.pins.has('bafkrei123')).toBe(false);
    });
  });

  describe('status()', () => {
    it('returns Pinned if any provider reports Pinned', async () => {
      const providerA = new MemoryProvider('a');
      const providerB = new MemoryProvider('b');
      const multi = new MultiProvider([providerA, providerB]);

      await providerA.pin('bafkrei123');
      // providerB doesn't have it

      const result = await multi.status('bafkrei123');
      expect(result).toBe(PinStatus.Pinned);
    });

    it('returns Failed if no provider has the CID', async () => {
      const multi = new MultiProvider([
        new MemoryProvider('a'),
        new MemoryProvider('b'),
      ]);

      const result = await multi.status('nonexistent');
      expect(result).toBe(PinStatus.Failed);
    });
  });
});
