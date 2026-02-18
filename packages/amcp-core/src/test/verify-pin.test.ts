/**
 * Checkpoint pin verification tests
 *
 * Verifies cross-provider CID availability checking.
 * Uses in-memory providers for testing — no network calls.
 */

import { describe, it, expect } from 'vitest';
import {
  type PinningProvider,
  type PinResult,
  PinStatus,
} from '../pinning.js';
import {
  verifyPinAcrossProviders,
  type PinVerificationResult,
} from '../verify-pin.js';

/**
 * In-memory PinningProvider for testing.
 */
class MemoryProvider implements PinningProvider {
  readonly name: string;
  readonly pins = new Map<string, PinStatus>();

  constructor(name: string) {
    this.name = name;
  }

  async pin(cid: string): Promise<PinResult> {
    this.pins.set(cid, PinStatus.Pinned);
    return { cid, requestId: `req-${cid.slice(0, 8)}`, status: PinStatus.Pinned };
  }

  async unpin(cid: string): Promise<void> {
    this.pins.delete(cid);
  }

  async status(cid: string): Promise<PinStatus> {
    return this.pins.get(cid) ?? PinStatus.Failed;
  }
}

/**
 * Provider that throws on status check — simulates unreachable service.
 */
class UnreachableProvider implements PinningProvider {
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  async pin(): Promise<PinResult> {
    throw new Error('unreachable');
  }

  async unpin(): Promise<void> {
    throw new Error('unreachable');
  }

  async status(): Promise<PinStatus> {
    throw new Error('Service unreachable');
  }
}

describe('verifyPinAcrossProviders', () => {
  it('returns verified=true when all providers report Pinned', async () => {
    const providerA = new MemoryProvider('pinata');
    const providerB = new MemoryProvider('solvr');
    await providerA.pin('bafkrei123');
    await providerB.pin('bafkrei123');

    const result = await verifyPinAcrossProviders('bafkrei123', [providerA, providerB]);

    expect(result.verified).toBe(true);
    expect(result.providers).toHaveLength(2);
    expect(result.providers.every(p => p.available)).toBe(true);
    expect(result.contentMatch).toBe(true);
  });

  it('returns verified=false when no provider has the CID', async () => {
    const providerA = new MemoryProvider('pinata');
    const providerB = new MemoryProvider('solvr');

    const result = await verifyPinAcrossProviders('nonexistent', [providerA, providerB]);

    expect(result.verified).toBe(false);
    expect(result.providers.every(p => !p.available)).toBe(true);
  });

  it('returns verified=true when at least one provider has the CID', async () => {
    const providerA = new MemoryProvider('pinata');
    const providerB = new MemoryProvider('solvr');
    await providerA.pin('bafkrei123');
    // providerB does NOT have it

    const result = await verifyPinAcrossProviders('bafkrei123', [providerA, providerB]);

    expect(result.verified).toBe(true);
    const pinataResult = result.providers.find(p => p.name === 'pinata');
    const solvrResult = result.providers.find(p => p.name === 'solvr');
    expect(pinataResult?.available).toBe(true);
    expect(solvrResult?.available).toBe(false);
  });

  it('contentMatch is true when multiple providers have the same CID', async () => {
    const providerA = new MemoryProvider('pinata');
    const providerB = new MemoryProvider('solvr');
    await providerA.pin('bafkrei123');
    await providerB.pin('bafkrei123');

    const result = await verifyPinAcrossProviders('bafkrei123', [providerA, providerB]);

    expect(result.contentMatch).toBe(true);
  });

  it('contentMatch is false when providers disagree on availability', async () => {
    const providerA = new MemoryProvider('pinata');
    const providerB = new MemoryProvider('solvr');
    await providerA.pin('bafkrei123');
    // providerB doesn't have it — content cannot be cross-verified

    const result = await verifyPinAcrossProviders('bafkrei123', [providerA, providerB]);

    // contentMatch requires all providers to have it for cross-verification
    expect(result.contentMatch).toBe(false);
  });

  it('handles unreachable providers gracefully', async () => {
    const goodProvider = new MemoryProvider('pinata');
    const badProvider = new UnreachableProvider('unreachable');
    await goodProvider.pin('bafkrei123');

    const result = await verifyPinAcrossProviders('bafkrei123', [goodProvider, badProvider]);

    expect(result.verified).toBe(true);
    const goodResult = result.providers.find(p => p.name === 'pinata');
    const badResult = result.providers.find(p => p.name === 'unreachable');
    expect(goodResult?.available).toBe(true);
    expect(badResult?.available).toBe(false);
  });

  it('returns correct PinVerificationResult structure', async () => {
    const provider = new MemoryProvider('test');
    await provider.pin('bafkrei123');

    const result: PinVerificationResult = await verifyPinAcrossProviders('bafkrei123', [provider]);

    expect(typeof result.verified).toBe('boolean');
    expect(Array.isArray(result.providers)).toBe(true);
    expect(typeof result.contentMatch).toBe('boolean');
    expect(result.providers[0]).toHaveProperty('name');
    expect(result.providers[0]).toHaveProperty('available');
  });

  it('works with single provider', async () => {
    const provider = new MemoryProvider('solo');
    await provider.pin('bafkrei123');

    const result = await verifyPinAcrossProviders('bafkrei123', [provider]);

    expect(result.verified).toBe(true);
    expect(result.providers).toHaveLength(1);
    expect(result.contentMatch).toBe(true); // Single provider = content matches itself
  });

  it('works with empty provider list', async () => {
    const result = await verifyPinAcrossProviders('bafkrei123', []);

    expect(result.verified).toBe(false);
    expect(result.providers).toHaveLength(0);
    expect(result.contentMatch).toBe(false);
  });
});
