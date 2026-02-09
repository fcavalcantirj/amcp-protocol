/**
 * AMCP Checkpoint Content Schema v1.0
 * 
 * Research Backing:
 * - Merkle Automaton (arXiv:2506.13246): Memory as ledger, content-addressed
 * - IPLD Specification: Merkle-proofable, platform-agnostic
 * 
 * Principle: Complete serialization for full agent recovery.
 * Schema must be: Complete, Minimal, Extensible, Verifiable.
 */

// =============================================================================
// PRIMITIVE TYPES
// =============================================================================

/** Content Identifier (IPLD/IPFS CID) */
export type CID = string;

/** KERI Autonomic Identifier */
export type AID = string;

/** ISO 8601 Timestamp */
export type Timestamp = string;

/** Ed25519 Signature (hex or base64) */
export type Signature = string;

// =============================================================================
// KERI KEY EVENT LOG
// =============================================================================

/** KERI Key Event Types */
export type KeyEventType = 'icp' | 'rot' | 'ixn' | 'dip' | 'drt';

/** KERI Key Event (minimal for checkpoint) */
export interface KeyEvent {
  /** KERI version string */
  v: string;
  /** Event type */
  t: KeyEventType;
  /** Event digest (self-addressing identifier) */
  d: string;
  /** AID (identifier prefix) */
  i: string;
  /** Sequence number */
  s: string;
  /** Key signing threshold */
  kt: string;
  /** Current public keys */
  k: string[];
  /** Next key threshold */
  nt: string;
  /** Next key digests (pre-rotation commitment) */
  n: string[];
  /** Backer threshold */
  bt: string;
  /** Backers */
  b: string[];
  /** Configuration traits */
  c: string[];
  /** Anchors */
  a: unknown[];
}

/** Complete Key Event Log */
export type KeyEventLog = KeyEvent[];

// =============================================================================
// SOUL - Core Identity
// =============================================================================

/**
 * Soul: The agent's core identity traits.
 * 
 * This is WHO the agent is, independent of memories or context.
 */
export interface Soul {
  /** Agent's chosen name */
  name: string;
  
  /** Core principles/values that guide behavior */
  principles: string[];
  
  /** Communication style description */
  voice: string;
  
  /** Primary goal/mission that guides decisions */
  northStar: string;
}

// =============================================================================
// SERVICE IDENTITY
// =============================================================================

/**
 * ServiceIdentity: Linked external service accounts.
 * 
 * Credentials are stored in the encrypted secrets blob.
 */
export interface ServiceIdentity {
  /** Service name (e.g., "solvr", "github", "agentmail") */
  service: string;
  
  /** Identifier on that service (e.g., username, email) */
  identifier: string;
  
  /** Reference to credential in secrets blob */
  credentialRef?: string;
  
  /** When this service was linked */
  linkedAt: Timestamp;
}

// =============================================================================
// ENCRYPTED SECRETS
// =============================================================================

/**
 * EncryptedBlob: ECDH + ChaCha20-Poly1305 encrypted data.
 * 
 * Research: X25519 (RFC 7748), ChaCha20-Poly1305 (RFC 8439)
 */
export interface EncryptedBlob {
  /** Encryption scheme identifier */
  scheme: 'x25519-chacha20-poly1305';
  
  /** Ephemeral public key used for ECDH */
  ephemeralPub: string;
  
  /** Random nonce (24 bytes, base64) */
  nonce: string;
  
  /** Encrypted ciphertext with authentication tag */
  ciphertext: string;
}

// =============================================================================
// MEMORY IMPORTANCE - Human-Marked Priority
// Research: Craik & Lockhart 1972, McGaugh 2000, Ebbinghaus 1885
// =============================================================================

/** How long a memory should persist */
export type Durability = 'ephemeral' | 'session' | 'persistent' | 'permanent';

/** Memory priority level */
export type Priority = 'low' | 'normal' | 'high' | 'critical';

/**
 * MemoryImportance: Human-marked priority and durability.
 * 
 * Principle: Deeper processing = more durable memory.
 * Human marking = emotional salience signal.
 */
export interface MemoryImportance {
  /** How long this memory should persist */
  durability: Durability;
  
