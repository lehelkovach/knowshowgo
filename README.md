# KnowShowGo

A semantic memory engine for AI agents — fuzzy ontology knowledge graph with prototype-based OOP.

## Quick Start

```bash
npm install
npm test           # 115 tests
npm start          # Start server at http://localhost:3000
```

## What is KnowShowGo?

A **semantic memory engine** for AI agents.

- **Assertions** — Store facts with truth values
- **Snapshots** — Get resolved values (highest truth wins)
- **Search** — Find by semantic similarity
- **Procedures** — Store and retrieve workflows

**Design principle: KISS (Keep It Simple Stupid)**

## For Humans: Getting Started

### 1. Run the Server

```bash
# In-memory mode (no external dependencies)
npm start

# With ArangoDB (persistent storage)
KSG_MEMORY_BACKEND=arango npm start
```

### 2. Create Your First Data

```bash
# Create a prototype (like a class)
curl -X POST http://localhost:3000/api/prototypes \
  -H "Content-Type: application/json" \
  -d '{"name": "Person", "description": "A human individual"}'

# Create a concept (like an instance)
curl -X POST http://localhost:3000/api/concepts \
  -H "Content-Type: application/json" \
  -d '{"prototypeUuid": "YOUR_PROTO_UUID", "jsonObj": {"name": "John", "age": "30"}}'

# Search
curl -X POST http://localhost:3000/api/concepts/search \
  -H "Content-Type: application/json" \
  -d '{"query": "person named John", "topK": 5}'
```

### 3. Use with JavaScript

```javascript
import { KnowShowGo, InMemoryMemory } from 'knowshowgo';

const ksg = new KnowShowGo({
  embedFn: async (text) => yourEmbeddingService(text),
  memory: new InMemoryMemory()
});

// ORM with lazy loading
const Person = await ksg.orm.registerPrototype('Person', {
  properties: { name: { type: 'string' }, age: { type: 'string' } }
});

const john = await Person.create({ name: 'John', age: '30' });
const people = await Person.find();
```

## For AI Agents: Integration Guide

See [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md) for:
- Full API reference
- Integration patterns
- Development workflow
- Debugging instructions

### Quick Agent Integration

```python
# Python client (from your agent repo)
from knowshowgo_client import KnowShowGoClient

client = KnowShowGoClient("http://localhost:3000")
uuid = client.create_concept(proto_uuid, {"name": "Test"})
results = client.search("query", top_k=5)
```

```javascript
// JavaScript client
const response = await fetch('http://localhost:3000/api/concepts/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'test', topK: 5 })
});
const { results } = await response.json();
```

## Testing

### Run All Tests (93 tests)

```bash
npm test
```

### Mock vs Live Tests

```bash
# Mock mode (in-memory, no external deps)
npm test -- tests/integration/

# Live mode (requires ArangoDB)
TEST_LIVE=true npm test -- tests/integration/
```

### Debug Daemon (Continuous Testing)

```bash
# Run once with logging
node scripts/debug-daemon.js --once

# Run continuously (every 60s)
node scripts/debug-daemon.js

# Include live tests
node scripts/debug-daemon.js --live

# Custom interval (30s)
node scripts/debug-daemon.js --interval 30000
```

Logs are written to `logs/` directory:
- `debug-daemon.log` - Main daemon log
- `health-checks.log` - Health check results (JSON)
- `test-results.log` - Test run summaries (JSON)

### Quick Live Test Script

```bash
# Run mock tests, then live if ArangoDB is available
./scripts/test-live.sh

# Force live tests
./scripts/test-live.sh --live
```

## Development Workflow

### Local Development

```bash
# Start with hot reload
npm run dev

# Or with Docker (hot reload)
docker compose -f docker-compose.dev.yml up
```

### Remote Development (OCI)

```bash
# 1. Configure remote connection
cp .env.remote.example .env.remote
# Edit .env.remote with your OCI VM details

# 2. Check status
./scripts/remote-dev.sh status

# 3. Deploy changes
./scripts/remote-dev.sh deploy

# 4. Quick hotfix (commit + push + deploy)
./scripts/remote-dev.sh hotfix "fix the bug"

# 5. Stream logs
./scripts/remote-dev.sh logs

# 6. Run tests on remote
./scripts/remote-dev.sh test

# 7. Rollback if needed
./scripts/remote-dev.sh rollback
```

### Remote Watcher (Continuous Monitoring)

```bash
# Watch remote service health
./scripts/watch-remote.sh --url http://YOUR_OCI_IP:3000

# Custom interval (10s)
./scripts/watch-remote.sh --interval 10
```

### Tandem Development (Local + Remote)

```bash
# Terminal 1: Watch remote service
./scripts/watch-remote.sh --url http://YOUR_OCI_IP:3000

# Terminal 2: Stream remote logs
./scripts/remote-dev.sh logs

# Terminal 3: Local development
npm run dev

# Terminal 4: Your agent repo (pointing to remote KSG)
KNOWSHOWGO_URL=http://YOUR_OCI_IP:3000 python your_agent.py
```

## Deployment

### Docker

```bash
docker compose up -d
curl http://localhost:3000/health
```

### Oracle Cloud

See [`docs/DEVELOPMENT-PLAN.md#10`](./docs/DEVELOPMENT-PLAN.md#10-deployment-oracle-cloud).

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
│   ├── *.test.js          # Unit tests (54)
│   └── integration/       # E2E tests (39)
├── scripts/
│   ├── debug-daemon.js    # Continuous test daemon
│   └── test-live.sh       # Live test runner
├── logs/                  # Debug logs (gitignored)
├── docs/
│   └── DEVELOPMENT-PLAN.md  # Single source of truth
└── api/
    └── python/            # Python client
```

## Documentation

**Single source of truth:** [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md)

Contains:
- Core & cognitive primitives
- REST API reference (17 endpoints)
- JavaScript API reference
- ORM patterns with lazy loading
- Test coverage (93 tests)
- Deployment guide
- Agent integration guide

## Status

**v0.1.0** - 93 tests passing

## License

MIT
