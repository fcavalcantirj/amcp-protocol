/**
 * Storage Backend Exports
 * 
 * All backends implement the StorageBackend interface,
 * ensuring they are truly interchangeable.
 * 
 * @principle Depend on abstractions, not concretions (SOLID)
 * @principle Same data → same CID (Content-Addressed Storage)
 */

// Interface and types
export {
  type StorageBackend,
  type StorageConfig,
  StorageError,
  NotFoundError,
  UnsupportedError,
  supportsDelete,
  supportsHas
} from './interface.js';

// Filesystem backend
export {
  FilesystemBackend,
  createFilesystemBackend
} from './filesystem.js';

// IPFS backend
export {
  IPFSBackend,
  createIPFSBackend
} from './ipfs.js';

// Git backend
export {
  GitBackend,
  createGitBackend
} from './git.js';
