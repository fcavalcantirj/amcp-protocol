/**
 * CheckpointPolicy Schema — Recommended checkpoint triggers
 *
 * Research Backing:
 * - Memory Consolidation Windows (Stickgold, Nature 2005): Sleep consolidates memories
 *   through hippocampus-cortex communication. Session end = agent's "sleep" window.
 * - Autosave Research (Teevan et al., SIGCHI 2011): Combined event-triggered +
 *   time-triggered saving is optimal. Users lose less work, feel more confident.
 * - WAL Checkpointing (Database Systems): Write-ahead logging balances consistency
 *   and performance through periodic + threshold-based checkpoints.
 *
 * Design Principles:
 * - Policy is RECOMMENDATION, not enforcement
 * - MUST triggers are non-negotiable (human sovereignty)
 * - SHOULD triggers are sane defaults for most contexts
 * - MAY triggers are optional, context-dependent enhancements
 *
 * "Session end = consolidation window. Event + time triggers optimize tradeoff"
 */

/**
 * Checkpoint trigger types based on RFC 2119 priority levels.
 *
 * MUST: Requirement is absolute (human sovereignty, data integrity)
 * SHOULD: Recommended unless there are strong reasons to deviate
 * MAY: Optional, implementation-specific, value varies by context
 */
export type TriggerLevel = 'MUST' | 'SHOULD' | 'MAY';

/**
 * TriggerConfig — Configuration for a single checkpoint trigger
 */
export interface TriggerConfig {
  /**
   * Whether this trigger is enabled.
   * MUST triggers cannot be disabled.
   */
  enabled: boolean;

  /**
   * RFC 2119 priority level for this trigger.
   * Documents the recommendation strength.
   */
  level: TriggerLevel;
}

/**
 * ThresholdTriggerConfig — Trigger with numeric threshold
 */
export interface ThresholdTriggerConfig extends TriggerConfig {
  /**
   * Threshold value (0-1 for percentages, or absolute values).
   * Trigger fires when metric exceeds this threshold.
   */
  threshold: number;
}

/**
 * CheckpointPolicy — Defines when an agent SHOULD checkpoint memory
 *
 * From Stickgold (2005): Memory consolidation during "offline" periods
 * is crucial for transferring experiences to long-term storage.
 * For agents, session boundaries and context exhaustion are the
 * consolidation windows.
 *
 * From Teevan (2011): Optimal saving combines:
 * 1. Event-triggered (human request, significant learning)
 * 2. Time/resource-triggered (context threshold, session end)
 *
 * From WAL systems: Checkpoint when:
 * 1. Explicitly requested (human sovereignty)
 * 2. Resources near exhaustion (context window)
 * 3. At natural boundaries (session end)
 */
export interface CheckpointPolicy {
  /**
   * MUST: Checkpoint when human explicitly requests.
   *
   * Human sovereignty is non-negotiable. When a human says
   * "save state", "checkpoint", or "remember this", the agent
   * MUST create a checkpoint regardless of other conditions.
   *
   * Level: MUST (RFC 2119) — Cannot be disabled
   */
  onHumanRequest: TriggerConfig & { enabled: true; level: 'MUST' };

  /**
   * SHOULD: Checkpoint when session is ending.
   *
   * From Stickgold (2005): Sleep consolidates memories formed
   * during waking. Session end is the agent's sleep — the natural
   * consolidation window before context is lost.
   *
   * Level: SHOULD — Disable only if intentionally stateless
   */
  onSessionEnd: TriggerConfig;

  /**
   * SHOULD: Checkpoint when context usage exceeds threshold.
   *
   * From WAL checkpointing: Trigger checkpoint before resources
   * are exhausted to avoid data loss under pressure.
   *
   * Default threshold: 0.85 (85% context window usage)
   * Leaves ~15% buffer for checkpoint writing overhead.
   *
   * Level: SHOULD — Disable only for very short sessions
   */
  onContextThreshold: ThresholdTriggerConfig;

