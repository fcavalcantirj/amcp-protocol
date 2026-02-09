/**
 * AMCP Core Types
 * 
 * Type definitions for agent memory checkpointing protocol.
 */

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
} from './work-in-progress.js';
