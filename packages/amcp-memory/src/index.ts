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
