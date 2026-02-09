/**
 * @amcp/core - KERI-lite cryptographic identity for AI agents
 * 
 * Provides self-certifying identifiers (AIDs) and key event logs (KEL)
 * for agent identity that is portable and verifiable.
 */

export { 
  createAgent, 
  loadAgent, 
  serializeAgent,
  rotateKeys,
  signWithAgent,
  verifyAgentSignature,
  type Agent, 
  type AgentConfig,
  type SerializedAgent
} from './agent.js';
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
  toBase64url,
  fromBase64url,
  type Keypair 
} from './crypto.js';
export { aidFromPublicKey, publicKeyFromAid } from './aid.js';
export {
  generateMnemonic,
  mnemonicToSeed,
  keypairFromMnemonic,
  validateMnemonic,
  strengthToWordCount,
  wordCountToStrength,
  type MnemonicStrength
} from './mnemonic.js';

// Re-export all types from types module
export * from './types/index.js';
