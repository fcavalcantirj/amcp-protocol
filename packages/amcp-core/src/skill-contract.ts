/**
 * Skill ontology contract types and validation
 *
 * Defines TypeScript interfaces for how skills interact with the
 * ontology graph: what entity types they read/write, and what
 * preconditions/postconditions they expect.
 */

/** Valid entity type strings for skill contracts */
const VALID_ENTITY_TYPES = new Set([
  'Person', 'Organization', 'Project', 'Task', 'Goal',
  'Event', 'Location', 'Document', 'Message', 'Note',
  'Account', 'Credential', 'Action', 'Policy',
]);

/**
 * A predicate that constrains entity state.
 * Condition format: "<property> exists" or "<property> = <value>" or "<property> != <value>"
 */
export interface ContractPredicate {
  /** Entity type this predicate applies to */
  entity_type: string;
  /** Condition expression (e.g. "assignee exists", "status = done") */
  condition: string;
  /** Human-readable description */
  description?: string;
}

/** Simplified entity representation for precondition checking */
export interface ContractEntity {
  id: string;
  entity_type: string;
  properties: Record<string, unknown>;
}

/** Skill ontology contract defining read/write access and constraints */
export interface SkillOntologyContract {
  /** Name of the skill */
  skill_name: string;
  /** Contract version */
  version: string;
  /** Ontology interaction specification */
  ontology: {
    /** Entity types this skill reads */
    reads: string[];
    /** Entity types this skill writes/modifies */
    writes: string[];
    /** Conditions that must hold before skill execution */
    preconditions: ContractPredicate[];
    /** Conditions that will hold after skill execution */
    postconditions: ContractPredicate[];
  };
}

/** Result of contract validation */
export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
}

/** A violation of a precondition by a specific entity */
export interface PreconditionViolation {
  entity_id: string;
  entity_type: string;
  condition: string;
  description?: string;
}

/** Result of precondition checking */
export interface CheckResult {
  satisfied: boolean;
  violations: PreconditionViolation[];
}

/** A conflict between two skill contracts */
export interface ConflictResult {
  skill_a: string;
  skill_b: string;
  entity_type: string;
  condition_a: string;
  condition_b: string;
  description: string;
}

/**
 * Parse a condition string into its parts.
 * Supported formats: "<prop> exists", "<prop> = <value>", "<prop> != <value>"
 */
function parseCondition(condition: string): { property: string; operator: string; value?: string } | null {
  const existsMatch = condition.match(/^(\w+)\s+exists$/);
  if (existsMatch) {
    return { property: existsMatch[1], operator: 'exists' };
  }

  const eqMatch = condition.match(/^(\w+)\s*!=\s*(.+)$/);
  if (eqMatch) {
    return { property: eqMatch[1], operator: '!=', value: eqMatch[2].trim() };
  }

  const simpleEqMatch = condition.match(/^(\w+)\s*=\s*(.+)$/);
  if (simpleEqMatch) {
    return { property: simpleEqMatch[1], operator: '=', value: simpleEqMatch[2].trim() };
  }

  return null;
}

/**
 * Evaluate a parsed condition against entity properties.
 */
function evaluateCondition(
  properties: Record<string, unknown>,
  parsed: { property: string; operator: string; value?: string }
): boolean {
  const propValue = properties[parsed.property];

  switch (parsed.operator) {
    case 'exists':
      return propValue !== undefined && propValue !== null;
    case '=':
      return String(propValue) === parsed.value;
    case '!=':
      return String(propValue) !== parsed.value;
    default:
      return false;
  }
}

/**
 * Validate a skill ontology contract structure.
 *
 * Checks required fields and validates entity type references.
 */
export function validateContract(contract: SkillOntologyContract): ContractValidationResult {
  const errors: string[] = [];

  if (!contract.skill_name || typeof contract.skill_name !== 'string') {
    errors.push('Missing or invalid skill_name (expected non-empty string)');
  }

  if (!contract.version || typeof contract.version !== 'string') {
    errors.push('Missing or invalid version (expected non-empty string)');
  }

  if (!contract.ontology || typeof contract.ontology !== 'object') {
    errors.push('Missing or invalid ontology (expected object)');
    return { valid: false, errors };
  }

  for (const entityType of contract.ontology.reads) {
    if (!VALID_ENTITY_TYPES.has(entityType)) {
      errors.push(`Invalid entity type in reads: '${entityType}'`);
    }
  }

  for (const entityType of contract.ontology.writes) {
    if (!VALID_ENTITY_TYPES.has(entityType)) {
      errors.push(`Invalid entity type in writes: '${entityType}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check preconditions against current graph entities.
 *
 * Evaluates each precondition against matching entities.
 * Only entities whose type matches the predicate's entity_type are checked.
 */
export function checkPreconditions(
  contract: SkillOntologyContract,
  entities: ContractEntity[]
): CheckResult {
  const violations: PreconditionViolation[] = [];

  for (const predicate of contract.ontology.preconditions) {
    const parsed = parseCondition(predicate.condition);
    if (!parsed) continue;

    const matching = entities.filter(e => e.entity_type === predicate.entity_type);

    for (const entity of matching) {
      if (!evaluateCondition(entity.properties, parsed)) {
        violations.push({
          entity_id: entity.id,
          entity_type: entity.entity_type,
          condition: predicate.condition,
          description: predicate.description,
        });
      }
    }
  }

  return { satisfied: violations.length === 0, violations };
}

/**
 * Detect conflicts between skill contracts.
 *
 * Two contracts conflict when both write to the same entity type
 * and have contradictory postconditions (e.g., "status = done" vs "status != done",
 * or "status = done" vs "status = active").
 */
export function detectConflicts(contracts: SkillOntologyContract[]): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  for (let i = 0; i < contracts.length; i++) {
    for (let j = i + 1; j < contracts.length; j++) {
      const a = contracts[i];
      const b = contracts[j];

      // Only check contracts that both write
      const sharedWrites = a.ontology.writes.filter(w => b.ontology.writes.includes(w));
      if (sharedWrites.length === 0) continue;

      for (const entityType of sharedWrites) {
        const postA = a.ontology.postconditions.filter(p => p.entity_type === entityType);
        const postB = b.ontology.postconditions.filter(p => p.entity_type === entityType);

        for (const pA of postA) {
          const parsedA = parseCondition(pA.condition);
          if (!parsedA) continue;

          for (const pB of postB) {
            const parsedB = parseCondition(pB.condition);
            if (!parsedB) continue;

            // Same property, contradictory conditions
            if (parsedA.property === parsedB.property && areContradictory(parsedA, parsedB)) {
              conflicts.push({
                skill_a: a.skill_name,
                skill_b: b.skill_name,
                entity_type: entityType,
                condition_a: pA.condition,
                condition_b: pB.condition,
                description: `Skills '${a.skill_name}' and '${b.skill_name}' have contradictory postconditions on ${entityType}.${parsedA.property}`,
              });
            }
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Check if two parsed conditions are contradictory.
 */
function areContradictory(
  a: { property: string; operator: string; value?: string },
  b: { property: string; operator: string; value?: string }
): boolean {
  // "prop = X" vs "prop != X"
  if (a.operator === '=' && b.operator === '!=' && a.value === b.value) return true;
  if (a.operator === '!=' && b.operator === '=' && a.value === b.value) return true;

  // "prop = X" vs "prop = Y" where X != Y
  if (a.operator === '=' && b.operator === '=' && a.value !== b.value) return true;

  return false;
}
