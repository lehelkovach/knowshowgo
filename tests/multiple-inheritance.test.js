/**
 * Tests for multiple inheritance via "is_a" associations
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';

// Mock embedding function
const mockEmbedFn = async (text) => {
  const vec = new Array(128).fill(0);
  for (let i = 0; i < Math.min(text.length, 128); i++) {
    vec[i] = text.charCodeAt(i) / 1000;
  }
  return vec;
};

describe('Multiple Inheritance via is_a', () => {
  let ksg;
  let memory;

  beforeEach(() => {
    memory = new InMemoryMemory();
    ksg = new KnowShowGo({
      embedFn: mockEmbedFn,
      memory: memory
    });
  });

  test('should support multiple inheritance via parentPrototypeUuids', async () => {
    // Create parent prototypes
    const personProto = await ksg.createPrototype({
      name: 'Person',
      description: 'A human individual',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    const employeeProto = await ksg.createPrototype({
      name: 'Employee',
      description: 'A person who works',
      context: 'work',
      embedding: await mockEmbedFn('Employee')
    });

    // Create child prototype with multiple parents
    const managerProto = await ksg.createPrototype({
      name: 'Manager',
      description: 'A person who manages employees',
      context: 'work',
      embedding: await mockEmbedFn('Manager'),
      parentPrototypeUuids: [personProto, employeeProto]  // Multiple inheritance
    });

    // Verify multiple "is_a" associations exist
    const edges = Array.from(memory.edges.values());
    const isAEdges = edges.filter(e => e.rel === 'is_a' && e.fromNode === managerProto);
    
    expect(isAEdges.length).toBe(2);
    expect(isAEdges.some(e => e.toNode === personProto)).toBe(true);
    expect(isAEdges.some(e => e.toNode === employeeProto)).toBe(true);
  });

  test('should support backward compatibility with basePrototypeUuid', async () => {
    const parentProto = await ksg.createPrototype({
      name: 'Parent',
      description: 'Parent prototype',
      context: 'test',
      embedding: await mockEmbedFn('Parent')
    });

    const childProto = await ksg.createPrototype({
      name: 'Child',
      description: 'Child prototype',
      context: 'test',
      embedding: await mockEmbedFn('Child'),
      basePrototypeUuid: parentProto  // Backward compat
    });

    // Should create both "is_a" association and "inherits" edge
    const edges = Array.from(memory.edges.values());
    const isAEdges = edges.filter(e => e.rel === 'is_a' && e.fromNode === childProto);
    const inheritsEdges = edges.filter(e => e.rel === 'inherits' && e.fromNode === childProto);
    
    expect(isAEdges.length).toBe(1);
    expect(inheritsEdges.length).toBe(1);
    expect(isAEdges[0].toNode).toBe(parentProto);
  });

  test('should support both basePrototypeUuid and parentPrototypeUuids', async () => {
    const parent1 = await ksg.createPrototype({
      name: 'Parent1',
      description: 'Parent 1',
      context: 'test',
      embedding: await mockEmbedFn('Parent1')
    });

    const parent2 = await ksg.createPrototype({
      name: 'Parent2',
      description: 'Parent 2',
      context: 'test',
      embedding: await mockEmbedFn('Parent2')
    });

    const child = await ksg.createPrototype({
      name: 'Child',
      description: 'Child',
      context: 'test',
      embedding: await mockEmbedFn('Child'),
      basePrototypeUuid: parent1,  // Backward compat
      parentPrototypeUuids: [parent2]  // Additional parent
    });

    // Should have both parents via "is_a"
    const edges = Array.from(memory.edges.values());
    const isAEdges = edges.filter(e => e.rel === 'is_a' && e.fromNode === child);
    
    expect(isAEdges.length).toBe(2);
    expect(isAEdges.some(e => e.toNode === parent1)).toBe(true);
    expect(isAEdges.some(e => e.toNode === parent2)).toBe(true);
  });
});