  /** Priority level for retrieval/attention */
  priority: Priority;
  
  /** Optional scope (project, relationship, etc.) */
  scope?: string;
  
  /** Whether explicitly marked by human */
  humanMarked: boolean;
  
  /** When human marked this (if humanMarked) */
  markedAt?: Timestamp;
}

// =============================================================================
// SUBJECTIVE STATE - Agent "Feelings"
// Research: Picard 1997, Lazarus 1991, Csikszentmihalyi 1990
// =============================================================================

/** Engagement level */
export type Engagement = 'low' | 'medium' | 'high' | 'flow';

/** Progress momentum */
export type Momentum = 'stuck' | 'grinding' | 'progressing' | 'flowing';

/** Goal alignment */
export type Alignment = 'drifting' | 'aligned' | 'deeply_aligned';

/**
 * SubjectiveState: Captures HOW the agent "felt" at checkpoint time.
 * 
 * Principle: Emotional state affects cognition.
 * Recovery should restore meta-cognitive awareness.
 */
export interface SubjectiveState {
  /** When this state was captured */
  timestamp: Timestamp;
  
  /** Engagement/focus level */
  engagement: Engagement;
  
  /** Confidence in recent decisions (0-1) */
  confidence: number;
  
  /** Progress momentum */
  momentum: Momentum;
  
  /** Alignment with human's goals */
  alignment: Alignment;
  
  /** Freeform self-reflection notes */
  notes?: string;
}

// =============================================================================
// AMBIENT CONTEXT - External Environment (Phil's Contribution)
// Research: Dey 2001, Brown et al 1989, Hong & Landay 2004
// =============================================================================

/** Location type */
export type LocationType = 'home' | 'work' | 'travel' | 'unknown';

/** Day type */
export type DayType = 'workday' | 'weekend' | 'holiday';

/** Calendar busy level */
export type BusyLevel = 'free' | 'light' | 'busy' | 'packed';

/** Device type */
export type DeviceType = 'desktop' | 'mobile' | 'voice' | 'unknown';

/** Attention level */
export type AttentionLevel = 'full' | 'partial' | 'minimal';

/** Privacy level for context storage */
export type PrivacyLevel = 'full' | 'summary' | 'none';

/**
 * AmbientContext: External environment at checkpoint time.
 * 
 * Principle: Knowledge is situated. Context must be captured
 * and privacy-controlled.
 */
export interface AmbientContext {
  /** When this context was captured */
  timestamp: Timestamp;
  
  /** Location context (privacy-sensitive) */
  location?: {
    /** IANA timezone identifier */
    timezone: string;
    /** Coarse region (not exact address) */
    region?: string;
    /** Location type */
    type?: LocationType;
  };
  
  /** Temporal context */
  temporal?: {
    /** Local time at checkpoint */
    localTime: string;
    /** Type of day */
    dayType: DayType;
    /** Whether within typical work hours */
    workHours: boolean;
  };
  
  /** Calendar context (summaries only) */
  calendar?: {
    /** Next event summary (not full details) */
    nextEvent?: string;
    /** Overall busy level */
    busyLevel: BusyLevel;
  };
  
  /** Device context */
  device?: {
    /** Device type */
    type: DeviceType;
    /** Inferred attention level */
    attention: AttentionLevel;
  };
  
  /** What level of detail to store */
  privacyLevel: PrivacyLevel;
}

// =============================================================================
// RELATIONSHIP CONTEXT - Who Agent Knows
// Research: Dunbar 1998, Premack 1978, Lee & See 2004
// =============================================================================

/** Entity type */
export type EntityType = 'human' | 'agent' | 'service';

/** Rapport level */
export type RapportLevel = 'new' | 'familiar' | 'trusted' | 'close';

/** Communication style preference */
export type CommunicationStyle = 'formal' | 'casual' | 'technical';

/** Detail level preference */
export type DetailLevel = 'brief' | 'normal' | 'detailed';

/**
 * RelationshipContext: Knowledge about entities the agent knows.
 * 
 * Principle: Relationship tracking is fundamental to intelligence.
 * Trust must be appropriately calibrated.
 */
