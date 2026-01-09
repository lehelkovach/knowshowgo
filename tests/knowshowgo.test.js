/**
 * Tests for KnowShowGo
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';
import { Node, Edge, Provenance } from '../src/models.js';

// Mock embedding function
const mockEmbedFn = async (text) => {
  // Simple mock: return a vector based on text length
  const vec = new Array(128).fill(0);
  for (let i = 0; i < Math.min(text.length, 128); i++) {
    vec[i] = text.charCodeAt(i) / 1000;
  }
  return vec;
};

describe('KnowShowGo', () => {
  let ksg;
  let memory;

  beforeEach(() => {
    memory = new InMemoryMemory();
    ksg = new KnowShowGo({
      embedFn: mockEmbedFn,
      memory: memory
    });
  });

  test('should create a prototype', async () => {
    const protoUuid = await ksg.createPrototype({
      name: 'Person',
      description: 'A human individual',
      context: 'identity',
      labels: ['person', 'human'],
      embedding: await mockEmbedFn('Person human individual')
    });

    expect(protoUuid).toBeDefined();
    const node = await memory.getNode(protoUuid);
    expect(node).toBeDefined();
    expect(node.props.isPrototype).toBe(true);
    expect(node.props.label).toBe('Person');
  });

  test('should create a concept', async () => {
    // First create prototype
    const protoUuid = await ksg.createPrototype({
      name: 'Person',
      description: 'A human individual',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    // Then create concept
    const conceptUuid = await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: {
        name: 'John Doe',
        email: 'john@example.com'
      },
      embedding: await mockEmbedFn('John Doe person')
    });

    expect(conceptUuid).toBeDefined();
    const node = await memory.getNode(conceptUuid);
    expect(node).toBeDefined();
    expect(node.props.isPrototype).toBe(false);
    expect(node.props.name).toBe('John Doe');
  });

  test('should create versioned concepts', async () => {
    const protoUuid = await ksg.createPrototype({
      name: 'Procedure',
      description: 'A procedure',
      context: 'automation',
      embedding: await mockEmbedFn('Procedure')
    });

    const v1Uuid = await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: { name: 'LoginV1', steps: ['step1'] },
      embedding: await mockEmbedFn('LoginV1')
    });

    const v2Uuid = await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: { name: 'LoginV2', steps: ['step1', 'step2'] },
      embedding: await mockEmbedFn('LoginV2'),
      previousVersionUuid: v1Uuid
    });

    // Check version edge exists
    const edges = Array.from(memory.edges.values());
    const versionEdge = edges.find(e => e.rel === 'next_version');
    expect(versionEdge).toBeDefined();
    expect(versionEdge.fromNode).toBe(v1Uuid);
    expect(versionEdge.toNode).toBe(v2Uuid);
  });

  test('should search for concepts', async () => {
    const protoUuid = await ksg.createPrototype({
      name: 'Person',
      description: 'A human individual',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: { name: 'John Doe' },
      embedding: await mockEmbedFn('John Doe person')
    });

    await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: { name: 'Jane Smith' },
      embedding: await mockEmbedFn('Jane Smith person')
    });

    const results = await ksg.searchConcepts({
      query: 'person named John',
      topK: 5
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].props.name).toBe('John Doe');
  });

  test('should add associations', async () => {
    const protoUuid = await ksg.createPrototype({
      name: 'Person',
      description: 'A human individual',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    const person1 = await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: { name: 'Alice' },
      embedding: await mockEmbedFn('Alice')
    });

    const person2 = await ksg.createConcept({
      prototypeUuid: protoUuid,
      jsonObj: { name: 'Bob' },
      embedding: await mockEmbedFn('Bob')
    });

    await ksg.addAssociation({
      fromConceptUuid: person1,
      toConceptUuid: person2,
      relationType: 'knows',
      strength: 0.8
    });

    const edges = Array.from(memory.edges.values());
    const knowsEdge = edges.find(e => e.rel === 'knows');
    expect(knowsEdge).toBeDefined();
    expect(knowsEdge.props.w).toBe(0.8);
  });
});

