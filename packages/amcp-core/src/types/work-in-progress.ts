/**
 * WorkInProgress Schema
 * 
 * Captures in-flight tasks to enable recovery after interruption.
 * 
 * Psychology Research Foundation:
 * - Zeigarnik Effect (1927): Incomplete tasks are remembered better than
 *   complete ones because they create "psychic tension." The mind holds onto
 *   unfinished work until completion provides closure.
 * - Task Switching Costs (Monsell 2003): Switching between tasks incurs
 *   performance costs due to mental reconfiguration time.
 * 
 * For agents: Session end or crash = forced task switch. This schema
 * reduces "reload cost" by capturing:
 * - What task was being worked on
 * - What approaches have been tried (and their status)
 * - What blockers exist
 * - What the next step should be
 * - Related memories for context reconstruction
 * 
 * @see https://en.wikipedia.org/wiki/Zeigarnik_effect
 */

/** Status of an individual approach to solving a task */
export type ApproachStatus = 'trying' | 'failed' | 'succeeded';

/** An approach being tried for a task */
export interface Approach {
  /** Description of the approach being attempted */
  description: string;
  /** Current status of this approach */
  status: ApproachStatus;
  /** Optional notes about what was learned or why it failed/succeeded */
  notes?: string;
}

/** Status of a work-in-progress task */
export type TaskStatus = 'planning' | 'in_progress' | 'blocked' | 'reviewing';

/**
 * WorkInProgress - captures a task mid-stream
 * 
 * The Zeigarnik Effect tells us incomplete tasks persist in memory.
 * This schema makes that persistence explicit and recoverable.
 */
export interface WorkInProgress {
  /** Unique identifier for this task */
  taskId: string;
  
  /** Human-readable description of what's being worked on */
  description: string;
  
  /** Current status of the task */
  status: TaskStatus;
  
  /** When work on this task began (ISO 8601) */
  startedAt: string;
  
  /** Approaches tried for this task (ordered, most recent last) */
  approaches: Approach[];
  
  /** Current blockers preventing progress (if status is 'blocked') */
  blockers?: string[];
  
  /** The immediate next step to take when resuming */
  nextStep?: string;
  
  /** CIDs of related memories for context reconstruction */
  relatedMemories: string[];
}

/**
 * Options for starting a new task
 */
export interface StartTaskOptions {
  taskId?: string;
  description: string;
  initialApproach?: string;
  relatedMemories?: string[];
}

/**
 * Options for updating task progress
 */
export interface UpdateProgressOptions {
  /** New status for the task */
  status?: TaskStatus;
  /** New approach to add */
  newApproach?: Omit<Approach, 'status'> & { status?: ApproachStatus };
  /** Update status of existing approach (by description match) */
  updateApproach?: { description: string; status: ApproachStatus; notes?: string };
  /** New blockers to set */
  blockers?: string[];
  /** New next step */
  nextStep?: string;
  /** Additional related memories */
  addRelatedMemories?: string[];
}

/**
 * Generate a simple task ID (timestamp-based with random suffix)
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `task_${timestamp}_${random}`;
}

/**
 * Start a new task
 * 
 * Creates a WorkInProgress entry in 'planning' status.
 * If an initial approach is provided, starts in 'in_progress'.
 * 
 * @example
 * ```ts
 * const wip = startTask({
 *   description: 'Implement user authentication',
 *   initialApproach: 'Using JWT tokens with refresh rotation'
 * });
 * ```
 */
export function startTask(options: StartTaskOptions): WorkInProgress {
  const hasApproach = !!options.initialApproach;
  
  return {
    taskId: options.taskId ?? generateTaskId(),
    description: options.description,
    status: hasApproach ? 'in_progress' : 'planning',
    startedAt: new Date().toISOString(),
    approaches: hasApproach 
      ? [{ description: options.initialApproach!, status: 'trying' }]
      : [],
    relatedMemories: options.relatedMemories ?? [],
  };
}