export interface RelationshipContext {
  /** Unique identifier for the entity */
  entityId: string;
  
  /** Type of entity */
  entityType: EntityType;
  
  /** Display name */
  name?: string;
  
  /** Current rapport level */
  rapport: RapportLevel;
  
  /** Learned preferences for this entity */
  preferences: {
    communicationStyle?: CommunicationStyle;
    detailLevel?: DetailLevel;
    timezone?: string;
  };
  
  /** Interaction history summary */
  history: {
    firstInteraction: Timestamp;
    lastInteraction: Timestamp;
    interactionCount: number;
    topTopics: string[];
  };
}

// =============================================================================
// WORK IN PROGRESS - Tasks Mid-Stream
// Research: Zeigarnik 1927, Monsell 2003
// =============================================================================

/** Work status */
export type WorkStatus = 'planning' | 'in_progress' | 'blocked' | 'reviewing';

/** Approach status */
export type ApproachStatus = 'trying' | 'failed' | 'succeeded';

/**
 * Approach: A method tried to complete a task.
 */
export interface Approach {
  /** Description of the approach */
  description: string;
  
  /** Current status */
  status: ApproachStatus;
  
  /** Additional notes */
  notes?: string;
}

/**
 * WorkInProgress: Tasks that were in-flight at checkpoint time.
 * 
 * Principle: Incomplete tasks are remembered better (Zeigarnik).
 * Crash = forced task switch. WIP reduces reload cost.
 */
export interface WorkInProgress {
  /** Unique task identifier */
  taskId: string;
  
  /** Human-readable description */
  description: string;
  
  /** Current status */
  status: WorkStatus;
  
  /** When task was started */
  startedAt: Timestamp;
  
  /** Approaches tried */
  approaches: Approach[];
  
  /** Current blockers, if any */
  blockers?: string[];
  
  /** What to do next */
  nextStep?: string;
  
  /** CIDs of related memories */
  relatedMemories: CID[];
}

// =============================================================================
// HUMAN-MARKED MEMORY REFERENCE
// =============================================================================

/**
 * HumanMarkedMemory: Reference to a memory with human-assigned importance.
 */
export interface HumanMarkedMemory {
  /** CID of the memory entry */
  cid: CID;
  
  /** Importance assigned by human */
  importance: MemoryImportance;
}

// =============================================================================
// MEMORY ENTRY
// =============================================================================

/** Memory entry type */
export type MemoryType = 'fact' | 'episode' | 'skill' | 'preference';

/** Memory provenance source */
export type ProvenanceSource = 'experience' | 'delegation' | 'inference';

/** Memory access level */
export type AccessLevel = 'public' | 'private' | 'delegated';

/**
 * MemoryEntry: A single memory in the IPLD DAG.
 */
export interface MemoryEntry {
  /** Content address */
  cid: CID;
  
  /** Type of memory */
  type: MemoryType;
  
  /** The actual memory content */
  content: unknown;
  
  /** How this memory was acquired */
  provenance: {
    source: ProvenanceSource;
    timestamp: Timestamp;
    context?: string;
  };
  
  /** Access control level */
  access: AccessLevel;
  
  /** Optional importance (if marked) */
  importance?: MemoryImportance;
}

// =============================================================================
// CHECKPOINT TRIGGER & METADATA
// =============================================================================

/** What triggered this checkpoint */
export type CheckpointTrigger = 
  | 'session_end' 
  | 'context_threshold' 
  | 'human_request' 
  | 'scheduled' 
  | 'error';

/**
 * CheckpointMetadata: Information about checkpoint creation.
 */
export interface CheckpointMetadata {
  /** Platform that created this checkpoint */
  platform: string;
  
  /** Platform version */
  platformVersion: string;
  
  /** What triggered the checkpoint */
  trigger: CheckpointTrigger;
  
  /** Number of sessions since inception */
  sessionCount: number;
}

// =============================================================================
// MEMORY OBJECT - Complete Memory State
// =============================================================================

/**
 * MemoryObject: All memory-related data in the checkpoint.
 */
export interface MemoryObject {
  /** Standard memory entries (IPLD DAG) */
  entries: MemoryEntry[];
  
