/**
 * Ontology schema validation for JSONL graph files
 *
 * Validates entity and relation schema enforcement, relation integrity
 * (references existing entities), and acyclic dependency checking for
 * 'blocks' and 'depends_on' relations.
 */

import { readFile } from 'node:fs/promises';

/** Result of ontology schema validation */
export interface OntologyValidationResult {
  valid: boolean;
  entity_count: number;
  relation_count: number;
  errors: string[];
}

/** Parsed entity from JSONL */
interface ParsedEntity {
  type: 'entity';
  id: string;
  entityType: string;
  properties: Record<string, unknown>;
  created: string;
  updated: string;
}

/** Parsed relation from JSONL */
interface ParsedRelation {
  type: 'relation';
  from_id: string;
  relation_type: string;
  to_id: string;
}

/** Relation types that must be acyclic */
const ACYCLIC_RELATIONS = new Set(['blocks', 'depends_on']);

/**
 * Validate a JSONL ontology graph file
 *
 * @param filePath - Path to the JSONL graph file
 * @returns Validation result with entity/relation counts and errors
 */
export async function validateOntologySchema(filePath: string): Promise<OntologyValidationResult> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  const errors: string[] = [];
  const entities = new Map<string, ParsedEntity>();
  const relations: Array<{ line: number; relation: ParsedRelation }> = [];

  // First pass: parse lines, validate schema, collect entities and relations
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      errors.push(`Line ${lineNum}: Invalid JSON`);
      continue;
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      errors.push(`Line ${lineNum}: Expected JSON object`);
      continue;
    }

    const obj = parsed as Record<string, unknown>;

    if (obj.type === 'entity') {
      const entityErrors = validateEntity(obj, lineNum);
      if (entityErrors.length > 0) {
        errors.push(...entityErrors);
      } else {
        entities.set(obj.id as string, obj as unknown as ParsedEntity);
      }
    } else if (obj.type === 'relation') {
      const relationErrors = validateRelation(obj, lineNum);
      if (relationErrors.length > 0) {
        errors.push(...relationErrors);
      } else {
        relations.push({ line: lineNum, relation: obj as unknown as ParsedRelation });
      }
    } else {
      errors.push(`Line ${lineNum}: Missing or invalid 'type' field (expected 'entity' or 'relation')`);
    }
  }

  // Second pass: validate relation integrity (references)
  for (const { line, relation } of relations) {
    if (!entities.has(relation.from_id)) {
      errors.push(`Line ${line}: Relation from_id='${relation.from_id}' references non-existent entity`);
    }
    if (!entities.has(relation.to_id)) {
      errors.push(`Line ${line}: Relation to_id='${relation.to_id}' references non-existent entity`);
    }
  }

  // Third pass: cycle detection for acyclic relation types
  const cycleErrors = detectCycles(relations, entities);
  errors.push(...cycleErrors);

  return {
    valid: errors.length === 0,
    entity_count: entities.size,
    relation_count: relations.length,
    errors,
  };
}

/** Validate entity required fields */
function validateEntity(obj: Record<string, unknown>, lineNum: number): string[] {
  const errors: string[] = [];
  const required = ['id', 'entityType', 'properties', 'created', 'updated'];
  for (const field of required) {
    if (!(field in obj)) {
      errors.push(`Line ${lineNum}: Entity missing required field '${field}'`);
    }
  }
  return errors;
}

/** Validate relation required fields */
function validateRelation(obj: Record<string, unknown>, lineNum: number): string[] {
  const errors: string[] = [];
  const required = ['from_id', 'relation_type', 'to_id'];
  for (const field of required) {
    if (!(field in obj)) {
      errors.push(`Line ${lineNum}: Relation missing required field '${field}'`);
    }
  }
  return errors;
}

/** Detect cycles in acyclic relation types using DFS */
function detectCycles(
  relations: Array<{ line: number; relation: ParsedRelation }>,
  entities: Map<string, ParsedEntity>
): string[] {
  const errors: string[] = [];

  // Build adjacency list for acyclic relations only
  const graph = new Map<string, string[]>();
  for (const { relation } of relations) {
    if (!ACYCLIC_RELATIONS.has(relation.relation_type)) continue;
    if (!entities.has(relation.from_id) || !entities.has(relation.to_id)) continue;

    if (!graph.has(relation.from_id)) {
      graph.set(relation.from_id, []);
    }
    graph.get(relation.from_id)!.push(relation.to_id);
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      return true;
    }
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (dfs(neighbor, path)) return true;
    }

    path.pop();
    inStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return errors;
}
