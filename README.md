# KnowShowGo - JavaScript/Node.js Implementation

A fuzzy ontology knowledge graph for semantic memory, designed for AI agents and learning systems.

## Overview

KnowShowGo (KSG) is a prototype-based knowledge graph that combines:
- **Fuzzy matching** via vector embeddings (semantic similarity)
- **Prototype-based OOP** (JavaScript-style inheritance)
- **Versioned concepts** with immutable history
- **Weighted associations** for relationship strength
- **ORM-style API** for object hydration

## Features

- ✅ Prototype and concept creation
- ✅ Semantic search via embeddings
- ✅ Versioned updates (immutable history)
- ✅ Associations with weights and provenance
- ✅ ORM-style object hydration (planned)
- ✅ Recursive concept creation (planned)
- ✅ Query-time generalization (planned)
- ✅ Schema generalization (planned)

## Installation

```bash
npm install
```

## Quick Start

```javascript
import { KnowShowGo, InMemoryMemory } from './src/index.js';

// Initialize with embedding function
const ksg = new KnowShowGo({
  embedFn: async (text) => {
    // Use your embedding service (OpenAI, local, etc.)
    return await yourEmbeddingService(text);
  },
  memory: new InMemoryMemory() // or ArangoMemory, ChromaMemory, etc.
});

// Create a prototype
const personProto = await ksg.createPrototype({
  name: 'Person',
  description: 'A human individual',
  context: 'identity',
  labels: ['person', 'human'],
  embedding: await embed('Person human individual')
});

// Create a concept
const john = await ksg.createConcept({
  prototypeUuid: personProto,
  jsonObj: {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30
  },
  embedding: await embed('John Doe person')
});

// Search for similar concepts
const results = await ksg.searchConcepts({
  query: 'person named John',
  topK: 5,
  similarityThreshold: 0.7
});

// Get concept
const concept = await ksg.getConcept(john);
console.log(concept); // { uuid: '...', props: { name: 'John Doe', ... } }
```

## Architecture

```
KnowShowGo API
  ↓
Memory Backend (ArangoDB/ChromaDB/InMemory)
  ↓
Embedding Service (OpenAI/Local/etc.)
```

## Design Principles

1. **Everything is a Topic**: Concepts, prototypes, properties, values
2. **Prototypes are Immutable**: Schema changes create new versions
3. **Concepts are Versioned**: Significant changes create new versions
4. **Fuzzy Matching**: Embedding-based similarity, not exact matches
5. **ORM-Style**: Automatic object hydration from prototypes (planned)

## Documentation

- [API Reference](./docs/API.md) - Full API documentation
- [System Design](./docs/Knowshowgo_SYSTEM_DESIGN_v0.1.md) - Original system design
- [Architecture](./docs/knowshowgo-ontology-architecture.md) - Architecture details
- [Versioning Strategy](./docs/knowshowgo-versioning-strategy.md) - Versioning approach
- [Test Coverage](./docs/TEST-COVERAGE.md) - Test migration guide
- [Reference Implementation](./reference/README.md) - Python reference code

## Testing

```bash
npm test
npm run test:coverage
npm run test:watch
```

## Repository Setup

See [REPOSITORY-SETUP.md](./REPOSITORY-SETUP.md) for instructions on setting up this as a separate GitHub repository.

## License

MIT

## Status

**Current**: Core implementation complete, ready for extraction to separate repo.

**Planned**:
- Query-time generalization
- Schema generalization
- Layered weighting system
- Advanced versioning
- Memory backend implementations (ArangoDB, ChromaDB)
- ORM features (object hydration, recursive creation)
