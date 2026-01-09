# KnowShowGo Handoff Document

## Overview

KnowShowGo is a fuzzy ontology knowledge graph for semantic memory, designed for AI agents and learning systems. This document provides everything needed to extract, deploy, and use KnowShowGo as a standalone service.

## Architecture

### Core Components

1. **KnowShowGo API** (`src/knowshowgo.js`)
   - Main API for creating prototypes, concepts, associations
   - Semantic search via embeddings
   - Versioned updates
   - Node with document metadata and tag nodes
   - Mean embedding computation from edge-linked tag nodes

2. **ORM** (`src/orm/ksg-orm.js`)
   - Prototype-based JavaScript objects
   - Lazy property loading
   - Cached JSON documents

3. **Memory Backends**
   - `InMemoryMemory` - In-memory storage (testing)
   - `ArangoMemory` - ArangoDB graph database (production)

4. **REST API** (`src/server/rest-api.js`)
   - HTTP endpoints for all operations
   - Can be used by any client (Python, JavaScript, etc.)

5. **Python Client** (`api/python/client.py`)
   - Python wrapper for REST API
   - Drop-in replacement for direct API usage

## Current Integration in Agent Prototype

### Python Integration

The agent prototype uses KnowShowGo via:
- `src/personal_assistant/knowshowgo.py` - Python KnowShowGo API
- `src/personal_assistant/ksg_orm.py` - Python ORM
- Direct integration in `src/personal_assistant/agent.py`

### Usage in Agent

```python
from src.personal_assistant.knowshowgo import KnowShowGoAPI

# Initialize
ksg = KnowShowGoAPI(memory, embed_fn=embed_fn)

# Create prototype
proto_uuid = ksg.create_prototype(...)

# Create concept
concept_uuid = ksg.create_concept(...)

# Search
results = ksg.search_concepts(query="...", top_k=10)
```

## Extraction Plan

### Step 1: Extract to Separate Repository

1. Copy `knowshowgo-js/` directory to new repository
2. Initialize git repository
3. Push to GitHub

### Step 2: Update Agent Prototype

After extraction, the agent prototype has two options:

**Option A: Use REST API (Recommended for Separation)**
```python
from knowshowgo_client import KnowShowGoClient

client = KnowShowGoClient(base_url="http://localhost:3000")
concept_uuid = client.create_concept(...)
```

**Option B: Keep Direct Integration**
- Keep `src/personal_assistant/knowshowgo.py` as-is
- Update imports if needed
- Reference JavaScript implementation for consistency

### Step 3: Deploy KnowShowGo Service

```bash
# Using Docker Compose
cd knowshowgo-js
docker-compose up -d

# Or manually
npm install
KSG_MEMORY_BACKEND=arango node src/server/rest-api.js
```

## Deployment

### Docker Deployment

```bash
# Start ArangoDB and API
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f knowshowgo-api
```

### Environment Variables

```bash
# API Server
PORT=3000
KSG_MEMORY_BACKEND=arango  # or 'in-memory'
ARANGO_URL=http://localhost:8529
ARANGO_DB=knowshowgo
ARANGO_USER=root
ARANGO_PASS=changeme
```

### Manual Deployment

```bash
# Install dependencies
npm install

# Start API server
KSG_MEMORY_BACKEND=arango node src/server/rest-api.js
```

## API Endpoints

### Health Check
- `GET /health` - Service health

### Prototypes
- `POST /api/prototypes` - Create prototype
- `GET /api/prototypes/:uuid` - Get prototype

### Concepts
- `POST /api/concepts` - Create concept
- `GET /api/concepts/:uuid` - Get concept
- `POST /api/concepts/search` - Search concepts

### Associations
- `POST /api/associations` - Create association
- `GET /api/associations/:uuid` - Get associations

### Nodes with Documents
- `POST /api/nodes` - Create node with document
- `POST /api/nodes/:uuid/embedding` - Update embedding

### ORM
- `POST /api/orm/register` - Register prototype
- `POST /api/orm/:prototypeName/create` - Create instance
- `GET /api/orm/:prototypeName/:uuid` - Get instance

## Python Client Usage

```python
from knowshowgo_client import KnowShowGoClient

client = KnowShowGoClient(base_url="http://localhost:3000")

# Create prototype
proto_uuid = client.create_prototype(
    name="Person",
    description="A human individual",
    labels=["person", "human"]
)

# Create concept
concept_uuid = client.create_concept(
    prototype_uuid=proto_uuid,
    json_obj={"name": "John Doe", "email": "john@example.com"}
)

# Search
results = client.search_concepts("person named John", top_k=5)
```

## JavaScript/Node.js Usage

```javascript
import { KnowShowGo } from './src/knowshowgo.js';
import { InMemoryMemory } from './src/memory/in-memory.js';

const ksg = new KnowShowGo({
  embedFn: async (text) => await yourEmbeddingService(text),
  memory: new InMemoryMemory()
});

const protoUuid = await ksg.createPrototype({...});
const conceptUuid = await ksg.createConcept({...});
const results = await ksg.searchConcepts({...});
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Key Design Decisions

### 1. Everything is a Node
- Concepts, prototypes, properties, values, tags, documents are all `Topic` nodes
- Enables uniform querying and relationships

### 2. Mean Embeddings from Tag Nodes
- Concept embeddings = mean of all edge-linked tag node embeddings
- Tags are nodes with their own embeddings
- Enables semantic search and fuzzy matching

### 3. Document Metadata
- Every node has a document node
- Document contains metadata and associations to tag nodes
- Enables rich metadata without polluting main node

### 4. Multiple Inheritance
- Prototypes can inherit from multiple parents via `is_a` associations
- Enables flexible category hierarchies

### 5. Versioning
- Concepts can be versioned (immutable history)
- Prototypes are always versioned
- Enables audit trail and rollback

## Migration from Agent Prototype

### Current State
- Agent uses Python KnowShowGo API directly
- KnowShowGo code is in `src/personal_assistant/knowshowgo.py`
- Memory backend is abstracted via `MemoryTools`

### Migration Options

**Option 1: REST API (Recommended)**
- Deploy KnowShowGo as separate service
- Agent uses Python client to call REST API
- Clean separation, can scale independently

**Option 2: Keep Direct Integration**
- Keep Python KnowShowGo API in agent
- Sync with JavaScript implementation for consistency
- Simpler deployment, tighter coupling

**Option 3: Hybrid**
- Use REST API for production
- Use direct integration for development/testing
- Best of both worlds

## Next Steps

1. **Extract Repository**
   - Create new GitHub repository
   - Copy `knowshowgo-js/` contents
   - Set up CI/CD

2. **Deploy Service**
   - Set up Docker deployment
   - Configure ArangoDB
   - Deploy REST API

3. **Update Agent**
   - Choose integration approach (REST API or direct)
   - Update agent code
   - Test integration

4. **Documentation**
   - API documentation
   - Usage examples
   - Architecture diagrams

## Files to Extract

```
knowshowgo-js/
├── src/                    # Source code
├── tests/                  # Test suite
├── docs/                   # Documentation
├── api/                    # Client libraries
│   └── python/            # Python REST client
├── docker-compose.yml      # Docker deployment
├── Dockerfile              # API server image
├── package.json            # Node.js dependencies
├── README.md               # Main documentation
├── HANDOFF.md              # This file
└── ...                     # Other files
```

## Support

For questions or issues:
1. Check documentation in `docs/`
2. Review test files in `tests/`
3. Check reference implementation in `reference/python/`

## License

MIT License - See LICENSE file

