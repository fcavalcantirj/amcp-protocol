/**
 * Ontology entity and relation type definitions for typed graphs
 *
 * Provides TypeScript types for the AMCP ontology layer including
 * entity types, relation types, concrete entity interfaces, and
 * schema constraints.
 */

/** Supported entity types in the ontology graph */
export enum EntityType {
  Person = 'Person',
  Organization = 'Organization',
  Project = 'Project',
  Task = 'Task',
  Goal = 'Goal',
  Event = 'Event',
  Location = 'Location',
  Document = 'Document',
  Message = 'Message',
  Note = 'Note',
  Account = 'Account',
  Credential = 'Credential',
  Action = 'Action',
  Policy = 'Policy',
}

/** Supported relation types between entities */
export enum RelationType {
  has_owner = 'has_owner',
  owns = 'owns',
  has_task = 'has_task',
  part_of = 'part_of',
  member_of = 'member_of',
  blocks = 'blocks',
  depends_on = 'depends_on',
  mentions = 'mentions',
  references = 'references',
}

/** Check if a string is a valid EntityType */
export function isValidEntityType(value: string): value is EntityType {
  return Object.values(EntityType).includes(value as EntityType);
}

/** Check if a string is a valid RelationType */
export function isValidRelationType(value: string): value is RelationType {
  return Object.values(RelationType).includes(value as RelationType);
}

/** Base entity in the ontology graph */
export interface Entity {
  id: string;
  entityType: EntityType;
  properties: Record<string, unknown>;
  created: Date;
  updated: Date;
}

/** Relation between two entities */
export interface Relation {
  from_id: string;
  relation_type: RelationType;
  to_id: string;
  properties?: Record<string, unknown>;
}

/** Person entity with typed properties */
export interface PersonEntity extends Entity {
  entityType: EntityType.Person;
  properties: {
    name: string;
    email?: string;
    phone?: string;
    notes?: string;
  };
}

/** Schema constraint for an entity type */
export interface EntityConstraint {
  type: EntityType;
  required_properties: string[];
  forbidden_properties?: string[];
  acyclic_relations?: RelationType[];
}
