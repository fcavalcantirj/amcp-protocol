/**
 * AmbientContext tests
 * 
 * Tests for privacy filtering and context utilities based on:
 * - Hong & Landay (2004): Privacy-aware context disclosure
 */

import { describe, it, expect } from 'vitest';
import {
  type AmbientContext,
  filterByPrivacy,
  createAmbientContext,
  hasContextData
} from '../types/ambient-context.js';

describe('AmbientContext', () => {
  // Full context fixture for testing
  const fullContext: AmbientContext = {
    timestamp: '2026-02-09T14:30:00.000Z',
    location: {
      timezone: 'America/Sao_Paulo',
      region: 'BR-South',
      type: 'work'
    },
    temporal: {
      localTime: '11:30:00',
      dayType: 'workday',
      workHours: true
    },
    calendar: {
      nextEvent: 'Team standup in 30 minutes',
      busyLevel: 'busy'
    },
    device: {
      type: 'desktop',
      attention: 'full'
    },
    privacyLevel: 'full'
  };

  describe('filterByPrivacy', () => {
    it('should preserve all data with privacyLevel=full', () => {
      const filtered = filterByPrivacy(fullContext);
      
      expect(filtered.timestamp).toBe(fullContext.timestamp);
      expect(filtered.location).toEqual(fullContext.location);
      expect(filtered.temporal).toEqual(fullContext.temporal);
      expect(filtered.calendar).toEqual(fullContext.calendar);
      expect(filtered.device).toEqual(fullContext.device);
      expect(filtered.privacyLevel).toBe('full');
    });

    it('should strip all context with privacyLevel=none', () => {
      const context: AmbientContext = {
        ...fullContext,
        privacyLevel: 'none'
      };
      
      const filtered = filterByPrivacy(context);
      
      expect(filtered.timestamp).toBe(context.timestamp);
      expect(filtered.privacyLevel).toBe('none');
      expect(filtered.location).toBeUndefined();
      expect(filtered.temporal).toBeUndefined();
      expect(filtered.calendar).toBeUndefined();
      expect(filtered.device).toBeUndefined();
    });

    it('should coarsen data with privacyLevel=summary', () => {
      const context: AmbientContext = {
        ...fullContext,
        privacyLevel: 'summary'
      };
      
      const filtered = filterByPrivacy(context);
      
      expect(filtered.timestamp).toBe(context.timestamp);
      expect(filtered.privacyLevel).toBe('summary');
      
      // Location: should have timezone and type, but NOT region
      expect(filtered.location?.timezone).toBe('America/Sao_Paulo');
      expect(filtered.location?.type).toBe('work');
      expect(filtered.location?.region).toBeUndefined();
      
      // Temporal: time should be coarsened to hour only
      expect(filtered.temporal?.localTime).toBe('11:00:00');
      expect(filtered.temporal?.dayType).toBe('workday');
      expect(filtered.temporal?.workHours).toBe(true);
      
      // Calendar: should have busyLevel but NOT nextEvent text
      expect(filtered.calendar?.busyLevel).toBe('busy');
      expect(filtered.calendar?.nextEvent).toBeUndefined();
      
      // Device: should preserve all (not PII)
      expect(filtered.device?.type).toBe('desktop');
      expect(filtered.device?.attention).toBe('full');
    });

    it('should handle missing optional fields gracefully', () => {
      const minimalContext: AmbientContext = {
        timestamp: '2026-02-09T14:30:00.000Z',
        privacyLevel: 'summary'
      };
      
      const filtered = filterByPrivacy(minimalContext);
      
      expect(filtered.timestamp).toBe(minimalContext.timestamp);
      expect(filtered.privacyLevel).toBe('summary');
      expect(filtered.location).toBeUndefined();
      expect(filtered.temporal).toBeUndefined();
      expect(filtered.calendar).toBeUndefined();
      expect(filtered.device).toBeUndefined();
    });

    it('should not leak sensitive calendar event details in summary mode', () => {
      const contextWithSensitiveEvent: AmbientContext = {
        timestamp: '2026-02-09T14:30:00.000Z',
        calendar: {
          nextEvent: 'Doctor appointment - oncology followup',
          busyLevel: 'busy'
        },
        privacyLevel: 'summary'
      };
      
      const filtered = filterByPrivacy(contextWithSensitiveEvent);
      
      // Event text should be stripped
      expect(filtered.calendar?.nextEvent).toBeUndefined();
      // But busy level preserved (non-sensitive aggregate)
      expect(filtered.calendar?.busyLevel).toBe('busy');
    });
  });

  describe('createAmbientContext', () => {
    it('should create context with provided timestamp', () => {
      const context = createAmbientContext({
        timestamp: '2026-02-09T12:00:00.000Z',
        privacyLevel: 'full'
      });
      
      expect(context.timestamp).toBe('2026-02-09T12:00:00.000Z');
    });

    it('should auto-generate timestamp if not provided', () => {
      const before = new Date().toISOString();
      const context = createAmbientContext({
        privacyLevel: 'full'
      });
      const after = new Date().toISOString();
      
      // Timestamp should be between before and after
      expect(context.timestamp >= before).toBe(true);
      expect(context.timestamp <= after).toBe(true);
    });

    it('should include all provided fields', () => {
      const context = createAmbientContext({
        location: { timezone: 'UTC', type: 'home' },
        temporal: { localTime: '10:00:00', dayType: 'weekend', workHours: false },
        calendar: { busyLevel: 'free' },
        device: { type: 'mobile', attention: 'partial' },
        privacyLevel: 'full'
      });
      
      expect(context.location?.timezone).toBe('UTC');
      expect(context.temporal?.dayType).toBe('weekend');
      expect(context.calendar?.busyLevel).toBe('free');
      expect(context.device?.type).toBe('mobile');
    });
  });

  describe('hasContextData', () => {
    it('should return true when context has location', () => {
      const context: AmbientContext = {
        timestamp: '2026-02-09T14:30:00.000Z',
        location: { timezone: 'UTC', type: 'home' },
        privacyLevel: 'full'
      };
      
      expect(hasContextData(context)).toBe(true);
    });

    it('should return true when context has any data field', () => {
      const contexts = [
        { timestamp: 'x', location: { timezone: 'UTC', type: 'home' as const }, privacyLevel: 'full' as const },
        { timestamp: 'x', temporal: { localTime: '10:00:00', dayType: 'workday' as const, workHours: true }, privacyLevel: 'full' as const },
        { timestamp: 'x', calendar: { busyLevel: 'free' as const }, privacyLevel: 'full' as const },
        { timestamp: 'x', device: { type: 'desktop' as const, attention: 'full' as const }, privacyLevel: 'full' as const }
      ];
      
      for (const ctx of contexts) {
        expect(hasContextData(ctx)).toBe(true);
      }
    });

    it('should return false when context has only metadata', () => {
      const context: AmbientContext = {
        timestamp: '2026-02-09T14:30:00.000Z',
        privacyLevel: 'none'
      };
      
      expect(hasContextData(context)).toBe(false);
    });
  });
});
