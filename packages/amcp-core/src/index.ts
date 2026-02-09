/**
 * @amcp/core - KERI-lite cryptographic identity for AI agents
 * 
 * Provides self-certifying identifiers (AIDs) and key event logs (KEL)
 * for agent identity that is portable and verifiable.
 */

export { createAgent, loadAgent, type Agent, type AgentConfig } from './agent.js';
export { 
  type AID, 
  type KeyEvent, 
  type KeyEventLog,
  type InceptionEvent,
  type RotationEvent,
  createInceptionEvent,
  createRotationEvent,
  verifyEvent,
  verifyKEL
} from './kel.js';
export { 
  generateKeypair, 
  sign, 
  verify,
  type Keypair 
} from './crypto.js';
export { aidFromPublicKey, publicKeyFromAid } from './aid.js';
