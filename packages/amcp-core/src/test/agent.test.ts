/**
 * Agent identity tests
 */

import { describe, it, expect } from 'vitest';
import { createAgent, loadAgent, serializeAgent, rotateKeys } from '../agent.js';
import { verifyKEL } from '../kel.js';

describe('Agent', () => {
  it('should create a new agent with valid KEL', async () => {
    const agent = await createAgent({ name: 'TestAgent' });
    
    expect(agent.aid).toMatch(/^B[A-Za-z0-9_-]+$/);
    expect(agent.name).toBe('TestAgent');
    expect(agent.kel.events).toHaveLength(1);
    expect(agent.kel.events[0].type).toBe('inception');
    
    // Verify KEL
    const valid = await verifyKEL(agent.kel);
    expect(valid).toBe(true);
  });

  it('should serialize and load an agent', async () => {
    const agent = await createAgent({ name: 'SerializeTest' });
    const serialized = serializeAgent(agent);
    const loaded = await loadAgent(serialized);
    
    expect(loaded.aid).toBe(agent.aid);
    expect(loaded.name).toBe(agent.name);
    expect(loaded.kel.events).toEqual(agent.kel.events);
  });

  it('should rotate keys correctly', async () => {
    const agent = await createAgent({ name: 'RotateTest' });
    const rotated = await rotateKeys(agent);
    
    // AID should remain the same
    expect(rotated.aid).toBe(agent.aid);
    
    // Should have two events now
    expect(rotated.kel.events).toHaveLength(2);
    expect(rotated.kel.events[1].type).toBe('rotation');
    
    // KEL should still be valid
    const valid = await verifyKEL(rotated.kel);
    expect(valid).toBe(true);
  });

  it('should maintain valid KEL after multiple rotations', async () => {
    let agent = await createAgent({ name: 'MultiRotate' });
    
    for (let i = 0; i < 5; i++) {
      agent = await rotateKeys(agent);
    }
    
    expect(agent.kel.events).toHaveLength(6); // 1 inception + 5 rotations
    
    const valid = await verifyKEL(agent.kel);
    expect(valid).toBe(true);
  });
});
