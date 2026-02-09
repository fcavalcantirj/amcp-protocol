/**
 * @amcp/memory - Content-addressed memory checkpoints for AI agents
 * 
 * Provides IPLD-based memory persistence with agent signatures.
 * Each checkpoint is content-addressed (CID) and signed by the agent.
 */

export { 
  createCheckpoint, 
  verifyCheckpoint,
  type MemoryCheckpoint,
  type CheckpointMetadata 
} from './checkpoint.js';
export { computeCID, type CID } from './cid.js';
export { 
  createMemoryChain, 
  appendToChain, 
  verifyChain,
  type MemoryChain 
} from './chain.js';

// Storage backends
export {
  type StorageBackend,
  type StorageConfig,
  StorageError,
  NotFoundError,
  UnsupportedError,
  supportsDelete,
  supportsHas,
  FilesystemBackend,
  createFilesystemBackend,
  IPFSBackend,
  createIPFSBackend,
  GitBackend,
  createGitBackend
} from './storage/index.js';
export {
  ed25519ToX25519,
  ed25519PubToX25519,
  encryptSecrets,
  decryptSecrets,
  serializeEncryptedBlob,
  deserializeEncryptedBlob,
  type EncryptedBlob,
  type X25519Keypair
} from './encryption.js';
