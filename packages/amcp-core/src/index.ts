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

// Types for memory checkpointing
export {
  type WorkInProgress,
  type Approach,
  type ApproachStatus,
  type TaskStatus,
  type StartTaskOptions,
  type UpdateProgressOptions,
  type CompletedTask,
  startTask,
  updateProgress,
  completeTask,
  isBlocked,
  getCurrentApproach,
  getFailedApproachCount,
} from './types/index.js';

// Schema types for agent memory and state
export {
  type SubjectiveState,
  type SubjectiveStateAssessment,
  type EngagementLevel,
  type Momentum,
  type Alignment,
  assessSubjectiveState,
  createSubjectiveStateAt,
  isProductiveState,
  needsIntervention
} from './types/index.js';

// Types - research-backed schemas for agent memory
export {
  type MemoryDurability,
  type MemoryPriority,
  type Timestamp,
  type MemoryImportance,
  DEFAULT_IMPORTANCE,
  NEVER_FORGET_IMPORTANCE,
  markImportant,
  inferImportance,
  compareImportance,
  filterByDurability,
  getHumanMarked,
} from './types/index.js';

// Type schemas
export {
  type EntityType,
  type RapportLevel,
  type RelationshipPreferences,
  type RelationshipHistory,
  type TrustCalibration,
  type RelationshipContext,
  type RelationshipUpdate,
  createRelationship,
  updateRelationship,
  suggestRapportUpgrade,
  getDunbarLayer
} from './types/index.js';

// Types
export {
  type LocationContext,
  type TemporalContext,
  type CalendarContext,
  type DeviceContext,
  type PrivacyLevel,
  type AmbientContext,
  filterByPrivacy,
  createAmbientContext,
  hasContextData
} from './types/index.js';
