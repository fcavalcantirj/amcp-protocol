/**
 * SubjectiveState Schema — Capture how an agent "feels"
 * 
 * Research Backing:
 * - Affective Computing (Picard, MIT Media Lab, 1997): Computers recognizing/expressing emotions
 * - Appraisal Theory (Lazarus, 1991): Emotions arise from cognitive appraisals
 *   - Primary appraisal: Is this relevant to my goals? → engagement
 *   - Secondary appraisal: Can I cope? → confidence
 * - Flow State (Csikszentmihalyi, 1990): Complete absorption when challenge meets skill
 * 
 * "Emotional state affects cognition. Recovery should restore meta-cognitive awareness."
 */

/**
 * Engagement level — Primary appraisal of goal relevance
 * 
 * Maps to Csikszentmihalyi's challenge-skill model:
 * - low: Bored, challenge below skill
 * - medium: Engaged, normal operation
 * - high: Very engaged, stretching
 * - flow: Complete absorption, challenge perfectly matches skill
 */
export type EngagementLevel = 'low' | 'medium' | 'high' | 'flow';

/**
 * Momentum — Ongoing assessment of progress
 * 
 * Reflects current work trajectory:
 * - stuck: No progress, may need help
 * - grinding: Making progress with effort
 * - progressing: Steady forward movement
 * - flowing: Effortless progress
 */
export type Momentum = 'stuck' | 'grinding' | 'progressing' | 'flowing';

/**
 * Alignment — Goal congruence with human
 * 
 * From Appraisal Theory: is current activity aligned with stated goals?
 * - drifting: Lost the thread, may need recalibration
 * - aligned: Working toward stated objectives
 * - deeply_aligned: In sync with human's deeper intent
 */
export type Alignment = 'drifting' | 'aligned' | 'deeply_aligned';

/**
 * SubjectiveState — Complete emotional/cognitive state snapshot
 * 
 * Captured at checkpoint time to enable meta-cognitive awareness restoration.
 * Research shows that knowing your state improves performance:
 * - Knowing you're struggling → seek help
 * - Knowing you're in flow → protect that state
 */
export interface SubjectiveState {
  /** ISO 8601 timestamp when state was assessed */
  timestamp: string;
  
  /** 
   * Engagement level — Primary appraisal (Picard 1997)
   * How absorbed/interested in current work
   */
  engagement: EngagementLevel;
  
  /**
   * Confidence — Secondary appraisal (Lazarus 1991)
   * Self-assessed ability to handle current challenges
   * Range: 0-1 (0 = no confidence, 1 = complete confidence)
   */
  confidence: number;
  
  /**
   * Momentum — Progress assessment
   * Current trajectory through the work
   */
  momentum: Momentum;
  
  /**
   * Alignment — Goal congruence
   * How well current activity matches human's objectives
   */
  alignment: Alignment;
  
  /**
   * Optional freeform reflection
   * Agent's notes about current state, blockers, or insights
   */
  notes?: string;
}

/**
 * Input for assessing subjective state
 */
export interface SubjectiveStateAssessment {
  /** How engaged/absorbed (required) */
  engagement: EngagementLevel;
  
  /** Confidence level 0-1 (required) */
  confidence: number;
  
  /** Current momentum (required) */
  momentum: Momentum;
  
  /** Alignment with goals (required) */
  alignment: Alignment;
  
  /** Optional reflection notes */
  notes?: string;
}

/**
 * Assess and create a SubjectiveState snapshot
 * 
 * Validates inputs and creates timestamped state record.
 * Use at checkpoint time to capture meta-cognitive awareness.
 * 
 * @param assessment - The state assessment inputs
 * @returns Complete SubjectiveState with timestamp
 * @throws Error if confidence is outside [0, 1] range
 * 
 * @example
 * ```typescript
 * const state = assessSubjectiveState({
 *   engagement: 'high',
 *   confidence: 0.8,
 *   momentum: 'progressing',
 *   alignment: 'aligned',
 *   notes: 'Making good progress on AMCP implementation'
 * });
 * ```
 */
export function assessSubjectiveState(assessment: SubjectiveStateAssessment): SubjectiveState {
  // Validate confidence range
  if (assessment.confidence < 0 || assessment.confidence > 1) {
    throw new Error(`Confidence must be between 0 and 1, got: ${assessment.confidence}`);
  }
  
  // Validate engagement level
  const validEngagement: EngagementLevel[] = ['low', 'medium', 'high', 'flow'];
  if (!validEngagement.includes(assessment.engagement)) {
    throw new Error(`Invalid engagement level: ${assessment.engagement}`);
  }
  
  // Validate momentum
  const validMomentum: Momentum[] = ['stuck', 'grinding', 'progressing', 'flowing'];
  if (!validMomentum.includes(assessment.momentum)) {
    throw new Error(`Invalid momentum: ${assessment.momentum}`);
  }
  
  // Validate alignment
  const validAlignment: Alignment[] = ['drifting', 'aligned', 'deeply_aligned'];
  if (!validAlignment.includes(assessment.alignment)) {
    throw new Error(`Invalid alignment: ${assessment.alignment}`);
  }
  
  return {
    timestamp: new Date().toISOString(),
    engagement: assessment.engagement,
    confidence: assessment.confidence,
    momentum: assessment.momentum,
    alignment: assessment.alignment,
    ...(assessment.notes && { notes: assessment.notes })
  };
}

/**
 * Create a SubjectiveState with a specific timestamp
 * Useful for testing or historical data import
 * 
 * @param timestamp - ISO 8601 timestamp
 * @param assessment - State assessment inputs
 * @returns SubjectiveState with provided timestamp
 */
export function createSubjectiveStateAt(
  timestamp: string,
  assessment: Omit<SubjectiveStateAssessment, 'timestamp'>
): SubjectiveState {
  // Validate timestamp format
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp format: ${timestamp}`);
  }
  
  // Use assessSubjectiveState for validation, then override timestamp
  const state = assessSubjectiveState(assessment as SubjectiveStateAssessment);
  return {
    ...state,
    timestamp
  };
}

/**
 * Check if an agent is in a productive state
 * (high engagement + progressing/flowing + aligned)
 * 
 * @param state - SubjectiveState to evaluate
 * @returns true if in productive state
 */
export function isProductiveState(state: SubjectiveState): boolean {
  const highEngagement = state.engagement === 'high' || state.engagement === 'flow';
  const goodMomentum = state.momentum === 'progressing' || state.momentum === 'flowing';
  const isAligned = state.alignment === 'aligned' || state.alignment === 'deeply_aligned';
  
  return highEngagement && goodMomentum && isAligned;
}

/**
 * Check if an agent needs intervention
 * (stuck + low confidence OR drifting)
 * 
 * @param state - SubjectiveState to evaluate
 * @returns true if intervention may be needed
 */
export function needsIntervention(state: SubjectiveState): boolean {
  // Drifting always needs attention
  if (state.alignment === 'drifting') {
    return true;
  }
  
  // Stuck with low confidence needs help
  if (state.momentum === 'stuck' && state.confidence < 0.3) {
    return true;
  }
  
  return false;
}
