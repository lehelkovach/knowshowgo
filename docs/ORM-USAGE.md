# KnowShowGo ORM Usage Guide

## Overview

The ORM provides JavaScript prototype-based object mapping with:
- **Prototype-based objects** (JavaScript-style)
- **Lazy property loading** from associated nodes
- **Cached JSON documents** for fast access
- **Query by prototype** interface

## Quick Start

### 1. Register a Prototype

```javascript
import { KnowShowGo, InMemoryMemory } from 'knowshowgo';

const ksg = new KnowShowGo({
  embedFn: async (text) => await yourEmbeddingService(text),
  memory: new InMemoryMemory()
});

// Register Person prototype
const Person = await ksg.orm.registerPrototype('Person', {
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true },
    age: { type: 'number' }
  },
  description: 'A human individual'
});

// Person is now a JavaScript class!
```

### 2. Create Instances

```javascript
// Create via ORM
const john = await Person.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Automatically:
// ✅ Creates concept node
// ✅ Creates property nodes (name, email, age)
// ✅ Creates value nodes ('John Doe', 'john@example.com', 30)
// ✅ Creates associations (has_prop, has_value)
// ✅ Generates cached JSON document
// ✅ Returns Person instance
```

### 3. Access Properties (Lazy Loading)

```javascript
// Properties are lazy-loaded from associated nodes
console.log(john.name);   // Loads from has_value associations
console.log(john.email);  // Loads from has_value associations
console.log(john.age);    // Loads from has_value associations

// First access:
// 1. Checks cache
// 2. Checks cached document
// 3. Queries has_value associations
// 4. Loads value node
// 5. Caches in object
// 6. Updates cached document
```

### 4. Update Properties

```javascript
// Update property
john.email = 'newemail@example.com';
john.age = 31;

// Save updates nodes and document
await john.save();

// Automatically:
// ✅ Updates value nodes
// ✅ Updates associations
// ✅ Updates cached JSON document (version++)
```

### 5. Query by Prototype

```javascript
// Find all Person instances
const people = await Person.find();

// Find one by properties
const john = await Person.findOne({ email: 'john@example.com' });

// Find by embedding similarity
const similar = await Person.findSimilar('person named John');
```

### 6. Get Plain Object

```javascript
// Get flattened JSON representation
const json = await john.toJSON();
// {
//   uuid: 'concept-123',
//   name: 'John Doe',
//   email: 'john@example.com',
//   age: 30
// }
```

## Cached JSON Document

### Structure

Each concept has a linked document node:

```javascript
{
  uuid: 'doc-123',
  kind: 'topic',
  props: {
    isDocument: true,
    conceptUuid: 'concept-123',
    data: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    },
    version: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
}
```

### Linked via Association

```
Concept --[has_document]--> Document
```

### Automatic Updates

- Document updated when properties change
- Version incremented on each update
- Timestamp tracked
- Embedding updated for searchability

## Lazy Loading Flow

```
Access: john.name
  ↓
1. Check _cache['name']
  ↓ (if not found)
2. Check _documentCache['name']
  ↓ (if not found)
3. Query has_value associations (propertyName='name')
  ↓
4. Load value node
  ↓
5. Cache in _cache['name']
  ↓
6. Update _documentCache['name']
  ↓
7. Return value
```

## Multiple Inheritance

```javascript
// Register parent prototypes
const Person = await ksg.orm.registerPrototype('Person', {
  properties: { name: 'string', age: 'number' }
});

const Employee = await ksg.orm.registerPrototype('Employee', {
  properties: { employeeId: 'string', department: 'string' }
});

// Register child with multiple parents
const Manager = await ksg.orm.registerPrototype('Manager', {
  properties: { teamSize: 'number' },
  parentPrototypes: ['Person', 'Employee']  // Multiple inheritance
});

// Manager instances have all properties
const manager = await Manager.create({
  name: 'Jane',
  age: 35,
  employeeId: 'E123',
  department: 'Engineering',
  teamSize: 5
});
```

## Benefits

1. **JavaScript-style OOP**: Use `new Person()` and `person.name`
2. **Lazy Loading**: Properties loaded on-demand from graph
3. **Cached Performance**: JSON document for fast access
4. **Automatic Updates**: Changes update nodes and document
5. **Query Interface**: `Person.find()`, `Person.findOne()`
6. **Type Safety**: Properties typed via prototype registration
7. **Multiple Inheritance**: True multiple inheritance support

## Architecture

```
ORM Layer
  ↓
KnowShowGo API
  ↓
Memory Backend
  ↓
Graph Storage (Nodes + Associations)
```

## Example: Complete Workflow

```javascript
// 1. Register prototype
const Person = await ksg.orm.registerPrototype('Person', {
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true }
  }
});

// 2. Create instance
const john = await Person.create({
  name: 'John Doe',
  email: 'john@example.com'
});

// 3. Access properties (lazy loaded)
console.log(john.name);   // 'John Doe'
console.log(john.email);  // 'john@example.com'

// 4. Update property
john.email = 'newemail@example.com';
await john.save();

// 5. Query
const found = await Person.findOne({ email: 'newemail@example.com' });
console.log(found.name);  // 'John Doe'

// 6. Get JSON
const json = await john.toJSON();
// { uuid: '...', name: 'John Doe', email: 'newemail@example.com' }
```

