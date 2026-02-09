/**
 * Git Storage Backend
 * 
 * Stores checkpoints in a git repository.
 * Uses git for transport (push/pull) and history.
 * 
 * Directory structure (in repo):
 *   checkpoints/
 *     {cid1}.bin
 *     {cid2}.bin
 *     manifest.json  (list of checkpoint CIDs with metadata)
 * 
 * @research Repository Pattern (Fowler 2002)
 */

import { mkdir, readFile, writeFile, readdir, unlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { computeCID, type CID } from '../cid.js';
import { 
  type StorageBackend, 
  type StorageConfig,
  StorageError, 
  NotFoundError 
} from './interface.js';

const execFileAsync = promisify(execFile);
const CHECKPOINTS_DIR = 'checkpoints';
const EXTENSION = '.bin';
const MANIFEST_FILE = 'manifest.json';

interface ManifestEntry {
  cid: CID;
  timestamp: string;
  size: number;
}

interface Manifest {
  version: 1;
  entries: ManifestEntry[];
}

/**
 * Git-based storage backend
 * 
 * Stores checkpoints in a git repository for:
 * - Built-in versioning and history
 * - Remote sync via push/pull
 * - Works with GitHub, GitLab, etc.
 * 
 * @example
 * ```ts
 * const backend = new GitBackend({
 *   basePath: './my-agent-repo',
 *   remoteUrl: 'git@github.com:user/agent-memory.git'
 * });
 * await backend.init();
 * const cid = await backend.put(data);
 * await backend.sync(); // Push to remote
 * ```
 */
export class GitBackend implements StorageBackend {
  readonly name = 'git';
  readonly hasDelete = true;
  
  private readonly repoPath: string;
  private readonly checkpointsPath: string;
  private readonly remoteUrl?: string;
  private readonly branch: string;
  private initialized = false;
  
  constructor(config: StorageConfig) {
    if (!config.basePath) {
      throw new Error('GitBackend requires basePath config');
    }
    this.repoPath = config.basePath;
    this.checkpointsPath = join(this.repoPath, CHECKPOINTS_DIR);
    this.remoteUrl = config.remoteUrl;
    this.branch = config.branch ?? 'main';
  }
  
  /**
   * Initialize git repository and checkpoints directory
   */
  async init(): Promise<void> {
    try {
      // Create repo directory
      await mkdir(this.repoPath, { recursive: true });
      
      // Check if already a git repo
      const isRepo = await this.isGitRepo();
      
      if (!isRepo) {
        // Initialize new repo
        await this.git('init');
        
        // Set up remote if provided
        if (this.remoteUrl) {
          await this.git('remote', 'add', 'origin', this.remoteUrl);
        }
      }
      
      // Create checkpoints directory
      await mkdir(this.checkpointsPath, { recursive: true });
      
      // Create manifest if doesn't exist
      const manifestPath = join(this.checkpointsPath, MANIFEST_FILE);
      try {
        await access(manifestPath);
      } catch {
        const manifest: Manifest = { version: 1, entries: [] };
        await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      }
      
      this.initialized = true;
    } catch (err) {
      throw new StorageError(
        `Failed to initialize git repository: ${this.repoPath}`,
        this.name,
        err as Error
      );
    }
  }
  
  private async isGitRepo(): Promise<boolean> {
    try {
      await this.git('rev-parse', '--git-dir');
      return true;
    } catch {
      return false;
    }
  }
  
  private async git(...args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', args, {
        cwd: this.repoPath,
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      return stdout.trim();
    } catch (err) {
      const error = err as Error & { stderr?: string };
      throw new Error(error.stderr || error.message);
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
    return join(this.checkpointsPath, `${cid}${EXTENSION}`);
  }
  
  private async readManifest(): Promise<Manifest> {
    const manifestPath = join(this.checkpointsPath, MANIFEST_FILE);
    try {
      const data = await readFile(manifestPath, 'utf-8');
      return JSON.parse(data) as Manifest;
    } catch {
      return { version: 1, entries: [] };
    }
  }
  
  private async writeManifest(manifest: Manifest): Promise<void> {
    const manifestPath = join(this.checkpointsPath, MANIFEST_FILE);
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }
  
  async put(data: Uint8Array): Promise<CID> {
    this.ensureInitialized();
    
    // Compute CID first - content addressing
    const cid = computeCID(data);
    const filepath = this.cidToPath(cid);
    
    try {
      // Write file
      await writeFile(filepath, data);
      
      // Update manifest
      const manifest = await this.readManifest();
      if (!manifest.entries.find(e => e.cid === cid)) {
        manifest.entries.push({
          cid,
          timestamp: new Date().toISOString(),
          size: data.length
        });
        await this.writeManifest(manifest);
      }
      
      // Stage files
      await this.git('add', filepath);
      await this.git('add', join(this.checkpointsPath, MANIFEST_FILE));
      
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
      const manifest = await this.readManifest();
      return manifest.entries.map(e => e.cid);
    } catch (err) {
      throw new StorageError(
        `Failed to list checkpoints`,
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
      
      // Update manifest
      const manifest = await this.readManifest();
      manifest.entries = manifest.entries.filter(e => e.cid !== cid);
      await this.writeManifest(manifest);
      
      // Stage deletion
      await this.git('add', filepath);
      await this.git('add', join(this.checkpointsPath, MANIFEST_FILE));
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
  
  /**
   * Commit staged changes
   * 
   * @param message - Commit message
   */
  async commit(message: string): Promise<string> {
    this.ensureInitialized();
    
    try {
      const result = await this.git('commit', '-m', message);
      return result;
    } catch (err) {
      // "nothing to commit" is not an error
      const error = err as Error;
      if (error.message.includes('nothing to commit')) {
        return 'nothing to commit';
      }
      throw new StorageError(
        `Failed to commit`,
        this.name,
        error
      );
    }
  }
  
  /**
   * Push to remote
   */
  async push(): Promise<void> {
    this.ensureInitialized();
    
    if (!this.remoteUrl) {
      throw new StorageError('No remote configured', this.name);
    }
    
    try {
      await this.git('push', '-u', 'origin', this.branch);
    } catch (err) {
      throw new StorageError(
        `Failed to push to remote`,
        this.name,
        err as Error
      );
    }
  }
  
  /**
   * Pull from remote
   */
  async pull(): Promise<void> {
    this.ensureInitialized();
    
    if (!this.remoteUrl) {
      throw new StorageError('No remote configured', this.name);
    }
    
    try {
      await this.git('pull', 'origin', this.branch);
    } catch (err) {
      throw new StorageError(
        `Failed to pull from remote`,
        this.name,
        err as Error
      );
    }
  }
  
  /**
   * Convenience: commit and push
   */
  async sync(message: string = 'Update checkpoints'): Promise<void> {
    await this.commit(message);
    if (this.remoteUrl) {
      await this.push();
    }
  }
}

/**
 * Create and initialize a git backend
 * 
 * @param config - Configuration with basePath and optional remoteUrl
 */
export async function createGitBackend(config: StorageConfig): Promise<GitBackend> {
  const backend = new GitBackend(config);
  await backend.init();
  return backend;
}
