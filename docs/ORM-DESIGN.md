# KnowShowGo ORM Design

## Overview

The ORM provides JavaScript prototype-based object mapping for KnowShowGo concepts, with:
- **Prototype-based objects** (JavaScript-style inheritance)
- **Lazy property loading** from associated nodes
- **Cached JSON documents** linked to concept nodes
- **Query by prototype** (e.g., `Person.find()`, `Person.create()`)

## Architecture

### 1. Prototype Registration

```javascript
// Register a prototype
await ksg.orm.registerPrototype('Person', {
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true },
    age: { type: 'number' }
  }
});

// Creates Person prototype in KnowShowGo
// Creates JavaScript Person class
```

### 2. Object Creation

```javascript
// Create via ORM
const john = await Person.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Automatically:
// 1. Creates concept node
// 2. Creates property nodes
// 3. Creates value nodes
// 4. Creates associations (has_prop, has_value)
// 5. Generates cached JSON document
// 6. Returns Person instance
```

### 3. Lazy Property Loading

```javascript
// Access property (lazy loads from associated nodes)
console.log(john.name);  // Queries has_value associations
console.log(john.email); // Queries has_value associations

// First access triggers query:
// 1. Find has_value associations with propertyName='name'
// 2. Load value node
// 3. Cache in object
// 4. Return value
```

### 4. Cached JSON Document

```javascript
// Each concept has a cached JSON document node
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
    updatedAt: '2024-01-01T00:00:00Z'
  }
}

// Linked via association:
// Concept --[has_document]--> Document
```

### 5. Query by Prototype

```javascript
// Find all Person instances
const people = await Person.find();

// Find by property
const john = await Person.findOne({ email: 'john@example.com' });

// Find by embedding similarity
const similar = await Person.findSimilar('person named John');
```

## Implementation

### Prototype Class Generation

```javascript
class Person extends KSGObject {
  static prototypeName = 'Person';
  
  // Properties defined in prototype registration
  // Automatically lazy-loaded from associations
  
  async save() {
    // Update concept node
    // Update property/value nodes
    // Update cached JSON document
    // Invalidate cache
  }
}

// Generated from:
await ksg.orm.registerPrototype('Person', {
  properties: { name: 'string', email: 'string', age: 'number' }
});
```

### Lazy Property Accessor

```javascript
class KSGObject {
  constructor(conceptUuid, ksg) {
    this._conceptUuid = conceptUuid;
    this._ksg = ksg;
    this._cache = {};  // Property cache
    this._loaded = false;  // Whether properties loaded
  }
  
  get name() {
    return this._getProperty('name');
  }
  
  async _getProperty(propName) {
    // Check cache
    if (this._cache[propName] !== undefined) {
      return this._cache[propName];
    }
    
    // Lazy load from associations
    const value = await this._ksg.getPropertyValue(this._conceptUuid, propName);
    this._cache[propName] = value;
    return value;
  }
}
```

### Cached JSON Document

```javascript
async updateCachedDocument(conceptUuid, data) {
  // Find or create document node
  const docNode = await this.getOrCreateDocument(conceptUuid);
  
  // Update document data
  docNode.props.data = data;
  docNode.props.version = (docNode.props.version || 0) + 1;
  docNode.props.updatedAt = new Date().toISOString();
  
  // Upsert document node
  await this.memory.upsert(docNode, prov);
  
  // Link concept to document
  await this.addAssociation({
    fromConceptUuid: conceptUuid,
    toConceptUuid: docNode.uuid,
    relationType: 'has_document',
    strength: 1.0
  });
}
```

## Benefits

1. **JavaScript-style OOP**: Use `new Person()` and `person.name`
2. **Lazy Loading**: Properties loaded on-demand
3. **Cached Performance**: JSON document for fast access
4. **Query Interface**: `Person.find()`, `Person.findOne()`
5. **Automatic Updates**: Changes update nodes and document
6. **Type Safety**: Properties typed via prototype registration

