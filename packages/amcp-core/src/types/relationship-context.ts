/**
 * RelationshipContext Schema
 * 
 * Tracks entity relationships for AI agents, enabling social memory
 * and appropriate interaction calibration.
 * 
 * Research foundations:
 * - Dunbar's Number (1998): Brain tracks ~150 stable relationships in fractal layers
 *   (1.5, 5, 15, 50, 150) representing intimacy gradients
 * - Theory of Mind (Premack & Woodruff 1978): Attributing mental states to others
 * - Trust Calibration (Lee & See 2004): Trust must be calibrated to actual capabilities
 * 
 * Design principle: Relationship tracking is fundamental to intelligence.
 * Trust must be calibrated, not assumed.
 */

/**
 * Type of entity in the relationship
 */
export type EntityType = 'human' | 'agent' | 'service';

/**
 * Rapport level based on Dunbar's intimacy layers
 * 
 * - new: First interactions (no history)
 * - familiar: Repeated interactions, basic preferences known (~50 layer)
 * - trusted: Established trust, can rely on (~15 layer)
 * - close: Deep relationship, high trust (~5 layer)
 */
export type RapportLevel = 'new' | 'familiar' | 'trusted' | 'close';

/**
 * Interaction preferences for the entity
 */
export interface RelationshipPreferences {
  /** How they prefer to communicate (e.g., 'formal', 'casual', 'technical') */
  communicationStyle?: string;
  /** Preferred level of detail in responses (e.g., 'brief', 'detailed', 'comprehensive') */
  detailLevel?: 'brief' | 'detailed' | 'comprehensive';
  /** Entity's timezone for time-aware interactions */
  timezone?: string;
  /** Preferred language */
  language?: string;
  /** Any other learned preferences */
  custom?: Record<string, unknown>;
}

/**
 * Interaction history summary
 */
export interface RelationshipHistory {
  /** ISO timestamp of first interaction */
  firstInteraction: string;
  /** ISO timestamp of most recent interaction */
  lastInteraction: string;
  /** Total number of interactions */
  interactionCount: number;
  /** Most frequently discussed topics (max 10 recommended) */
  topTopics: string[];
}

/**
 * Trust calibration (Lee & See 2004)
 * 
 * Trust should match actual capabilities and reliability observed.
 */
export interface TrustCalibration {
  /** Overall trust level (0-1) */
  level: number;
  /** Reliability in keeping commitments (0-1) */
  reliability?: number;
  /** Competence in their domain (0-1) */
  competence?: number;
  /** Basis for trust assessment */
  basis?: string;
  /** Last time trust was recalibrated */
  calibratedAt?: string;
}

/**
 * RelationshipContext - tracks a relationship with an entity
 * 
 * Part of checkpoint schema for memory.relationships array.
 */