  /**
   * MAY: Checkpoint after significant learning.
   *
   * From McGaugh (2000): Emotional arousal modulates memory
   * consolidation. "Significant learning" = high-value memory
   * worth protecting immediately, not waiting for session end.
   *
   * Implementation defines "significant" (e.g., human-marked,
   * multiple corrections, breakthrough understanding).
   *
   * Level: MAY — Useful for long sessions with valuable discoveries
   */
  onSignificantLearning?: TriggerConfig;

  /**
   * MAY: Checkpoint on subjective state change.
   *
   * From Appraisal Theory (Lazarus 1991): State transitions
   * (stuck → flowing, aligned → drifting) mark cognitive shifts
   * worth capturing for later analysis and restoration.
   *
   * Level: MAY — Useful for debugging and self-improvement
   */
  onStateChange?: TriggerConfig;

  /**
   * MAY: Checkpoint when relationship milestone reached.
   *
   * From Social Memory / Dunbar (1998): Relationship state
   * transitions (new → familiar → trusted) are significant
   * events worth preserving.
   *
   * Level: MAY — Useful for relationship-heavy contexts
   */
  onRelationshipMilestone?: TriggerConfig;

  /**
   * MAY: Checkpoint after error or recovery.
   *
   * From WAL systems: Checkpoint after error recovery ensures
   * the corrected state is preserved. Prevents re-encountering
   * the same error on restart.
   *
   * Level: MAY — Useful for debugging, may add overhead
   */
  onError?: TriggerConfig;
}

/**
 * DEFAULT_CHECKPOINT_POLICY — Sane defaults for most contexts
 *
 * Balances:
 * - Data safety (85% threshold catches before OOM)
 * - Performance (no excessive checkpointing)
 * - Human sovereignty (onHumanRequest always on)
 *
 * Agents MAY customize, but SHOULD start with these defaults.
 */
export const DEFAULT_CHECKPOINT_POLICY: Readonly<CheckpointPolicy> = {
  // MUST: Always honor human requests
  onHumanRequest: {
    enabled: true,
    level: 'MUST',
  },

  // SHOULD: Session end is consolidation window (Stickgold 2005)
  onSessionEnd: {
    enabled: true,
    level: 'SHOULD',
  },

  // SHOULD: Checkpoint before context exhaustion
  onContextThreshold: {
    enabled: true,
    level: 'SHOULD',
    threshold: 0.85, // 85% — leaves buffer for writing
  },

  // MAY triggers disabled by default (opt-in)
  onSignificantLearning: {
    enabled: false,
    level: 'MAY',
  },
  onStateChange: {
    enabled: false,
    level: 'MAY',
  },
  onRelationshipMilestone: {
    enabled: false,
    level: 'MAY',
  },
  onError: {
    enabled: false,
    level: 'MAY',
  },
};

/**
 * AGGRESSIVE_CHECKPOINT_POLICY — For high-value/long sessions
 *
 * Enables all triggers. Higher overhead but maximum data safety.
 * Use when session is expected to be long or contain valuable work.
 */
export const AGGRESSIVE_CHECKPOINT_POLICY: Readonly<CheckpointPolicy> = {
  onHumanRequest: {
    enabled: true,
    level: 'MUST',
  },
  onSessionEnd: {
    enabled: true,
    level: 'SHOULD',
  },
  onContextThreshold: {
    enabled: true,
    level: 'SHOULD',
    threshold: 0.70, // More aggressive — 70%
  },
  onSignificantLearning: {
    enabled: true,
    level: 'MAY',
  },
  onStateChange: {
    enabled: true,
    level: 'MAY',
  },
  onRelationshipMilestone: {
    enabled: true,
    level: 'MAY',
  },
  onError: {
    enabled: true,
    level: 'MAY',
  },
};

/**
 * MINIMAL_CHECKPOINT_POLICY — For ephemeral/stateless sessions
 *
 * Only checkpoint on human request. Use when session state
 * is intentionally disposable.
 */
