/**
 * Ontology entity and relation type tests
 *
 * Verifies TypeScript type definitions for the ontology typed graph layer,
 * including EntityType enum, RelationType enum, Entity/Relation interfaces,
 * concrete entity types, and schema constraints.
 */

import { describe, it, expect } from 'vitest';
import {
  EntityType,
  RelationType,
  type Entity,
  type Relation,
  type PersonEntity,
  type EntityConstraint,
  isValidEntityType,
  isValidRelationType,
} from '../src/ontology-types.js';

describe('EntityType enum', () => {
  it('contains all required entity types', () => {
    expect(EntityType.Person).toBe('Person');
    expect(EntityType.Organization).toBe('Organization');
    expect(EntityType.Project).toBe('Project');
    expect(EntityType.Task).toBe('Task');
    expect(EntityType.Goal).toBe('Goal');
    expect(EntityType.Event).toBe('Event');
    expect(EntityType.Location).toBe('Location');
    expect(EntityType.Document).toBe('Document');
    expect(EntityType.Message).toBe('Message');
    expect(EntityType.Note).toBe('Note');
    expect(EntityType.Account).toBe('Account');
    expect(EntityType.Credential).toBe('Credential');
    expect(EntityType.Action).toBe('Action');
    expect(EntityType.Policy).toBe('Policy');
  });

  it('has exactly 14 values', () => {
    const values = Object.values(EntityType);
    expect(values).toHaveLength(14);
  });
});

describe('RelationType enum', () => {
  it('contains all required relation types', () => {
    expect(RelationType.has_owner).toBe('has_owner');
    expect(RelationType.owns).toBe('owns');
    expect(RelationType.has_task).toBe('has_task');
    expect(RelationType.part_of).toBe('part_of');
    expect(RelationType.member_of).toBe('member_of');
    expect(RelationType.blocks).toBe('blocks');
    expect(RelationType.depends_on).toBe('depends_on');
    expect(RelationType.mentions).toBe('mentions');
    expect(RelationType.references).toBe('references');
  });

  it('has exactly 9 values', () => {
    const values = Object.values(RelationType);
    expect(values).toHaveLength(9);
  });
});

describe('isValidEntityType', () => {
  it('accepts valid entity types', () => {
    expect(isValidEntityType('Person')).toBe(true);
    expect(isValidEntityType('Task')).toBe(true);
    expect(isValidEntityType('Policy')).toBe(true);
  });

  it('rejects invalid entity types', () => {
    expect(isValidEntityType('InvalidType')).toBe(false);
    expect(isValidEntityType('')).toBe(false);
    expect(isValidEntityType('person')).toBe(false); // case-sensitive
  });
});

describe('isValidRelationType', () => {
  it('accepts valid relation types', () => {
    expect(isValidRelationType('has_owner')).toBe(true);
    expect(isValidRelationType('blocks')).toBe(true);
    expect(isValidRelationType('references')).toBe(true);
  });

  it('rejects invalid relation types', () => {
    expect(isValidRelationType('invalid')).toBe(false);
    expect(isValidRelationType('')).toBe(false);
    expect(isValidRelationType('HAS_OWNER')).toBe(false); // case-sensitive
  });
});

describe('Entity interface', () => {
  it('accepts a valid entity object', () => {
    const entity: Entity = {
      id: 'entity-001',
      entityType: EntityType.Person,
      properties: { name: 'Alice' },
      created: new Date('2026-02-18'),
      updated: new Date('2026-02-18'),
    };

    expect(entity.id).toBe('entity-001');
    expect(entity.entityType).toBe(EntityType.Person);
    expect(entity.properties.name).toBe('Alice');
    expect(entity.created).toBeInstanceOf(Date);
    expect(entity.updated).toBeInstanceOf(Date);
  });

  it('allows arbitrary properties', () => {
    const entity: Entity = {
      id: 'entity-002',
      entityType: EntityType.Task,
      properties: { title: 'Fix bug', priority: 5, tags: ['urgent'] },
      created: new Date(),
      updated: new Date(),
    };

    expect(entity.properties.title).toBe('Fix bug');
    expect(entity.properties.priority).toBe(5);
    expect(entity.properties.tags).toEqual(['urgent']);
  });
});

describe('Relation interface', () => {
  it('accepts a valid relation object', () => {
    const relation: Relation = {
      from_id: 'entity-001',
      relation_type: RelationType.owns,
      to_id: 'entity-002',
    };

    expect(relation.from_id).toBe('entity-001');
    expect(relation.relation_type).toBe(RelationType.owns);
    expect(relation.to_id).toBe('entity-002');
  });

  it('accepts optional properties on relation', () => {
    const relation: Relation = {
      from_id: 'entity-001',
      relation_type: RelationType.blocks,
      to_id: 'entity-002',
      properties: { reason: 'dependency conflict', severity: 'high' },
    };

    expect(relation.properties?.reason).toBe('dependency conflict');
    expect(relation.properties?.severity).toBe('high');
  });

  it('omits properties when not provided', () => {
    const relation: Relation = {
      from_id: 'e1',
      relation_type: RelationType.depends_on,
      to_id: 'e2',
    };

    expect(relation.properties).toBeUndefined();
  });
});

describe('PersonEntity concrete type', () => {
  it('has entityType fixed to Person', () => {
    const person: PersonEntity = {
      id: 'person-001',
      entityType: EntityType.Person,
      properties: { name: 'Bob' },
      created: new Date(),
      updated: new Date(),
    };

    expect(person.entityType).toBe(EntityType.Person);
    expect(person.properties.name).toBe('Bob');
  });

  it('accepts optional email, phone, notes', () => {
    const person: PersonEntity = {
      id: 'person-002',
      entityType: EntityType.Person,
      properties: {
        name: 'Charlie',
        email: 'charlie@example.com',
        phone: '+1-555-0123',
        notes: 'VIP contact',
      },
      created: new Date(),
      updated: new Date(),
    };

    expect(person.properties.email).toBe('charlie@example.com');
    expect(person.properties.phone).toBe('+1-555-0123');
    expect(person.properties.notes).toBe('VIP contact');
  });
});

describe('EntityConstraint interface', () => {
  it('defines required properties for an entity type', () => {
    const constraint: EntityConstraint = {
      type: EntityType.Person,
      required_properties: ['name'],
    };

    expect(constraint.type).toBe(EntityType.Person);
    expect(constraint.required_properties).toContain('name');
  });

  it('supports forbidden properties', () => {
    const constraint: EntityConstraint = {
      type: EntityType.Credential,
      required_properties: ['service'],
      forbidden_properties: ['password', 'secret'],
    };

    expect(constraint.forbidden_properties).toContain('password');
    expect(constraint.forbidden_properties).toContain('secret');
  });

  it('supports acyclic relation declarations', () => {
    const constraint: EntityConstraint = {
      type: EntityType.Task,
      required_properties: ['title'],
      acyclic_relations: [RelationType.blocks, RelationType.depends_on],
    };

    expect(constraint.acyclic_relations).toContain(RelationType.blocks);
    expect(constraint.acyclic_relations).toContain(RelationType.depends_on);
  });
});
