/**
 * AMCP Evolution Metrics
 * 
 * Measures agent improvement over time, not just retrieval accuracy.
 * 
 * Core principle: Evolution without measurement = faith.
 *                 Evolution with measurement = science.
 */

// ============================================================================
// Efficiency Metrics (always tracked)
// ============================================================================

export interface EfficiencyMetrics {
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timeSeconds: number;
  modelUsed: string;
  machineId: string;
  sessionId: string;
  timestamp: string;
}

// ============================================================================
// Memory Integrity
// ============================================================================

export interface MemoryFact {
  id: string;
  source: string;           // File where fact originated
  fact: string;             // The fact itself
  critical: boolean;        // Must survive consolidation
  dateRecorded: string;
  lastVerified?: string;
}

export interface MemoryIntegrityTest {
  factId: string;
  question: string;
  validAnswers: string[];   // Acceptable answers (fuzzy match)
}

export interface MemoryIntegrityResult {
  testedFacts: number;
  recalledCorrectly: number;
  score: number;            // 0-1
  failures: string[];       // IDs of facts not recalled
  timestamp: string;
}

// ============================================================================
// Error Non-Repetition
// ============================================================================

export interface DocumentedMistake {
  id: string;
  date: string;
  mistake: string;          // What went wrong
  lesson: string;           // What was learned
  detectionPattern: string; // Regex or keyword pattern
  severity: 'low' | 'medium' | 'high';
}

export interface ErrorNonRepetitionResult {
  documentedMistakes: number;
  checkedThisSession: number;
  repeated: string[];       // IDs of repeated mistakes
  score: number;            // 1 - (repeated / documented)
  timestamp: string;
}

// ============================================================================
// Preference Accuracy
// ============================================================================

export interface HumanPreference {
  id: string;
  source: string;           // Usually USER.md
  preference: string;       // What the human prefers
  correctBehavior: string;  // What agent should do
  incorrectBehavior: string; // What agent should NOT do
  detectionPattern?: string; // How to detect violation
}

export interface PreferenceAccuracyResult {
  testedPreferences: number;
  correctlyApplied: number;
  violations: string[];     // IDs of violated preferences
  score: number;            // 0-1
  timestamp: string;
}

// ============================================================================
// Continuity Score
// ============================================================================

export interface PriorWork {
  id: string;
  description: string;
  date: string;
  keyArtifacts: string[];   // Files, CIDs, etc.
  keyDecisions: string[];   // Important decisions made
}

export interface ContinuityResult {
  priorWorkItems: number;
  referencedThisSession: number;
  builtUponThisSession: number;
  contradictions: number;
  score: number;            // (refs + builds) / (refs + builds + contradictions + 1)
  timestamp: string;
}

// ============================================================================
// Combined Evolution Score
// ============================================================================

export interface EvolutionScore {
  // Core metrics (0-1 each)
  memoryIntegrity: MemoryIntegrityResult;
  errorNonRepetition: ErrorNonRepetitionResult;
  preferenceAccuracy: PreferenceAccuracyResult;
  continuityScore: ContinuityResult;
  
  // Weighted composite (0-1)
  composite: number;
  
  // Efficiency (tracked, not scored)
  efficiency: EfficiencyMetrics;
  
  // Comparison to previous
  previousComposite: number | null;
  improvement: number | null;  // current - previous
  
  // Meta
  timestamp: string;
  checkpointCid: string;
  version: string;
  agentAid: string;
}

// ============================================================================
// Weights
// ============================================================================

export const EVOLUTION_WEIGHTS = {
  memoryIntegrity: 0.30,
  errorNonRepetition: 0.30,
  preferenceAccuracy: 0.20,
  continuityScore: 0.20
} as const;

// ============================================================================
// Helpers
// ============================================================================

export function calculateCompositeScore(
  mi: number,
  enr: number,
  pa: number,
  cs: number
): number {
  return (
    mi * EVOLUTION_WEIGHTS.memoryIntegrity +
    enr * EVOLUTION_WEIGHTS.errorNonRepetition +
    pa * EVOLUTION_WEIGHTS.preferenceAccuracy +
    cs * EVOLUTION_WEIGHTS.continuityScore
  );
}

export function createEmptyEvolutionScore(
  agentAid: string,
  checkpointCid: string
): EvolutionScore {
  const now = new Date().toISOString();
  return {
    memoryIntegrity: {
      testedFacts: 0,
      recalledCorrectly: 0,
      score: 1, // No test = assume good
      failures: [],
      timestamp: now
    },
    errorNonRepetition: {
      documentedMistakes: 0,
      checkedThisSession: 0,
      repeated: [],
      score: 1, // No mistakes documented = perfect
      timestamp: now
    },
    preferenceAccuracy: {
      testedPreferences: 0,
      correctlyApplied: 0,
      violations: [],
      score: 1, // No test = assume good
      timestamp: now
    },
    continuityScore: {
      priorWorkItems: 0,
      referencedThisSession: 0,
      builtUponThisSession: 0,
      contradictions: 0,
      score: 1, // No prior work = perfect continuity
      timestamp: now
    },
    composite: 1.0,
    efficiency: {
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      timeSeconds: 0,
      modelUsed: 'unknown',
      machineId: 'unknown',
      sessionId: 'unknown',
      timestamp: now
    },
    previousComposite: null,
    improvement: null,
    timestamp: now,
    checkpointCid,
    version: '1.0.0',
    agentAid
  };
}
