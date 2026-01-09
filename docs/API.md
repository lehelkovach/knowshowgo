# KnowShowGo API Reference

## Overview

KnowShowGo provides a fuzzy ontology knowledge graph API for semantic memory. This document describes the JavaScript/Node.js API.

## Installation

```bash
npm install knowshowgo
```

## Quick Start

```javascript
import { KnowShowGo, InMemoryMemory } from 'knowshowgo';

// Initialize with embedding function
const ksg = new KnowShowGo({
  embedFn: async (text) => {
    // Use your embedding service
    return await yourEmbeddingService(text);
  },
  memory: new InMemoryMemory()
});
```

## API Methods

### `createPrototype(params)`

Create a Prototype (Topic with isPrototype=true). Prototypes define schemas/templates and are immutable but versioned.

**Parameters:**
- `name` (string): Prototype name
- `description` (string): Prototype description
- `context` (string): Additional context
- `labels` (string[], optional): Labels/aliases
- `embedding` (number[]): Vector embedding
- `provenance` (Provenance, optional): Provenance info
- `basePrototypeUuid` (string, optional): Parent prototype UUID (inheritance)

**Returns:** `Promise<string>` - Prototype UUID

**Example:**
```javascript
const protoUuid = await ksg.createPrototype({
  name: 'Person',
  description: 'A human individual',
  context: 'identity',
  labels: ['person', 'human'],
  embedding: await embed('Person human individual')
});
```

### `createConcept(params)`

Create a Concept (Topic with isPrototype=false). Concepts are instances following prototype schemas.

**Parameters:**
- `prototypeUuid` (string): Prototype UUID
- `jsonObj` (object): Concept data
- `embedding` (number[]): Vector embedding
- `provenance` (Provenance, optional): Provenance info
- `previousVersionUuid` (string, optional): Previous version UUID (for versioning)

**Returns:** `Promise<string>` - Concept UUID

**Example:**
```javascript
const conceptUuid = await ksg.createConcept({
  prototypeUuid: protoUuid,
  jsonObj: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  },
  embedding: await embed('John Doe person')
});
```

### `searchConcepts(params)`

Search for concepts by embedding similarity. Fuzzy search based on cosine similarity.

**Parameters:**
- `query` (string): Search query text
- `topK` (number, optional): Maximum number of results (default: 5)
- `similarityThreshold` (number, optional): Minimum similarity score (default: 0.0)
- `prototypeFilter` (string, optional): Filter by prototype name
- `queryEmbedding` (number[], optional): Pre-computed query embedding

**Returns:** `Promise<Array>` - List of concept dicts with similarity scores

**Example:**
```javascript
const results = await ksg.searchConcepts({
  query: 'person named John',
  topK: 5,
  similarityThreshold: 0.7
});
```

### `getConcept(conceptUuid)`

Get a concept by UUID.

**Parameters:**
- `conceptUuid` (string): Concept UUID

**Returns:** `Promise<Object|null>` - Concept node or null if not found

**Example:**
```javascript
const concept = await ksg.getConcept(conceptUuid);
```

### `addAssociation(params)`

Add an association between two concepts.

**Parameters:**
- `fromConceptUuid` (string): Source concept UUID
- `toConceptUuid` (string): Target concept UUID
- `relationType` (string): Relationship type
- `strength` (number, optional): Association strength 0.0-1.0 (default: 1.0)
- `provenance` (Provenance, optional): Provenance info

**Returns:** `Promise<string>` - Edge UUID

**Example:**
```javascript
const edgeUuid = await ksg.addAssociation({
  fromConceptUuid: person1,
  toConceptUuid: person2,
  relationType: 'knows',
  strength: 0.8
});
```

## Data Models

### Node

Represents a topic/concept/prototype in the knowledge graph.

```javascript
{
  kind: 'topic',           // 'topic' | 'Concept' | 'Prototype'
  labels: ['Person'],      // Primary label + aliases
  props: {
    label: 'Person',       // Primary label
    aliases: [],           // Additional labels
    summary: '...',        // Description
    isPrototype: true,     // true for Prototypes, false for Concepts
    status: 'active',      // 'active' | 'proposed' | 'deprecated'
    namespace: 'public',   // Namespace
    // ... other properties
  },
  uuid: '...',             // Unique identifier
  llmEmbedding: [...],     // Vector embedding
  status: 'active'
}
```

### Edge

Represents an association between two nodes.

```javascript
{
  fromNode: 'uuid1',       // Source node UUID
  toNode: 'uuid2',         // Target node UUID
  rel: 'instanceOf',       // Relationship type
  props: {
    w: 1.0,                // Weight/strength 0.0-1.0
    confidence: 1.0,       // Confidence score 0.0-1.0
    status: 'accepted',    // 'accepted' | 'proposed' | 'rejected'
    // ... other properties
  },
  uuid: '...',             // Unique identifier
  kind: 'edge'
}
```

### Provenance

Tracks the origin of information.

```javascript
{
  source: 'user',          // 'user' | 'tool' | 'doc'
  ts: '2024-01-01T00:00:00Z', // ISO timestamp
  confidence: 1.0,         // Confidence score 0.0-1.0
  traceId: 'knowshowgo'    // Trace identifier
}
```

## Memory Backends

### InMemoryMemory

In-memory backend for testing and development.

```javascript
import { InMemoryMemory } from 'knowshowgo';

const memory = new InMemoryMemory();
```

**Note:** Additional backends (ArangoDB, ChromaDB, PostgreSQL) will be available as separate packages.

## Error Handling

All methods throw errors on failure. Wrap calls in try-catch:

```javascript
try {
  const uuid = await ksg.createPrototype({...});
} catch (error) {
  console.error('Failed to create prototype:', error);
}
```

## TypeScript

TypeScript definitions are included:

```typescript
import { KnowShowGo, Node, Edge, Provenance } from 'knowshowgo';

const ksg: KnowShowGo = new KnowShowGo({...});
```

## See Also

- [README.md](../README.md) - Quick start guide
- [Design Documentation](./Knowshowgo_SYSTEM_DESIGN_v0.1.md) - System design
- [Architecture](./knowshowgo-ontology-architecture.md) - Architecture details
- [Versioning Strategy](./knowshowgo-versioning-strategy.md) - Versioning approach

