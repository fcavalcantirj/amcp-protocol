/**
 * Filesystem Storage Backend
 * 
 * Stores checkpoints as local files, named by CID.
 * Simple, reliable, works offline.
 * 
 * Directory structure:
 *   {basePath}/
 *     {cid1}.bin
 *     {cid2}.bin
 *     ...
 * 
 * @research Repository Pattern (Fowler 2002)
 */

import { mkdir, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { computeCID, type CID } from '../cid.js';
import { 
  type StorageBackend, 
  StorageError, 
  NotFoundError 
} from './interface.js';

const EXTENSION = '.bin';

/**
 * Filesystem-based storage backend
 * 
 * @example
 * ```ts
 * const backend = new FilesystemBackend('./checkpoints');
 * await backend.init();
 * const cid = await backend.put(data);
 * const retrieved = await backend.get(cid);
 * ```
 */
export class FilesystemBackend implements StorageBackend {
  readonly name = 'filesystem';
  readonly hasDelete = true;
  private initialized = false;
  
  constructor(private readonly basePath: string) {}
  
  /**
   * Initialize storage directory
   * Must be called before using the backend
   */
  async init(): Promise<void> {
    try {
      await mkdir(this.basePath, { recursive: true });
      this.initialized = true;
    } catch (err) {
      throw new StorageError(
        `Failed to create storage directory: ${this.basePath}`,
        this.name,
        err as Error
      );
    }
  }
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new StorageError(
        'Backend not initialized. Call init() first.',
        this.name
      );
    }
  }
  
  private cidToPath(cid: CID): string {
    return join(this.basePath, `${cid}${EXTENSION}`);
  }
  
  private pathToCid(filename: string): CID | null {
    if (filename.endsWith(EXTENSION)) {
      return filename.slice(0, -EXTENSION.length);
    }
    return null;
  }
  
  async put(data: Uint8Array): Promise<CID> {
    this.ensureInitialized();
    
    // Compute CID first - content addressing
    const cid = computeCID(data);
    const filepath = this.cidToPath(cid);
    
    try {
      // Idempotent: writing same content is safe
      await writeFile(filepath, data);
      return cid;
    } catch (err) {
      throw new StorageError(
        `Failed to write: ${filepath}`,
        this.name,
        err as Error
      );
    }
  }
  
  async get(cid: CID): Promise<Uint8Array> {
    this.ensureInitialized();
    
    const filepath = this.cidToPath(cid);
    
    try {
      const data = await readFile(filepath);
      return new Uint8Array(data);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError(cid, this.name);
      }
      throw new StorageError(
        `Failed to read: ${filepath}`,
        this.name,
        err as Error
      );
    }
  }
  
  async list(): Promise<CID[]> {
    this.ensureInitialized();
    
    try {
      const files = await readdir(this.basePath);
      const cids: CID[] = [];
      
      for (const file of files) {
        const cid = this.pathToCid(file);
        if (cid) {
          cids.push(cid);
        }
      }
      
      return cids;
    } catch (err) {
      throw new StorageError(
        `Failed to list: ${this.basePath}`,
        this.name,
        err as Error
      );
    }
  }
  
  async delete(cid: CID): Promise<void> {
    this.ensureInitialized();
    
    const filepath = this.cidToPath(cid);
    
    try {
      await unlink(filepath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundError(cid, this.name);
      }
      throw new StorageError(
        `Failed to delete: ${filepath}`,
        this.name,
        err as Error
      );
    }
  }
  
  async has(cid: CID): Promise<boolean> {
    this.ensureInitialized();
    
    const filepath = this.cidToPath(cid);
    
    try {
      await access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Create and initialize a filesystem backend
 * 
 * @param basePath - Directory to store checkpoints
 * @returns Initialized FilesystemBackend
 */
export async function createFilesystemBackend(basePath: string): Promise<FilesystemBackend> {
  const backend = new FilesystemBackend(basePath);
  await backend.init();
  return backend;
}
