/**
 * Storage Backend Tests
 * 
 * Verifies:
 * 1. Same data → same CID across backends (content-addressed)
 * 2. Backends are truly interchangeable
 * 3. CRUD operations work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  type StorageBackend,
  FilesystemBackend,
  createFilesystemBackend,
  IPFSBackend,
  NotFoundError,
  supportsDelete,
  supportsHas
} from '../src/storage/index.js';
import { computeCID } from '../src/cid.js';

// Test data
const TEST_DATA_1 = new TextEncoder().encode('Hello, AMCP Protocol!');
const TEST_DATA_2 = new TextEncoder().encode('Different content for testing');
const TEST_DATA_BINARY = new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);

// Temp directory for tests
let testDir: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `amcp-storage-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe('FilesystemBackend', () => {
  let backend: FilesystemBackend;

  beforeEach(async () => {
    backend = await createFilesystemBackend(join(testDir, 'fs-backend'));
  });

  it('should put and get data', async () => {
    const cid = await backend.put(TEST_DATA_1);
    const retrieved = await backend.get(cid);
    
    expect(retrieved).toEqual(TEST_DATA_1);
  });

  it('should return correct CID (content-addressed)', async () => {
    const cid = await backend.put(TEST_DATA_1);
    const expectedCid = computeCID(TEST_DATA_1);
    
    expect(cid).toBe(expectedCid);
  });

  it('should handle binary data', async () => {
    const cid = await backend.put(TEST_DATA_BINARY);
    const retrieved = await backend.get(cid);
    
    expect(retrieved).toEqual(TEST_DATA_BINARY);
  });

  it('should list stored CIDs', async () => {
    const cid1 = await backend.put(TEST_DATA_1);
    const cid2 = await backend.put(TEST_DATA_2);
    
    const list = await backend.list();
    
    expect(list).toContain(cid1);
    expect(list).toContain(cid2);
    expect(list.length).toBe(2);
  });

  it('should delete content', async () => {
    const cid = await backend.put(TEST_DATA_1);
    
    // Verify it exists
    const exists = await backend.has(cid);
    expect(exists).toBe(true);
    
    // Delete it
    await backend.delete(cid);
    
    // Verify it's gone
    const existsAfter = await backend.has(cid);
    expect(existsAfter).toBe(false);
  });

  it('should throw NotFoundError for missing CID', async () => {
    const fakeCid = computeCID(new TextEncoder().encode('nonexistent'));
    
    await expect(backend.get(fakeCid)).rejects.toThrow(NotFoundError);
  });

  it('should be idempotent (put same data multiple times)', async () => {
    const cid1 = await backend.put(TEST_DATA_1);
    const cid2 = await backend.put(TEST_DATA_1);
    
    expect(cid1).toBe(cid2);
    
    // Should only have one entry
    const list = await backend.list();
    expect(list.filter(c => c === cid1).length).toBe(1);
  });

  it('should support has() check', async () => {
    const cid = await backend.put(TEST_DATA_1);
    
    expect(supportsHas(backend)).toBe(true);
    expect(await backend.has!(cid)).toBe(true);
    
    const fakeCid = computeCID(new TextEncoder().encode('fake'));
    expect(await backend.has!(fakeCid)).toBe(false);
  });

  it('should support delete', () => {
    expect(supportsDelete(backend)).toBe(true);
    expect(backend.hasDelete).toBe(true);
  });
});

describe('IPFSBackend', () => {
  let backend: IPFSBackend;

  beforeEach(() => {
    // Create without Pinata JWT (read-only mode)
    backend = new IPFSBackend();
  });

  it('should compute correct CID (matches filesystem)', async () => {
    const cid = await backend.put(TEST_DATA_1);
    const expectedCid = computeCID(TEST_DATA_1);
    
    expect(cid).toBe(expectedCid);
  });

  it('should not support delete (immutable)', () => {
    expect(backend.hasDelete).toBe(false);
    expect(supportsDelete(backend)).toBe(false);
  });

  it('should track pinned CIDs in list', async () => {
    // Without Pinata JWT, just tracks locally
    await backend.put(TEST_DATA_1);
    const cid2 = await backend.put(TEST_DATA_2);
    
    const list = await backend.list();
    expect(list).toContain(cid2);
  });
});

describe('CID Consistency Across Backends', () => {
  it('should produce same CID for same data across backends', async () => {
    const fsBackend = await createFilesystemBackend(join(testDir, 'fs'));
    const ipfsBackend = new IPFSBackend();
    
    const fsCid = await fsBackend.put(TEST_DATA_1);
    const ipfsCid = await ipfsBackend.put(TEST_DATA_1);
    const directCid = computeCID(TEST_DATA_1);
    
    expect(fsCid).toBe(directCid);
    expect(ipfsCid).toBe(directCid);
    expect(fsCid).toBe(ipfsCid);
  });

  it('should work with binary data', async () => {
    const fsBackend = await createFilesystemBackend(join(testDir, 'fs-bin'));
    const ipfsBackend = new IPFSBackend();
    
    const fsCid = await fsBackend.put(TEST_DATA_BINARY);
    const ipfsCid = await ipfsBackend.put(TEST_DATA_BINARY);
    
    expect(fsCid).toBe(ipfsCid);
  });
});

describe('Backend Interchangeability', () => {
  it('should allow using different backends interchangeably', async () => {
    // This demonstrates the Repository Pattern - backends are interchangeable
    async function storeData(backend: StorageBackend, data: Uint8Array): Promise<string> {
      return backend.put(data);
    }
    
    async function retrieveData(backend: StorageBackend, cid: string): Promise<Uint8Array> {
      return backend.get(cid);
    }
    
    const backend1 = await createFilesystemBackend(join(testDir, 'backend1'));
    const backend2 = await createFilesystemBackend(join(testDir, 'backend2'));
    
    // Store with backend1
    const cid = await storeData(backend1, TEST_DATA_1);
    
    // Store same data with backend2
    const cid2 = await storeData(backend2, TEST_DATA_1);
    
    // CIDs match (content-addressed)
    expect(cid).toBe(cid2);
    
    // Can retrieve from either
    const data1 = await retrieveData(backend1, cid);
    const data2 = await retrieveData(backend2, cid2);
    
    expect(data1).toEqual(data2);
  });

  it('should support type-safe deletion check', async () => {
    const fsBackend = await createFilesystemBackend(join(testDir, 'fs-del'));
    const ipfsBackend = new IPFSBackend();
    
    // Type-safe way to check and use delete
    if (supportsDelete(fsBackend)) {
      const cid = await fsBackend.put(TEST_DATA_1);
      await fsBackend.delete(cid); // TypeScript knows this is valid
    }
    
    if (supportsDelete(ipfsBackend)) {
      // This block won't execute - IPFS doesn't support delete
      throw new Error('IPFS should not support delete');
    }
  });
});

describe('Edge Cases', () => {
  it('should handle empty data', async () => {
    const backend = await createFilesystemBackend(join(testDir, 'empty'));
    const emptyData = new Uint8Array(0);
    
    const cid = await backend.put(emptyData);
    const retrieved = await backend.get(cid);
    
    expect(retrieved.length).toBe(0);
  });

  it('should handle large data', async () => {
    const backend = await createFilesystemBackend(join(testDir, 'large'));
    // 1MB of random-ish data
    const largeData = new Uint8Array(1024 * 1024);
    for (let i = 0; i < largeData.length; i++) {
      largeData[i] = i % 256;
    }
    
    const cid = await backend.put(largeData);
    const retrieved = await backend.get(cid);
    
    expect(retrieved).toEqual(largeData);
  });
});
