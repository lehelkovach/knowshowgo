/**
 * Tests for KnowShowGo ORM
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

describe('KnowShowGo ORM', () => {
  let ksg;
  let memory;

  beforeEach(() => {
    memory = new InMemoryMemory();
    ksg = new KnowShowGo({
      embedFn: mockEmbedFn,
      memory: memory
    });
  });

  test('should register a prototype and create JavaScript class', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        age: { type: 'number' }
      },
      description: 'A human individual'
    });

    expect(Person).toBeDefined();
    expect(Person.prototypeName).toBe('Person');
    expect(typeof Person.create).toBe('function');
    expect(typeof Person.find).toBe('function');
  });

  test('should create instance via ORM', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    });

    const john = await Person.create({
      name: 'John Doe',
      email: 'john@example.com'
    });

    expect(john).toBeDefined();
    expect(john._conceptUuid).toBeDefined();
  });

  test('should lazy load properties from associated nodes', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    });

    const john = await Person.create({
      name: 'John Doe',
      email: 'john@example.com'
    });

    // Properties should be cached after creation
    expect(john.name).toBe('John Doe');
    expect(john.email).toBe('john@example.com');
  });

  test('should update cached JSON document', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    });

    const john = await Person.create({
      name: 'John Doe',
      email: 'john@example.com'
    });

    // Verify document node exists
    const edges = Array.from(memory.edges.values());
    const docEdge = edges.find(e =>
      e.fromNode === john._conceptUuid &&
      e.rel === 'has_document'
    );

    expect(docEdge).toBeDefined();

    // Verify document node has data
    const docNode = await memory.getNode(docEdge.toNode);
    expect(docNode).toBeDefined();
    expect(docNode.props.isDocument).toBe(true);
    expect(docNode.props.data).toBeDefined();
    expect(docNode.props.data.name).toBe('John Doe');
  });

  test('should update document when property changes', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    });

    const john = await Person.create({
      name: 'John Doe',
      email: 'john@example.com'
    });

    // Update property
    john.email = 'newemail@example.com';
    await john.save();

    // Verify document updated
    const edges = Array.from(memory.edges.values());
    const docEdge = edges.find(e =>
      e.fromNode === john._conceptUuid &&
      e.rel === 'has_document'
    );
    const docNode = await memory.getNode(docEdge.toNode);
    expect(docNode.props.data.email).toBe('newemail@example.com');
    expect(docNode.props.version).toBe(2);
  });

  test('should find instances by prototype', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    });

    await Person.create({ name: 'John', email: 'john@example.com' });
    await Person.create({ name: 'Jane', email: 'jane@example.com' });

    const people = await Person.find();
    expect(people.length).toBeGreaterThanOrEqual(2);
  });

  test('should find one instance by properties', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' }
      }
    });

    await Person.create({ name: 'John', email: 'john@example.com' });
    await Person.create({ name: 'Jane', email: 'jane@example.com' });

    const john = await Person.findOne({ email: 'john@example.com' });
    expect(john).toBeDefined();
    expect(john.email).toBe('john@example.com');
  });

  test('should support toJSON for plain object representation', async () => {
    const Person = await ksg.orm.registerPrototype('Person', {
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' }
      }
    });

    const john = await Person.create({
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    });

    const json = await john.toJSON();
    expect(json.uuid).toBe(john._conceptUuid);
    expect(json.name).toBe('John Doe');
    expect(json.email).toBe('john@example.com');
    expect(json.age).toBe(30);
  });
});