export const MINIMAL_CHECKPOINT_POLICY: Readonly<CheckpointPolicy> = {
  onHumanRequest: {
    enabled: true,
    level: 'MUST',
  },
  onSessionEnd: {
    enabled: false,
    level: 'SHOULD',
  },
  onContextThreshold: {
    enabled: false,
    level: 'SHOULD',
    threshold: 0.85,
  },
};

/**
 * Creates a custom checkpoint policy with defaults filled in.
 *
 * @param overrides - Partial policy to override defaults
 * @returns Complete CheckpointPolicy with overrides applied
 */
export function createCheckpointPolicy(
  overrides: Partial<Omit<CheckpointPolicy, 'onHumanRequest'>>
): CheckpointPolicy {
  return {
    ...DEFAULT_CHECKPOINT_POLICY,
    ...overrides,
    // onHumanRequest cannot be overridden — human sovereignty
    onHumanRequest: DEFAULT_CHECKPOINT_POLICY.onHumanRequest,
  };
}

/**
 * Validates a checkpoint policy configuration.
 *
 * @param policy - Policy to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateCheckpointPolicy(policy: CheckpointPolicy): string[] {
  const errors: string[] = [];

  // MUST: onHumanRequest cannot be disabled
  if (!policy.onHumanRequest.enabled) {
    errors.push('onHumanRequest MUST be enabled (human sovereignty)');
  }

  // Threshold validation
  if (policy.onContextThreshold.enabled) {
    const t = policy.onContextThreshold.threshold;
    if (t < 0.5 || t > 0.99) {
      errors.push(`onContextThreshold.threshold (${t}) should be 0.50-0.99`);
    }
  }

  return errors;
}

/**
 * Checks if a checkpoint should be triggered based on policy and current state.
 *
 * @param policy - The checkpoint policy to evaluate
 * @param event - The event type that occurred
 * @param contextUsage - Current context window usage (0-1)
 * @returns Whether a checkpoint should be triggered
 */
export function shouldCheckpoint(
  policy: CheckpointPolicy,
  event:
    | 'humanRequest'
    | 'sessionEnd'
    | 'contextCheck'
    | 'significantLearning'
    | 'stateChange'
    | 'relationshipMilestone'
    | 'error',
  contextUsage?: number
): boolean {
  switch (event) {
    case 'humanRequest':
      // MUST always checkpoint on human request
      return true;

    case 'sessionEnd':
      return policy.onSessionEnd.enabled;

    case 'contextCheck':
      if (!policy.onContextThreshold.enabled) return false;
      if (contextUsage === undefined) return false;
      return contextUsage >= policy.onContextThreshold.threshold;

    case 'significantLearning':
      return policy.onSignificantLearning?.enabled ?? false;

    case 'stateChange':
      return policy.onStateChange?.enabled ?? false;

    case 'relationshipMilestone':
      return policy.onRelationshipMilestone?.enabled ?? false;

    case 'error':
      return policy.onError?.enabled ?? false;

    default:
      return false;
  }
}

/**
 * Describes the triggers enabled in a policy (for logging/debugging).
 *
 * @param policy - Policy to describe
 * @returns Human-readable description of enabled triggers
 */
export function describePolicy(policy: CheckpointPolicy): string {
  const triggers: string[] = [];

  triggers.push('onHumanRequest (MUST)');

  if (policy.onSessionEnd.enabled) {
    triggers.push('onSessionEnd (SHOULD)');
  }

  if (policy.onContextThreshold.enabled) {
    const pct = Math.round(policy.onContextThreshold.threshold * 100);
    triggers.push(`onContextThreshold@${pct}% (SHOULD)`);
  }

  if (policy.onSignificantLearning?.enabled) {
    triggers.push('onSignificantLearning (MAY)');
  }

  if (policy.onStateChange?.enabled) {
    triggers.push('onStateChange (MAY)');
  }

  if (policy.onRelationshipMilestone?.enabled) {
    triggers.push('onRelationshipMilestone (MAY)');
  }

  if (policy.onError?.enabled) {
    triggers.push('onError (MAY)');
  }

  return `CheckpointPolicy: [${triggers.join(', ')}]`;
}
