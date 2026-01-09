/**
 * Tests for fully unified architecture where properties and values are nodes
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

describe('Fully Unified Architecture', () => {
  let ksg;
  let memory;

  beforeEach(() => {
    memory = new InMemoryMemory();
    ksg = new KnowShowGo({
      embedFn: mockEmbedFn,
      memory: memory
    });
  });

  test('should create property as a node', async () => {
    const propUuid = await ksg.createProperty({
      name: 'email',
      valueType: 'string',
      required: true,
      description: 'Email address'
    });

    const propNode = await ksg.getConcept(propUuid);
    expect(propNode).toBeDefined();
    expect(propNode.props.isProperty).toBe(true);
    expect(propNode.props.valueType).toBe('string');
    expect(propNode.props.required).toBe(true);
  });

  test('should create value as a node', async () => {
    const valueUuid = await ksg.createValueNode({
      value: 'john@example.com',
      valueType: 'string'
    });

    const valueNode = await ksg.getConcept(valueUuid);
    expect(valueNode).toBeDefined();
    expect(valueNode.props.isValue).toBe(true);
    expect(valueNode.props.literalValue).toBe('john@example.com');
  });

  test('should create concept with properties via associations', async () => {
    // Create prototype
    const personProto = await ksg.createPrototype({
      name: 'Person',
      description: 'A person',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    // Create concept with properties
    const conceptUuid = await ksg.createConceptWithProperties({
      prototypeUuid: personProto,
      properties: {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30
      },
      embedding: await mockEmbedFn('John Doe')
    });

    // Verify concept exists
    const concept = await ksg.getConcept(conceptUuid);
    expect(concept).toBeDefined();
    expect(concept.props.isConcept).toBe(true);

    // Verify properties via associations
    const properties = await ksg.getProperties(conceptUuid);
    expect(properties.email).toBe('john@example.com');
    expect(properties.age).toBe(30);
  });

  test('should create has_prop associations', async () => {
    const personProto = await ksg.createPrototype({
      name: 'Person',
      description: 'A person',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    const conceptUuid = await ksg.createConceptWithProperties({
      prototypeUuid: personProto,
      properties: {
        email: 'test@example.com'
      },
      embedding: await mockEmbedFn('Test')
    });

    // Verify has_prop association exists
    const edges = Array.from(memory.edges.values());
    const hasPropEdges = edges.filter(e => 
      e.fromNode === conceptUuid && 
      e.rel === 'has_prop'
    );

    expect(hasPropEdges.length).toBeGreaterThan(0);
  });

  test('should create has_value associations', async () => {
    const personProto = await ksg.createPrototype({
      name: 'Person',
      description: 'A person',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    const conceptUuid = await ksg.createConceptWithProperties({
      prototypeUuid: personProto,
      properties: {
        email: 'test@example.com'
      },
      embedding: await mockEmbedFn('Test')
    });

    // Verify has_value associations exist
    const edges = Array.from(memory.edges.values());
    const hasValueEdges = edges.filter(e => 
      e.rel === 'has_value'
    );

    expect(hasValueEdges.length).toBeGreaterThan(0);
  });

  test('should support typed primitive value nodes (datetime, url, node_ref)', async () => {
    // Create explicit property defs so createConceptWithProperties uses these valueType choices.
    const friendProp = await ksg.createProperty({ name: 'friend', valueType: 'node_ref' });
    const websiteProp = await ksg.createProperty({ name: 'website', valueType: 'url' });
    const createdAtProp = await ksg.createProperty({ name: 'createdAt', valueType: 'datetime' });

    expect(friendProp).toBeDefined();
    expect(websiteProp).toBeDefined();
    expect(createdAtProp).toBeDefined();

    const personProto = await ksg.createPrototype({
      name: 'Person',
      description: 'A person',
      context: 'identity',
      embedding: await mockEmbedFn('Person')
    });

    // create a referenced node (so node_ref points to a real UUID)
    const refUuid = await ksg.createConcept({
      prototypeUuid: personProto,
      jsonObj: { name: 'Ref Person' },
      embedding: await mockEmbedFn('Ref Person')
    });

    const conceptUuid = await ksg.createConceptWithProperties({
      prototypeUuid: personProto,
      properties: {
        name: 'John Doe',
        friend: refUuid,
        website: 'https://example.com/path?q=1',
        createdAt: '2024-01-01T00:00:00.000Z'
      },
      embedding: await mockEmbedFn('John Doe')
    });

    const props = await ksg.getProperties(conceptUuid);
    expect(props.friend).toBe(refUuid);
    expect(props.website).toMatch(/^https:\/\/example\.com\/path\?q=1/);
    expect(props.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});

