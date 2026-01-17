# KnowShowGo

A semantic memory engine for AI agents — fuzzy ontology knowledge graph with prototype-based OOP.

## Quick Start

```bash
# Install
npm install

# Run tests
npm test

# Start server
npm start

# Health check
curl http://localhost:3000/health
```

## What is KnowShowGo?

KnowShowGo is a knowledge graph that combines:
- **Fuzzy matching** via vector embeddings
- **Prototype-based OOP** (JavaScript-style inheritance)
- **Lazy-loading ORM** with dynamic properties
- **Assertions** with truth values and provenance
- **WTA Resolution** for canonical snapshots

## Features

| Feature | Status |
|---------|--------|
| Prototypes & Concepts | ✅ |
| Semantic Search | ✅ |
| Associations with Weights | ✅ |
| ORM with Lazy Loading | ✅ |
| REST API (17 endpoints) | ✅ |
| In-Memory Backend | ✅ |
| ArangoDB Backend | ✅ |
| Docker Deployment | ✅ |
| Assertions & WTA | ❌ Planned |
| Pattern Evolution | ❌ Planned |
| NeuroDAG Fuzzy Logic | ❌ Planned |

## Usage

### JavaScript API

```javascript
import { KnowShowGo, InMemoryMemory } from 'knowshowgo';

const ksg = new KnowShowGo({
  embedFn: async (text) => yourEmbeddingService(text),
  memory: new InMemoryMemory()
});

// Create prototype
const personProto = await ksg.createPrototype({
  name: 'Person',
  description: 'A human individual',
  embedding: await ksg.embedFn('Person human')
});

// Create concept
const john = await ksg.createConcept({
  prototypeUuid: personProto,
  jsonObj: { name: 'John Doe', age: 30 },
  embedding: await ksg.embedFn('John Doe person')
});

// Search
const results = await ksg.searchConcepts({
  query: 'person named John',
  topK: 5
});
```

### ORM with Lazy Loading

```javascript
// Register prototype - creates dynamic JS class
const Person = await ksg.orm.registerPrototype('Person', {
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'string' },
    age: { type: 'number' }
  }
});

// Create instance
const john = await Person.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 30
});

// Get instance - lazy loads properties
const person = await Person.get(john.uuid);
const name = await person._getProperty('name');

// Find all
const people = await Person.find();
```

### REST API

```bash
# Create prototype
curl -X POST http://localhost:3000/api/prototypes \
  -H "Content-Type: application/json" \
  -d '{"name": "Person", "description": "A human"}'

# Create concept
curl -X POST http://localhost:3000/api/concepts \
  -H "Content-Type: application/json" \
  -d '{"prototypeUuid": "...", "jsonObj": {"name": "John"}}'

# Search
curl -X POST http://localhost:3000/api/concepts/search \
  -H "Content-Type: application/json" \
  -d '{"query": "person", "topK": 5}'
```

## Testing

```bash
# Run all tests (54 tests, 74% coverage)
npm test

# With coverage report
npm test -- --coverage

# Run specific test file
npm test -- tests/rest-api.test.js

# Run integration tests (mock)
npm test -- tests/integration/

# Run integration tests (live - requires ArangoDB)
TEST_LIVE=true npm test -- tests/integration/
```

## Deployment

### Docker

```bash
docker compose up -d
curl http://localhost:3000/health
```

### Oracle Cloud

See deployment instructions in [DEVELOPMENT-PLAN.md](./docs/DEVELOPMENT-PLAN.md#10-deployment-oracle-cloud).

## Documentation

**Single source of truth:** [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md)

Contains:
- Core & cognitive primitives
- REST API reference
- JavaScript API reference
- ORM patterns
- Test coverage
- Deployment guide
- osl-agent-prototype integration
- Version roadmap

## Integration with osl-agent-prototype

```bash
# Seed the ontology
curl -X POST http://localhost:3000/api/seed/osl-agent

# Use from Python
from knowshowgo_client import KnowShowGoClient
client = KnowShowGoClient("http://localhost:3000")
```

See [DEVELOPMENT-PLAN.md#11](./docs/DEVELOPMENT-PLAN.md#11-osl-agent-prototype-integration) for full integration guide.

## Project Structure

```
knowshowgo/
├── src/
│   ├── knowshowgo.js      # Core API
│   ├── models.js          # Node, Edge, Provenance
│   ├── memory/            # In-memory, ArangoDB backends
│   ├── orm/               # ORM with lazy loading
│   └── server/            # REST API
├── tests/
│   ├── *.test.js          # Unit tests
│   └── integration/       # E2E tests (mock + live)
├── docs/
│   └── DEVELOPMENT-PLAN.md  # Single documentation file
├── api/
│   └── python/            # Python client
└── docker-compose.yml
```

## Status

**v0.1.0** - 54 tests passing, 74.57% coverage

**Next (v0.2.0):**
- Assertions with truth/strength
- WTA Resolution
- Pattern Evolution
- Centroid Embeddings

## License

MIT
