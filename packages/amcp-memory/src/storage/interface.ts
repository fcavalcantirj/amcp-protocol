/**
 * StorageBackend Interface
 * 
 * Implements Dependency Inversion Principle (SOLID):
 * High-level modules depend on abstractions, not concretions.
 * 
 * Content-Addressed Storage pattern (IPFS/IPLD):
 * Data is addressed by its cryptographic hash (CID), not location.
 * Same data → same CID across ALL backends (guaranteed).
 * 
 * Repository Pattern (Fowler):
 * Collection-like interface for domain objects.
 * 
 * @research
 * - SOLID Principles (Martin 2000)
 * - Content-Addressed Storage (Benet/IPFS 2014)
 * - Repository Pattern (Fowler 2002)
 */

import type { CID } from '../cid.js';

/**
 * Storage backend for content-addressed checkpoint data.
 * 
 * Implementations MUST satisfy:
 * 1. CID determinism: same data → same CID (content-addressed)
 * 2. Integrity: get(put(data)) === data
 * 3. Idempotence: put(data) multiple times is safe
 * 
 * @principle Depend on abstractions, not concretions
 */
export interface StorageBackend {
  /** Backend identifier for logging/debugging */
  readonly name: string;
  
  /**
   * Store data and return its content identifier (CID)
   * 
   * @param data - Raw bytes to store
   * @returns Promise resolving to CID of stored content
   * @throws StorageError if write fails
   */
  put(data: Uint8Array): Promise<CID>;
  
  /**
   * Retrieve data by content identifier
   * 
   * @param cid - Content identifier of data to retrieve
   * @returns Promise resolving to raw bytes
   * @throws NotFoundError if CID doesn't exist
   * @throws StorageError if read fails
   */
  get(cid: CID): Promise<Uint8Array>;
  
  /**
   * List all stored content identifiers
   * 
   * @returns Promise resolving to array of CIDs
   * @throws StorageError if listing fails
   */
  list(): Promise<CID[]>;
  
  /**
   * Delete content by CID (optional)
   * 
   * Not all backends support deletion (e.g., immutable IPFS).
   * Check hasDelete before calling.
   * 
   * @param cid - Content identifier to delete
   * @throws NotFoundError if CID doesn't exist
   * @throws UnsupportedError if backend doesn't support deletion
   */
  delete?(cid: CID): Promise<void>;
  
  /**
   * Check if this backend supports deletion
   */
  readonly hasDelete: boolean;
  
  /**
   * Check if content exists without retrieving it
   * 
   * @param cid - Content identifier to check
   * @returns Promise resolving to true if exists
   */
  has?(cid: CID): Promise<boolean>;
}

/**
 * Configuration for storage backends
 */
export interface StorageConfig {
  /** Base path for filesystem backend */
  basePath?: string;
  /** IPFS gateway URLs for IPFS backend */
  gateways?: string[];
  /** Git remote URL for git backend */
  remoteUrl?: string;
  /** Git branch for git backend */
  branch?: string;
  /** Optional Pinata JWT for pinning */
  pinataJwt?: string;
}

/**
 * Base storage error
 */
export class StorageError extends Error {
  constructor(
    message: string,
    public readonly backend: string,
    public readonly cause?: Error
  ) {
    super(`[${backend}] ${message}`);
    this.name = 'StorageError';
  }
}

/**
 * Content not found error
 */
export class NotFoundError extends StorageError {
  constructor(cid: CID, backend: string) {
    super(`Content not found: ${cid}`, backend);
    this.name = 'NotFoundError';
  }
}

/**
 * Operation not supported error
 */
export class UnsupportedError extends StorageError {
  constructor(operation: string, backend: string) {
    super(`Operation not supported: ${operation}`, backend);
    this.name = 'UnsupportedError';
  }
}

/**
 * Type guard to check if a backend supports deletion
 */
export function supportsDelete(backend: StorageBackend): backend is StorageBackend & { delete: (cid: CID) => Promise<void> } {
  return backend.hasDelete && typeof backend.delete === 'function';
}

/**
 * Type guard to check if a backend supports has() check
 */
export function supportsHas(backend: StorageBackend): backend is StorageBackend & { has: (cid: CID) => Promise<boolean> } {
  return typeof backend.has === 'function';
}