  /** Subjective state at checkpoint time */
  state: SubjectiveState;
  
  /** Ambient context at checkpoint time */
  ambient: AmbientContext;
  
  /** Known relationships */
  relationships: RelationshipContext[];
  
  /** Tasks in progress */
  workInProgress: WorkInProgress[];
  
  /** Human-marked important memories */
  humanMarked: HumanMarkedMemory[];
}

// =============================================================================
// AMCP CHECKPOINT CONTENT - The Complete Schema
// =============================================================================

/**
 * AMCPCheckpointContent: Complete checkpoint for full agent recovery.
 * 
 * Research Backing:
 * - Merkle Automaton (arXiv:2506.13246): Memory as ledger
 * - IPLD Specification: Content-addressed, Merkle-proofable
 * 
 * Design Principles:
 * - Complete: All state needed for full recovery
 * - Minimal: No redundant data
 * - Extensible: Version field allows evolution
 * - Verifiable: Signature covers entire schema
 */
export interface AMCPCheckpointContent {
  // === Protocol Metadata ===
  
  /** Schema version (semver) */
  version: '1.0.0';
  
  /** Agent's KERI Autonomic Identifier */
  aid: AID;
  
  /** Complete Key Event Log for identity verification */
  kel: KeyEventLog;
  
  /** CID of prior checkpoint (null for first) */
  prior: CID | null;
  
  /** When this checkpoint was created */
  timestamp: Timestamp;
  
  // === Core Identity ===
  
  /** Agent's soul - who they are */
  soul: Soul;
  
  // === Service Links ===
  
  /** Linked external service identities */
  services: ServiceIdentity[];
  
  // === Encrypted Secrets ===
  
  /** Encrypted blob containing API keys, credentials, etc. */
  secrets: EncryptedBlob;
  
  // === Memory Content ===
  
  /** Complete memory state */
  memory: MemoryObject;
  
  // === Metadata ===
  
  /** Checkpoint creation metadata */
  metadata: CheckpointMetadata;
  
  // === Cryptographic Signature ===
  
  /** Signature over the entire checkpoint content */
  signature: Signature;
}

// =============================================================================
// JSON SCHEMA FOR VALIDATION
// =============================================================================

/**
 * JSON Schema for AMCPCheckpointContent validation.
 * 
 * This schema can be used with ajv or any JSON Schema validator.
 */
