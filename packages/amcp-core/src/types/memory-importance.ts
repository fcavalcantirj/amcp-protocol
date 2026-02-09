/**
 * MemoryImportance Schema
 * 
 * Implements human-marked priority and durability for agent memories.
 * 
 * Research backing:
 * - Levels of Processing (Craik & Lockhart, 1972): Deeper processing = more durable memory
 * - Memory Consolidation (McGaugh, 2000): Emotional arousal modulates consolidation  
 * - Forgetting Curve (Ebbinghaus, 1885): Without reinforcement, memories decay exponentially
 * 
 * Human marking acts as an "emotional arousal signal" - when a human explicitly
 * marks something as important, it triggers deeper processing and consolidation.
 */

/**
 * Durability levels map to biological memory decay patterns.
 * 
 * Based on Ebbinghaus forgetting curve:
 * - ephemeral: Working memory, decays within minutes/session
 * - session: Short-term consolidation, decays within days
 * - persistent: Long-term memory, decays over weeks/months
 * - permanent: Protected from decay (human-marked "never forget")
 */
export type MemoryDurability = 'ephemeral' | 'session' | 'persistent' | 'permanent';

/**
 * Priority levels for memory consolidation queue.
 * 
 * Based on McGaugh (2000) - emotional arousal modulates which memories
 * get consolidated first when resources are limited.
 * 
 * - low: Background information, consolidate if resources available
 * - normal: Standard memories, regular consolidation
 * - high: Important context, prioritize consolidation
 * - critical: Must not lose, consolidate immediately
 */
export type MemoryPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * ISO 8601 timestamp string (e.g., "2026-02-09T16:30:00.000Z")
 */
export type Timestamp = string;

/**
 * MemoryImportance - captures priority and durability signals for a memory.
 * 
 * Core principle: Human marking = deep processing signal (Craik & Lockhart 1972)
 * When a human explicitly marks a memory, it's the equivalent of emotional
 * arousal in biological memory systems.
 */
export interface MemoryImportance {
  /**
   * How long should this memory resist decay?
   * Maps to Ebbinghaus forgetting curve resistance.
   */
  durability: MemoryDurability;

  /**
   * How urgently should this memory be consolidated?
   * Affects checkpoint and compaction behavior.
   */
  priority: MemoryPriority;

  /**
   * Optional scope context for the memory.
   * Examples: "project:amcp", "relationship:alice", "topic:cryptography"
   * Helps with filtering and retrieval.
   */
  scope?: string;

  /**
   * Was this importance level set by a human?
   * Human marking = emotional arousal signal.
   * 
   * true: Human explicitly said "remember this" / "important"
   * false: System inferred importance (e.g., from repetition, context)
   */
  humanMarked: boolean;

  /**
   * When was the importance marked (if humanMarked is true)?
   * ISO 8601 timestamp.
   * Useful for audit trails and decay calculations.
   */
  markedAt?: Timestamp;
}

/**
 * Default importance for memories without explicit marking.
 * Represents standard working memory with normal consolidation.
 */
export const DEFAULT_IMPORTANCE: MemoryImportance = {
  durability: 'session',
  priority: 'normal',
  humanMarked: false,
};

/**
 * Importance preset for human-marked "never forget" memories.
 */
export const NEVER_FORGET_IMPORTANCE: Readonly<MemoryImportance> = {
  durability: 'permanent',
  priority: 'critical',
  humanMarked: true,
  markedAt: undefined, // Set at marking time
};

/**
 * Creates a MemoryImportance with human marking timestamp.
 * 
 * @param durability - Decay resistance level
 * @param priority - Consolidation priority  
 * @param scope - Optional context scope
 * @returns MemoryImportance with humanMarked=true and current timestamp
 */
export function markImportant(
  durability: MemoryDurability = 'persistent',
  priority: MemoryPriority = 'high',
  scope?: string
): MemoryImportance {
  return {
    durability,
    priority,
    scope,
    humanMarked: true,
    markedAt: new Date().toISOString(),
  };
}

/**
 * Creates a system-inferred importance (not human-marked).
 * 
 * @param durability - Decay resistance level
 * @param priority - Consolidation priority
 * @param scope - Optional context scope
 * @returns MemoryImportance with humanMarked=false
 */
export function inferImportance(
  durability: MemoryDurability = 'session',
  priority: MemoryPriority = 'normal',
  scope?: string
): MemoryImportance {
  return {
    durability,
    priority,
    scope,
    humanMarked: false,
  };
}

/**
 * Compares two importance levels.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 * 
 * Comparison order: priority first, then durability.
 */
export function compareImportance(a: MemoryImportance, b: MemoryImportance): number {
  const priorityOrder: Record<MemoryPriority, number> = {
    low: 0,
    normal: 1,
    high: 2,
    critical: 3,
  };
  
  const durabilityOrder: Record<MemoryDurability, number> = {
    ephemeral: 0,
    session: 1,
    persistent: 2,
    permanent: 3,
  };
  
  const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
  if (priorityDiff !== 0) return priorityDiff;
  
  return durabilityOrder[a.durability] - durabilityOrder[b.durability];
}

/**
 * Filters memories by minimum durability threshold.
 * Useful for checkpoint compaction - keep only durable memories.
 * 
 * @param memories - Array of items with importance field
 * @param minDurability - Minimum durability to include
 * @returns Filtered array
 */
export function filterByDurability<T extends { importance?: MemoryImportance }>(
  memories: T[],
  minDurability: MemoryDurability
): T[] {
  const durabilityOrder: Record<MemoryDurability, number> = {
    ephemeral: 0,
    session: 1,
    persistent: 2,
    permanent: 3,
  };
  
  const threshold = durabilityOrder[minDurability];
  
  return memories.filter((m) => {
    const dur = m.importance?.durability ?? 'session';
    return durabilityOrder[dur] >= threshold;
  });
}

/**
 * Gets all human-marked memories from a collection.
 * Human-marked memories are the highest value - they represent
 * explicit human attention and should never be lost.
 * 
 * @param memories - Array of items with importance field
 * @returns Array of human-marked items
 */
export function getHumanMarked<T extends { importance?: MemoryImportance }>(
  memories: T[]
): T[] {
  return memories.filter((m) => m.importance?.humanMarked === true);
}