export interface RelationshipContext {
  /** Unique identifier for the entity */
  entityId: string;
  /** Type of entity */
  entityType: EntityType;
  /** Display name (optional) */
  name?: string;
  /** Current rapport level */
  rapport: RapportLevel;
  /** Communication and interaction preferences */
  preferences: RelationshipPreferences;
  /** Interaction history summary */
  history: RelationshipHistory;
  /** Trust calibration (optional, for deeper relationships) */
  trust?: TrustCalibration;
  /** Notes about the relationship (Theory of Mind observations) */
  notes?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update to apply to a relationship
 */
export interface RelationshipUpdate {
  /** New interaction timestamp (defaults to now) */
  interactionAt?: string;
  /** Topics discussed in this interaction */
  topics?: string[];
  /** Update rapport level */
  rapport?: RapportLevel;
  /** Merge with existing preferences */
  preferences?: Partial<RelationshipPreferences>;
  /** Update trust calibration */
  trust?: Partial<TrustCalibration>;
  /** Update notes */
  notes?: string;
  /** Update metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Create a new relationship context for first interaction
 */
export function createRelationship(
  entityId: string,
  entityType: EntityType,
  options: {
    name?: string;
    preferences?: RelationshipPreferences;
    metadata?: Record<string, unknown>;
  } = {}
): RelationshipContext {
  const now = new Date().toISOString();
  
  return {
    entityId,
    entityType,
    name: options.name,
    rapport: 'new',
    preferences: options.preferences ?? {},
    history: {
      firstInteraction: now,
      lastInteraction: now,
      interactionCount: 1,
      topTopics: []
    },
    metadata: options.metadata
  };
}

/**
 * Update an existing relationship with new interaction data
 * 
 * Handles:
 * - Incrementing interaction count
 * - Updating last interaction timestamp
 * - Merging topics (keeping top 10 by frequency approximation)
 * - Merging preferences
 * - Optional rapport/trust updates
 */
export function updateRelationship(
  relationship: RelationshipContext,
  update: RelationshipUpdate
): RelationshipContext {
  const interactionAt = update.interactionAt ?? new Date().toISOString();
  
  // Merge topics - add new topics, keep top 10
  let topTopics = [...relationship.history.topTopics];
  if (update.topics?.length) {
    for (const topic of update.topics) {
      if (!topTopics.includes(topic)) {
        topTopics.push(topic);
      } else {
        // Move to front (simple frequency heuristic)
        topTopics = topTopics.filter(t => t !== topic);
        topTopics.unshift(topic);
      }
    }
    // Keep top 10
    topTopics = topTopics.slice(0, 10);
  }
  
  // Merge preferences
  const mergedPreferences: RelationshipPreferences = {
    ...relationship.preferences,
    ...update.preferences,
    custom: {
      ...relationship.preferences.custom,
      ...update.preferences?.custom
    }
  };
  
  // Merge trust if provided
  let trust = relationship.trust;
  if (update.trust) {
    trust = {
      ...relationship.trust,
      ...update.trust,
      calibratedAt: interactionAt
    } as TrustCalibration;
  }
  
  return {
    ...relationship,
    name: relationship.name, // preserve unless explicitly changed
    rapport: update.rapport ?? relationship.rapport,
    preferences: mergedPreferences,
    history: {
      ...relationship.history,
      lastInteraction: interactionAt,
      interactionCount: relationship.history.interactionCount + 1,
      topTopics
    },
    trust,
    notes: update.notes ?? relationship.notes,
    metadata: update.metadata 
      ? { ...relationship.metadata, ...update.metadata }
      : relationship.metadata
  };
}

/**
 * Suggest rapport upgrade based on interaction history
 * 
 * Based on Dunbar's layer thresholds:
 * - new → familiar: ~5 interactions
 * - familiar → trusted: ~15 interactions with positive trust
 * - trusted → close: ~50 interactions with high trust
 */
export function suggestRapportUpgrade(
  relationship: RelationshipContext
): RapportLevel | null {
  const { interactionCount } = relationship.history;
  const trustLevel = relationship.trust?.level ?? 0.5;
  
  switch (relationship.rapport) {
    case 'new':
      if (interactionCount >= 5) return 'familiar';
      break;
    case 'familiar':
      if (interactionCount >= 15 && trustLevel >= 0.6) return 'trusted';
      break;
    case 'trusted':
      if (interactionCount >= 50 && trustLevel >= 0.8) return 'close';
      break;
    case 'close':
      // Already at highest level
      break;
  }
  
  return null;
}

/**
 * Calculate Dunbar layer for relationship count management
 * 
 * Dunbar's fractal layers: 1.5, 5, 15, 50, 150, 500, 1500
 * Returns which layer a relationship count falls into
 */
export function getDunbarLayer(relationshipCount: number): number {
  const layers = [1.5, 5, 15, 50, 150, 500, 1500, 5000];
  for (let i = 0; i < layers.length; i++) {
    if (relationshipCount <= layers[i]) {
      return layers[i];
    }
  }
  return 5000;
}
