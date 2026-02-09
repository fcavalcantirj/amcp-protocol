/**
 * AMCP Core Types
 * 
 * Research-backed schema definitions for agent memory and state
 */

// SubjectiveState - Affective Computing (Picard 1997)
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
} from './subjective-state.js';

// MemoryImportance - Levels of Processing (Craik & Lockhart 1972)
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
  getHumanMarked
} from './memory-importance.js';

// RelationshipContext - Social Memory (Dunbar 1998), Theory of Mind (Premack 1978)
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
} from './relationship-context.js';

// AmbientContext - Context-Aware Computing (Dey 2001)
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
} from './ambient-context.js';

// WorkInProgress - Zeigarnik Effect (1927)
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
  getFailedApproachCount
} from './work-in-progress.js';

// CheckpointPolicy - Memory Consolidation (Stickgold 2005), Autosave (Teevan 2011)
export {
  type TriggerLevel,
  type TriggerConfig,
  type ThresholdTriggerConfig,
  type CheckpointPolicy,
  DEFAULT_CHECKPOINT_POLICY,
  AGGRESSIVE_CHECKPOINT_POLICY,
  MINIMAL_CHECKPOINT_POLICY,
  createCheckpointPolicy,
  validateCheckpointPolicy,
  shouldCheckpoint,
  describePolicy
} from './checkpoint-policy.js';