/**
 * Update progress on an existing task
 * 
 * Applies updates immutably - returns a new WorkInProgress object.
 * Handles approach status transitions and blocker management.
 * 
 * @example
 * ```ts
 * const updated = updateProgress(wip, {
 *   updateApproach: { 
 *     description: 'Using JWT tokens', 
 *     status: 'succeeded',
 *     notes: 'Works well with 15min access tokens'
 *   },
 *   nextStep: 'Add rate limiting'
 * });
 * ```
 */
export function updateProgress(
  wip: WorkInProgress,
  options: UpdateProgressOptions
): WorkInProgress {
  let approaches = [...wip.approaches];
  
  // Update existing approach status
  if (options.updateApproach) {
    const idx = approaches.findIndex(
      a => a.description === options.updateApproach!.description
    );
    if (idx !== -1) {
      approaches[idx] = {
        ...approaches[idx],
        status: options.updateApproach.status,
        notes: options.updateApproach.notes ?? approaches[idx].notes,
      };
    }
  }
  
  // Add new approach
  if (options.newApproach) {
    approaches.push({
      description: options.newApproach.description,
      status: options.newApproach.status ?? 'trying',
      notes: options.newApproach.notes,
    });
  }
  
  // Merge related memories
  let relatedMemories = [...wip.relatedMemories];
  if (options.addRelatedMemories) {
    const newCids = options.addRelatedMemories.filter(
      cid => !relatedMemories.includes(cid)
    );
    relatedMemories = [...relatedMemories, ...newCids];
  }
  
  return {
    ...wip,
    status: options.status ?? wip.status,
    approaches,
    blockers: options.blockers ?? wip.blockers,
    nextStep: options.nextStep ?? wip.nextStep,
    relatedMemories,
  };
}

/**
 * Result of completing a task
 */
export interface CompletedTask {
  /** Original task ID */
  taskId: string;
  /** Task description */
  description: string;
  /** When the task was started */
  startedAt: string;
  /** When the task was completed */
  completedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** The successful approach (if any) */
  successfulApproach?: Approach;
  /** All approaches that were tried */
  allApproaches: Approach[];
  /** Related memories */
  relatedMemories: string[];
  /** Optional completion notes */
  notes?: string;
}

/**
 * Complete a task
 * 
 * Marks a task as done, capturing completion metadata.
 * The Zeigarnik Effect suggests this provides "closure" -
 * the task can now be released from active memory.
 * 
 * @returns CompletedTask with duration and successful approach
 * 
 * @example
 * ```ts
 * const completed = completeTask(wip, 'All tests passing');
 * console.log(`Completed in ${completed.durationMs}ms`);
 * ```
 */
export function completeTask(
  wip: WorkInProgress,
  notes?: string
): CompletedTask {
  const completedAt = new Date().toISOString();
  const startedMs = new Date(wip.startedAt).getTime();
  const completedMs = new Date(completedAt).getTime();
  
  // Find the successful approach (if any)
  const successfulApproach = wip.approaches.find(a => a.status === 'succeeded');
  
  return {
    taskId: wip.taskId,
    description: wip.description,
    startedAt: wip.startedAt,
    completedAt,
    durationMs: completedMs - startedMs,
    successfulApproach,
    allApproaches: wip.approaches,
    relatedMemories: wip.relatedMemories,
    notes,
  };
}

/**
 * Check if a task is blocked
 */
export function isBlocked(wip: WorkInProgress): boolean {
  return wip.status === 'blocked' && (wip.blockers?.length ?? 0) > 0;
}

/**
 * Get the current/active approach (most recent 'trying')
 */
export function getCurrentApproach(wip: WorkInProgress): Approach | undefined {
  return [...wip.approaches].reverse().find(a => a.status === 'trying');
}

/**
 * Get count of failed approaches
 * 
 * Useful for detecting when to escalate or try a different strategy.
 */
export function getFailedApproachCount(wip: WorkInProgress): number {
  return wip.approaches.filter(a => a.status === 'failed').length;
}
