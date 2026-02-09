/**
 * AmbientContext - External environment context for agent situation awareness
 * 
 * Based on Context-Aware Computing research:
 * - Dey (2001): "Context is any information that can be used to characterize 
 *   the situation of an entity"
 * - Brown et al (1989): Situated Cognition - knowledge is tied to context
 * - Hong & Landay (2004): Privacy-aware context - user control over disclosure
 * 
 * This schema captures the situational factors that affect agent cognition
 * while providing privacy controls at collection time.
 * 
 * @module @amcp/core/types
 */

/**
 * Location context - where the entity is situated
 * Coarse-grained to preserve privacy while maintaining utility
 */
export interface LocationContext {
  /** IANA timezone identifier (e.g., "America/New_York") */
  timezone: string;
  
  /** Coarse geographic region (optional, e.g., "US-East", "Europe") */
  region?: string;
  
  /** Type of location - affects expected behavior patterns */
  type: 'home' | 'work' | 'travel' | 'unknown';
}

/**
 * Temporal context - when in the entity's day/week cycle
 * Captures rhythms that affect attention and availability
 */
export interface TemporalContext {
  /** Local time in ISO 8601 format (time portion, e.g., "14:30:00") */
  localTime: string;
  
  /** Type of day - affects expected workload and focus */
  dayType: 'workday' | 'weekend' | 'holiday';
  
  /** Whether currently within typical work hours */
  workHours: boolean;
}

/**
 * Calendar context - scheduled commitments affecting availability
 * Minimal disclosure: only what's needed for context
 */
export interface CalendarContext {
  /** Brief description of next scheduled event (optional) */
  nextEvent?: string;
  
  /** Overall schedule density - affects interruptibility */
  busyLevel: 'free' | 'light' | 'busy' | 'packed';
}

/**
 * Device context - how the entity is interacting
 * Affects expected response format and attention level
 */
export interface DeviceContext {
  /** Device type - affects UI expectations and response length */
  type: 'desktop' | 'mobile' | 'voice' | 'unknown';
  
  /** Available attention level - affects interaction depth */
  attention: 'full' | 'partial' | 'minimal';
}

/**
 * Privacy level controlling what context gets captured and stored
 * 
 * Per Hong & Landay (2004): Users must have control over disclosure.
 * This is set at capture time and determines what gets persisted.
 */
export type PrivacyLevel = 
  | 'full'    // All context captured
  | 'summary' // Aggregated/anonymized context only
  | 'none';   // No context captured

/**
 * AmbientContext - Complete situational awareness for an agent
 * 
 * Captures the external environment factors that affect cognition,
 * with privacy controls determining what gets persisted to checkpoints.
 * 
 * Usage:
 * - At checkpoint creation, capture ambient context
 * - On recovery, context helps reconstruct mental state
 * - Privacy level controls what gets stored vs discarded
 */
export interface AmbientContext {
  /** ISO 8601 timestamp when context was captured */
  timestamp: string;
  
  /** Location context (optional - may be omitted for privacy) */
  location?: LocationContext;
  
  /** Temporal context (optional) */
  temporal?: TemporalContext;
  
  /** Calendar context (optional) */
  calendar?: CalendarContext;
  
  /** Device context (optional) */
  device?: DeviceContext;
  
  /** Privacy level controlling what gets persisted */
  privacyLevel: PrivacyLevel;
}

/**
 * Filter ambient context based on privacy level
 * 
 * Per Hong & Landay (2004): Privacy filtering must happen at collection time.
 * This ensures sensitive data never enters storage.
 * 
 * @param context - Full ambient context
 * @returns Filtered context based on privacyLevel setting
 */
export function filterByPrivacy(context: AmbientContext): AmbientContext {
  switch (context.privacyLevel) {
    case 'none':
      // Return only timestamp and privacy level
      return {
        timestamp: context.timestamp,
        privacyLevel: 'none'
      };
    
    case 'summary':
      // Return anonymized/coarsened context
      return {
        timestamp: context.timestamp,
        location: context.location ? {
          timezone: context.location.timezone,
          type: context.location.type
          // Omit region for privacy
        } : undefined,
        temporal: context.temporal ? {
          localTime: context.temporal.localTime.substring(0, 2) + ':00:00', // Hour only
          dayType: context.temporal.dayType,
          workHours: context.temporal.workHours
        } : undefined,
        calendar: context.calendar ? {
          // Omit nextEvent text, keep only busy level
          busyLevel: context.calendar.busyLevel
        } : undefined,
        device: context.device ? {
          type: context.device.type,
          attention: context.device.attention
        } : undefined,
        privacyLevel: 'summary'
      };
    
    case 'full':
    default:
      // Return complete context
      return { ...context };
  }
}

/**
 * Create an AmbientContext with current timestamp
 * 
 * @param partial - Partial context data
 * @returns Complete AmbientContext with timestamp
 */
export function createAmbientContext(
  partial: Omit<AmbientContext, 'timestamp'> & { timestamp?: string }
): AmbientContext {
  return {
    timestamp: partial.timestamp ?? new Date().toISOString(),
    location: partial.location,
    temporal: partial.temporal,
    calendar: partial.calendar,
    device: partial.device,
    privacyLevel: partial.privacyLevel
  };
}

/**
 * Check if context has any meaningful data beyond metadata
 */
export function hasContextData(context: AmbientContext): boolean {
  return !!(
    context.location ||
    context.temporal ||
    context.calendar ||
    context.device
  );
}
