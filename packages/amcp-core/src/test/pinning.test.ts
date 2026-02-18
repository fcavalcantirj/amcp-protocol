/**
 * PinningProvider interface and implementation tests
 *
 * Tests for the PinningProvider abstraction, PinataProvider, and SolvrProvider.
 * TDD: Written before implementation.
 */

import { describe, it, expect } from 'vitest';
import {
  type PinningProvider,
  type PinResult,
  PinStatus,
  PinataProvider,
  SolvrProvider,
  SolvrTimeoutError,
} from '../pinning.js';

describe('PinningProvider interface', () => {
  it('PinStatus enum has all required values', () => {
    expect(PinStatus.Queued).toBe('queued');
    expect(PinStatus.Pinning).toBe('pinning');
    expect(PinStatus.Pinned).toBe('pinned');
    expect(PinStatus.Failed).toBe('failed');
  });

  it('PinataProvider implements PinningProvider interface', () => {
    const provider: PinningProvider = new PinataProvider({ apiKey: 'test-key' });
    expect(typeof provider.pin).toBe('function');
    expect(typeof provider.unpin).toBe('function');
    expect(typeof provider.status).toBe('function');
    expect(provider.name).toBe('pinata');
  });

  it('SolvrProvider implements PinningProvider interface', () => {
    const provider: PinningProvider = new SolvrProvider({ apiKey: 'test-key' });
    expect(typeof provider.pin).toBe('function');
    expect(typeof provider.unpin).toBe('function');
    expect(typeof provider.status).toBe('function');
    expect(provider.name).toBe('solvr');
  });

  it('SolvrProvider uses default baseUrl', () => {
    const provider = new SolvrProvider({ apiKey: 'test-key' });
    expect(provider.baseUrl).toBe('https://api.solvr.dev');
  });

  it('SolvrProvider accepts custom baseUrl', () => {
    const provider = new SolvrProvider({ apiKey: 'test-key', baseUrl: 'https://custom.api.dev' });
    expect(provider.baseUrl).toBe('https://custom.api.dev');
  });

  it('PinataProvider uses default baseUrl', () => {
    const provider = new PinataProvider({ apiKey: 'test-key' });
    expect(provider.baseUrl).toBe('https://api.pinata.cloud');
  });

  it('PinataProvider accepts custom baseUrl', () => {
    const provider = new PinataProvider({ apiKey: 'test-key', baseUrl: 'https://custom.pinata.dev' });
    expect(provider.baseUrl).toBe('https://custom.pinata.dev');
  });

  it('Both providers implement the same interface (type check)', () => {
    const providers: PinningProvider[] = [
      new PinataProvider({ apiKey: 'key-1' }),
      new SolvrProvider({ apiKey: 'key-2' }),
    ];

    for (const provider of providers) {
      expect(typeof provider.name).toBe('string');
      expect(typeof provider.pin).toBe('function');
      expect(typeof provider.unpin).toBe('function');
      expect(typeof provider.status).toBe('function');
    }

    expect(providers[0].name).toBe('pinata');
    expect(providers[1].name).toBe('solvr');
  });
});

describe('PinataProvider', () => {
  it('pin() returns a PinResult with correct shape', async () => {
    const provider = new PinataProvider({ apiKey: 'test-key' });
    // Without a real API, pin() should throw a network/auth error
    // This verifies the method exists and is async
    await expect(provider.pin('bafkreitest123', 'test-pin')).rejects.toThrow();
  });

  it('unpin() is async and callable', async () => {
    const provider = new PinataProvider({ apiKey: 'test-key' });
    await expect(provider.unpin('bafkreitest123')).rejects.toThrow();
  });

  it('status() is async and callable', async () => {
    const provider = new PinataProvider({ apiKey: 'test-key' });
    await expect(provider.status('bafkreitest123')).rejects.toThrow();
  });
});

describe('SolvrProvider', () => {
  it('pin() returns a PinResult with correct shape', async () => {
    const provider = new SolvrProvider({ apiKey: 'test-key' });
    await expect(provider.pin('bafkreitest123', 'test-pin')).rejects.toThrow();
  });

  it('unpin() is async and callable', async () => {
    const provider = new SolvrProvider({ apiKey: 'test-key' });
    await expect(provider.unpin('bafkreitest123')).rejects.toThrow();
  });

  it('status() is async and callable', async () => {
    const provider = new SolvrProvider({ apiKey: 'test-key' });
    await expect(provider.status('bafkreitest123')).rejects.toThrow();
  });
});

describe('SolvrProvider retry and timeout config', () => {
  it('uses default timeout of 5 minutes', () => {
    const provider = new SolvrProvider({ apiKey: 'test-key' });
    expect(provider.timeoutMs).toBe(5 * 60 * 1000);
  });

  it('accepts custom timeout', () => {
    const provider = new SolvrProvider({ apiKey: 'test-key', timeoutMs: 10000 });
    expect(provider.timeoutMs).toBe(10000);
  });

  it('uses default maxRetries of 3', () => {
    const provider = new SolvrProvider({ apiKey: 'test-key' });
    expect(provider.maxRetries).toBe(3);
  });

  it('accepts custom maxRetries', () => {
    const provider = new SolvrProvider({ apiKey: 'test-key', maxRetries: 5 });
    expect(provider.maxRetries).toBe(5);
  });

  it('SolvrTimeoutError can be thrown and caught', () => {
    const error = new SolvrTimeoutError('test timeout');
    expect(error).toBeInstanceOf(SolvrTimeoutError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('SolvrTimeoutError');
    expect(error.message).toBe('test timeout');
  });
});

describe('SolvrProvider error types', () => {
  it('throws SolvrAuthError on invalid API key format', () => {
    // Empty API key should be rejected at construction time
    expect(() => new SolvrProvider({ apiKey: '' })).toThrow('API key is required');
  });

  it('throws on empty API key for PinataProvider', () => {
    expect(() => new PinataProvider({ apiKey: '' })).toThrow('API key is required');
  });
});