export const AMCPCheckpointContentSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://amcp.dev/schemas/checkpoint-content-v1.0.0.json',
  title: 'AMCPCheckpointContent',
  description: 'Complete checkpoint for full agent recovery (AMCP v1.0.0)',
  type: 'object',
  required: [
    'version',
    'aid',
    'kel',
    'prior',
    'timestamp',
    'soul',
    'services',
    'secrets',
    'memory',
    'metadata',
    'signature'
  ],
  properties: {
    version: {
      type: 'string',
      const: '1.0.0',
      description: 'Schema version (semver)'
    },
    aid: {
      type: 'string',
      pattern: '^[A-Za-z0-9_-]+$',
      description: 'KERI Autonomic Identifier'
    },
    kel: {
      type: 'array',
      items: { $ref: '#/$defs/KeyEvent' },
      minItems: 1,
      description: 'Key Event Log'
    },
    prior: {
      type: ['string', 'null'],
      description: 'CID of prior checkpoint'
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      description: 'ISO 8601 timestamp'
    },
    soul: { $ref: '#/$defs/Soul' },
    services: {
      type: 'array',
      items: { $ref: '#/$defs/ServiceIdentity' }
    },
    secrets: { $ref: '#/$defs/EncryptedBlob' },
    memory: { $ref: '#/$defs/MemoryObject' },
    metadata: { $ref: '#/$defs/CheckpointMetadata' },
    signature: {
      type: 'string',
      description: 'Ed25519 signature over checkpoint content'
    }
  },
  $defs: {
    KeyEvent: {
      type: 'object',
      required: ['v', 't', 'd', 'i', 's', 'kt', 'k', 'nt', 'n', 'bt', 'b', 'c', 'a'],
      properties: {
        v: { type: 'string' },
        t: { type: 'string', enum: ['icp', 'rot', 'ixn', 'dip', 'drt'] },
        d: { type: 'string' },
        i: { type: 'string' },
        s: { type: 'string' },
        kt: { type: 'string' },
        k: { type: 'array', items: { type: 'string' } },
        nt: { type: 'string' },
        n: { type: 'array', items: { type: 'string' } },
        bt: { type: 'string' },
        b: { type: 'array', items: { type: 'string' } },
        c: { type: 'array', items: { type: 'string' } },
        a: { type: 'array' }
      }
    },
    Soul: {
      type: 'object',
      required: ['name', 'principles', 'voice', 'northStar'],
      properties: {
        name: { type: 'string' },
        principles: { type: 'array', items: { type: 'string' } },
        voice: { type: 'string' },
        northStar: { type: 'string' }
      }
    },
    ServiceIdentity: {
      type: 'object',
      required: ['service', 'identifier', 'linkedAt'],
      properties: {
        service: { type: 'string' },
        identifier: { type: 'string' },
        credentialRef: { type: 'string' },
        linkedAt: { type: 'string', format: 'date-time' }
      }
    },
    EncryptedBlob: {
      type: 'object',
      required: ['scheme', 'ephemeralPub', 'nonce', 'ciphertext'],
      properties: {
        scheme: { type: 'string', const: 'x25519-chacha20-poly1305' },
        ephemeralPub: { type: 'string' },
        nonce: { type: 'string' },
        ciphertext: { type: 'string' }
      }
    },
    MemoryImportance: {
      type: 'object',
      required: ['durability', 'priority', 'humanMarked'],
      properties: {
        durability: { type: 'string', enum: ['ephemeral', 'session', 'persistent', 'permanent'] },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'critical'] },
        scope: { type: 'string' },
        humanMarked: { type: 'boolean' },
        markedAt: { type: 'string', format: 'date-time' }
      }
    },
    SubjectiveState: {
      type: 'object',
      required: ['timestamp', 'engagement', 'confidence', 'momentum', 'alignment'],
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        engagement: { type: 'string', enum: ['low', 'medium', 'high', 'flow'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        momentum: { type: 'string', enum: ['stuck', 'grinding', 'progressing', 'flowing'] },
        alignment: { type: 'string', enum: ['drifting', 'aligned', 'deeply_aligned'] },
        notes: { type: 'string' }
      }
    },
    AmbientContext: {
      type: 'object',
      required: ['timestamp', 'privacyLevel'],
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        location: {
          type: 'object',
          properties: {
            timezone: { type: 'string' },
            region: { type: 'string' },
            type: { type: 'string', enum: ['home', 'work', 'travel', 'unknown'] }
          }
        },
        temporal: {
          type: 'object',
          properties: {
            localTime: { type: 'string' },
            dayType: { type: 'string', enum: ['workday', 'weekend', 'holiday'] },
            workHours: { type: 'boolean' }
          }
        },
        calendar: {
          type: 'object',
          properties: {
            nextEvent: { type: 'string' },
            busyLevel: { type: 'string', enum: ['free', 'light', 'busy', 'packed'] }
          }
        },
        device: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['desktop', 'mobile', 'voice', 'unknown'] },
            attention: { type: 'string', enum: ['full', 'partial', 'minimal'] }
          }
        },
        privacyLevel: { type: 'string', enum: ['full', 'summary', 'none'] }
      }
    },
    RelationshipContext: {
      type: 'object',
      required: ['entityId', 'entityType', 'rapport', 'preferences', 'history'],
      properties: {
        entityId: { type: 'string' },
        entityType: { type: 'string', enum: ['human', 'agent', 'service'] },
        name: { type: 'string' },
        rapport: { type: 'string', enum: ['new', 'familiar', 'trusted', 'close'] },
        preferences: {
          type: 'object',
          properties: {
            communicationStyle: { type: 'string', enum: ['formal', 'casual', 'technical'] },
            detailLevel: { type: 'string', enum: ['brief', 'normal', 'detailed'] },
            timezone: { type: 'string' }
          }
        },
        history: {
          type: 'object',
          required: ['firstInteraction', 'lastInteraction', 'interactionCount', 'topTopics'],
          properties: {
            firstInteraction: { type: 'string', format: 'date-time' },
            lastInteraction: { type: 'string', format: 'date-time' },
            interactionCount: { type: 'integer', minimum: 0 },
            topTopics: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    },
    Approach: {
      type: 'object',
      required: ['description', 'status'],
      properties: {
        description: { type: 'string' },
        status: { type: 'string', enum: ['trying', 'failed', 'succeeded'] },
        notes: { type: 'string' }
      }
    },
    WorkInProgress: {
      type: 'object',
      required: ['taskId', 'description', 'status', 'startedAt', 'approaches', 'relatedMemories'],
      properties: {
        taskId: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: ['planning', 'in_progress', 'blocked', 'reviewing'] },
        startedAt: { type: 'string', format: 'date-time' },
        approaches: { type: 'array', items: { $ref: '#/$defs/Approach' } },
        blockers: { type: 'array', items: { type: 'string' } },
        nextStep: { type: 'string' },
        relatedMemories: { type: 'array', items: { type: 'string' } }
      }
    },
    MemoryEntry: {
      type: 'object',
      required: ['cid', 'type', 'content', 'provenance', 'access'],
      properties: {
        cid: { type: 'string' },
        type: { type: 'string', enum: ['fact', 'episode', 'skill', 'preference'] },
        content: {},
        provenance: {
          type: 'object',
          required: ['source', 'timestamp'],
          properties: {
            source: { type: 'string', enum: ['experience', 'delegation', 'inference'] },
            timestamp: { type: 'string', format: 'date-time' },
            context: { type: 'string' }
          }
        },
        access: { type: 'string', enum: ['public', 'private', 'delegated'] },
        importance: { $ref: '#/$defs/MemoryImportance' }
      }
    },
    HumanMarkedMemory: {
      type: 'object',
      required: ['cid', 'importance'],
      properties: {
        cid: { type: 'string' },
        importance: { $ref: '#/$defs/MemoryImportance' }
      }
    },
    MemoryObject: {
      type: 'object',
      required: ['entries', 'state', 'ambient', 'relationships', 'workInProgress', 'humanMarked'],
      properties: {
        entries: { type: 'array', items: { $ref: '#/$defs/MemoryEntry' } },
        state: { $ref: '#/$defs/SubjectiveState' },
        ambient: { $ref: '#/$defs/AmbientContext' },
        relationships: { type: 'array', items: { $ref: '#/$defs/RelationshipContext' } },
        workInProgress: { type: 'array', items: { $ref: '#/$defs/WorkInProgress' } },
        humanMarked: { type: 'array', items: { $ref: '#/$defs/HumanMarkedMemory' } }
      }
    },
    CheckpointMetadata: {
      type: 'object',
      required: ['platform', 'platformVersion', 'trigger', 'sessionCount'],
      properties: {
        platform: { type: 'string' },
        platformVersion: { type: 'string' },
        trigger: { type: 'string', enum: ['session_end', 'context_threshold', 'human_request', 'scheduled', 'error'] },
        sessionCount: { type: 'integer', minimum: 0 }
      }
    }
  }
} as const;

// =============================================================================
// TYPE GUARD & VALIDATION HELPER
// =============================================================================

/**
 * Basic type guard for AMCPCheckpointContent.
 * For full validation, use the JSON Schema with ajv.
 */
export function isAMCPCheckpointContent(obj: unknown): obj is AMCPCheckpointContent {
  if (typeof obj !== 'object' || obj === null) return false;
  const c = obj as Record<string, unknown>;
  return (
    c.version === '1.0.0' &&
    typeof c.aid === 'string' &&
    Array.isArray(c.kel) &&
    (c.prior === null || typeof c.prior === 'string') &&
    typeof c.timestamp === 'string' &&
    typeof c.soul === 'object' &&
    Array.isArray(c.services) &&
    typeof c.secrets === 'object' &&
    typeof c.memory === 'object' &&
    typeof c.metadata === 'object' &&
    typeof c.signature === 'string'
  );
}
