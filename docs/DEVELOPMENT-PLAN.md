# KnowShowGo Development Plan

**Version:** 3.0  
**Status:** Single source of truth for all development  
**Repository:** `https://github.com/lehelkovach/knowshowgo`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Primitives](#2-core-primitives)
3. [Cognitive Primitives](#3-cognitive-primitives)
4. [NeuroDAG: Fuzzy Logic](#4-neurodag-fuzzy-logic)
5. [Implementation Status](#5-implementation-status)
6. [REST API Reference](#6-rest-api-reference)
7. [JavaScript API Reference](#7-javascript-api-reference)
8. [ORM Patterns](#8-orm-patterns)
9. [Test Coverage](#9-test-coverage)
10. [Deployment (Oracle Cloud)](#10-deployment-oracle-cloud)
11. [Agent Integration Guide](#11-agent-integration-guide)
12. [Debugging & Development](#12-debugging--development)
13. [Version Roadmap](#13-version-roadmap)

---

## 1. Executive Summary

KnowShowGo is a semantic memory engine for AI agents, providing:

- **4 Core Primitives** — Entity, Type, Predicate, Assertion
- **Cognitive Memory** — WorkingMemory with Hebbian reinforcement
- **Fuzzy Logic** — NeuroDAG propositions with WTA resolution
- **Dual Views** — Evidence (auditable) vs Snapshot (canonical)

**Current Status:** 93 tests passing (54 unit + 39 integration)

---

## 2. Core Primitives

| Primitive | Purpose | Implementation |
|-----------|---------|----------------|
| **Entity** | Stable UUID identity anchor | `Node` class |
| **Type** | Category/schema (also an Entity) | `Node` with `isPrototype: true` |
| **Predicate** | Property/relation kind | `Node` with `isPredicate: true` |
| **Assertion** | First-class belief with weights + provenance | `Assertion` class |

### Assertion Model

```javascript
class Assertion {
  constructor({
    subject,           // Entity UUID
    predicate,         // Predicate UUID or string
    object,            // Entity UUID or literal value
    truth = 1.0,       // [0,1] probability claim is correct
    strength = 1.0,    // [0,1] association salience
    voteScore = 0,     // Community votes
    sourceRel = 1.0,   // [0,1] provenance reliability
    provenance = null,
    status = 'accepted',
    uuid = uuidv4(),
    prevAssertionId = null
  }) { ... }
}
```

---

## 3. Cognitive Primitives

### 3.1 WorkingMemoryGraph

Session-scoped activation with Hebbian reinforcement.

```javascript
class WorkingMemoryGraph {
  link(fromUuid, toUuid, initialWeight = 1.0)
  access(fromUuid, toUuid)  // Reinforce on use
  decayAll()                // Periodic decay
  getWeight(fromUuid, toUuid)
}
```

### 3.2 WTA Resolution

Convert competing assertions to canonical snapshot.

```javascript
const DEFAULT_POLICY = {
  weights: { truth: 0.45, voteScore: 0.20, sourceRel: 0.15, recency: 0.10, strength: 0.10 }
};

class WTAResolver {
  scoreAssertion(assertion)
  resolve(assertions) // Returns { snapshot, evidence }
}
```

### 3.3 Pattern Evolution (v0.2.0)

```javascript
ksg.findSimilarPatterns(query, { minSimilarity: 0.6 })
ksg.transferPattern(sourceUuid, targetContext, llmFn)
ksg.recordPatternSuccess(patternUuid, context)
ksg.autoGeneralize(patternUuid, { minSimilar: 2 })
```

### 3.4 Centroid-Based Embeddings (v0.2.0)

```javascript
ksg.addExemplar(conceptUuid, exemplarEmbedding)
ksg.getConceptCentroid(conceptUuid)
ksg.recomputeCentroid(conceptUuid)
```

### 3.5 First-Class Edges (v0.2.0)

```javascript
ksg.createRelationship({ fromUuid, toUuid, relType, properties, embedding })
ksg.searchRelationships(query)
```

---

## 4. NeuroDAG: Fuzzy Logic

| Node Type | Props | Purpose |
|-----------|-------|---------|
| Proposition | `isProposition: true`, `neuro: {type, truth, prior}` | Atomic fact |
| Rule | `isRule: true`, `neurodag: {type: 'IMPLICATION', weight}` | Inference |
| Attack | `isAttack: true`, `neurodag: {type: 'ATTACK', weight}` | Defeater |

| Operation | Formula |
|-----------|---------|
| Implication | `target = source × weight` |
| Fuzzy OR | `max(v1, v2, ...)` |
| Fuzzy AND | `max(0, Σv - (n-1))` |
| Attack | `val × (1 - attacker × weight)` |

---

## 5. Implementation Status

### ✅ Implemented

| Component | File | Coverage |
|-----------|------|----------|
| Node/Edge/Provenance | `src/models.js` | 100% |
| In-Memory backend | `src/memory/in-memory.js` | 87% |
| ArangoDB backend | `src/memory/arango-memory.js` | 0% (needs live DB) |
| REST API | `src/server/rest-api.js` | 75% |
| ORM | `src/orm/ksg-orm.js` | 90% |
| Core API | `src/knowshowgo.js` | 83% |

### ❌ Not Yet Implemented

| Component | Priority |
|-----------|----------|
| Assertion class | 🔴 Critical |
| WTAResolver | 🔴 Critical |
| WorkingMemoryGraph | 🔴 Critical |
| Pattern Evolution | 🔴 Critical |
| Centroid Embeddings | 🟡 High |
| First-Class Edges | 🟡 High |

---

## 6. REST API Reference

### Existing Endpoints ✅

```
GET  /health                    # Health check
POST /api/prototypes            # Create prototype
GET  /api/prototypes/:uuid      # Get prototype
POST /api/concepts              # Create concept
GET  /api/concepts/:uuid        # Get concept
POST /api/concepts/search       # Search concepts
POST /api/associations          # Create association
POST /api/nodes                 # Upsert node
POST /api/knodes                # Create knode (node+doc+tags)
POST /api/procedures            # Create procedure DAG
POST /api/seed/osl-agent        # Seed osl-agent ontology
```

### New Endpoints (v0.2.0) ❌

```
# Assertions
POST /api/assertions
GET  /api/assertions
POST /api/assertions/:id/vote

# Snapshot/Evidence
GET  /api/entities/:id/snapshot
GET  /api/entities/:id/evidence

# Patterns
POST /api/patterns/similar
POST /api/patterns/transfer
POST /api/patterns/:id/success
POST /api/patterns/:id/generalize

# Relationships
POST /api/relationships
POST /api/relationships/search

# Centroids
POST /api/concepts/:id/exemplar
GET  /api/concepts/:id/centroid
```

---

## 7. JavaScript API Reference

### Quick Start

```javascript
import { KnowShowGo, InMemoryMemory } from 'knowshowgo';

const ksg = new KnowShowGo({
  embedFn: async (text) => yourEmbeddingService(text),
  memory: new InMemoryMemory()
});
```

### Core Methods

```javascript
// Prototypes
const protoUuid = await ksg.createPrototype({
  name: 'Person',
  description: 'A human individual',
  embedding: await embed('Person')
});

// Concepts
const conceptUuid = await ksg.createConcept({
  prototypeUuid,
  jsonObj: { name: 'John Doe', age: 30 },
  embedding: await embed('John Doe')
});

// Search
const results = await ksg.searchConcepts({
  query: 'person named John',
  topK: 5,
  similarityThreshold: 0.7
});

// Associations
await ksg.addAssociation({
  fromConceptUuid: person1,
  toConceptUuid: person2,
  relationType: 'knows',
  strength: 0.8
});
```

### Data Models

```javascript
// Node
{ uuid, kind: 'topic', labels: [], props: { isPrototype, ... }, llmEmbedding: [] }

// Edge
{ uuid, fromNode, toNode, rel, props: { w: 1.0, confidence: 1.0 } }

// Provenance
{ source: 'user', ts: 'ISO-timestamp', confidence: 1.0, traceId: 'knowshowgo' }
```

---

## 8. ORM Patterns

### EntityFacade (Target)

```javascript
const bob = ksg.entity('uuid-bob');
await bob.assert('hasAge', 40, { truth: 0.95 });
const snapshot = await bob.snapshot();
const evidence = await bob.evidence();
```

### NeuroDAGFacade (Target)

```javascript
const neuro = ksg.neurodag();
const prop = await neuro.addProposition('Server offline', { type: 'DIGITAL', truth: 1.0 });
await neuro.addRule(prop, churnRisk, { type: 'IMPLICATION', weight: 0.9 });
const results = await neuro.solve();
```

---

## 9. Test Coverage

**Total: 93 tests | 10 suites**

| Suite | Tests | Description |
|-------|-------|-------------|
| Unit Tests | 54 | Core functionality |
| Integration Tests | 39 | E2E & API tests |

| File | Lines |
|------|-------|
| `src/models.js` | 100% |
| `src/orm/ksg-orm.js` | 90% |
| `src/memory/in-memory.js` | 87% |
| `src/knowshowgo.js` | 83% |
| `src/server/rest-api.js` | 75% |
| `src/memory/arango-memory.js` | 0% |

### Test Structure

```
tests/
├── knowshowgo.test.js         # Core API tests
├── orm.test.js                # ORM unit tests
├── rest-api.test.js           # REST API tests
├── assertion.test.js          # Assertion model tests
├── multiple-inheritance.test.js
├── fully-unified-architecture.test.js
├── refined-architecture.test.js
└── integration/
    ├── setup.js               # Test helpers & fixtures
    ├── api.integration.test.js    # API integration tests
    ├── orm.integration.test.js    # ORM integration tests
    └── e2e-workflow.integration.test.js  # E2E workflow tests
```

### Run Tests

```bash
# Run all tests (93 tests)
npm test

# With coverage report
npm test -- --coverage

# Run specific test file
npm test -- tests/rest-api.test.js

# Run integration tests only (mock mode)
npm test -- tests/integration/

# Run integration tests with live ArangoDB
TEST_LIVE=true npm test -- tests/integration/
```

### Mock vs Live Mode

Integration tests support both mock and live connection modes:

| Mode | Environment | Backend |
|------|-------------|---------|
| **Mock** (default) | `TEST_LIVE=false` | In-memory |
| **Live** | `TEST_LIVE=true` | ArangoDB |

For live mode, configure these environment variables:

```bash
export ARANGO_URL=http://localhost:8529
export ARANGO_DB=knowshowgo_test
export ARANGO_USER=root
export ARANGO_PASS=changeme
```

---

## 10. Deployment (Oracle Cloud)

### Prerequisites

- Ubuntu VM (OCI Free Tier - Ampere or AMD)
- Ports: 22 (SSH), 3000 (API)

### Quick Deploy

```bash
# On VM
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

git clone https://github.com/lehelkovach/knowshowgo.git /opt/knowshowgo/repo
cd /opt/knowshowgo/repo
docker compose up -d --build

# Verify
curl http://localhost:3000/health
```

### GitHub Auto-Deploy

Set these secrets in GitHub repo settings:

| Secret | Value |
|--------|-------|
| `OCI_SSH_HOST` | VM public IP |
| `OCI_SSH_USER` | `ubuntu` |
| `OCI_SSH_PRIVATE_KEY` | SSH private key |

Pushes to `main` auto-deploy via `.github/workflows/deploy-oci.yml`.

### One-Command Provision (OCI CLI)

```bash
export OCI_COMPARTMENT_OCID='ocid1.compartment.oc1...'
./scripts/local-oci-provision-and-configure-gh-deploy.sh \
  --repo lehelkovach/knowshowgo \
  --compartment $OCI_COMPARTMENT_OCID \
  --ssh-public-key ~/.ssh/id_ed25519.pub \
  --ssh-private-key ~/.ssh/id_ed25519
```

---

## 11. Agent Integration Guide

This section is for **AI agents and developers** integrating KnowShowGo into other repositories.

### Quick Start for Agents

1. **Start KnowShowGo service** (separate terminal or Docker)
2. **Use REST API** from your language/framework
3. **Run debug daemon** for health monitoring

### Architecture Pattern

```
Your Agent Repo (Python/JS/etc)
├── Latency-sensitive (keep local)
│   ├── WorkingMemoryGraph
│   ├── AsyncReplicator
│   └── DeterministicParser
└── Semantic Memory (use KnowShowGo service)
    └── KnowShowGoClient → http://localhost:3000
```

### Python Client Implementation

```python
"""
knowshowgo_client.py - Copy to your repo
"""
import requests
from typing import Optional, Dict, List, Any

class KnowShowGoClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
    
    def health(self) -> Dict:
        """Check service health."""
        r = requests.get(f"{self.base_url}/health", timeout=5)
        r.raise_for_status()
        return r.json()
    
    def create_prototype(self, name: str, description: str = "", **kwargs) -> str:
        """Create a prototype (type/schema)."""
        r = requests.post(f"{self.base_url}/api/prototypes", json={
            "name": name,
            "description": description,
            **kwargs
        })
        r.raise_for_status()
        return r.json()["uuid"]
    
    def create_concept(self, prototype_uuid: str, data: Dict[str, Any]) -> str:
        """Create a concept (instance)."""
        r = requests.post(f"{self.base_url}/api/concepts", json={
            "prototypeUuid": prototype_uuid,
            "jsonObj": data
        })
        r.raise_for_status()
        return r.json()["uuid"]
    
    def get_concept(self, uuid: str) -> Optional[Dict]:
        """Get a concept by UUID."""
        r = requests.get(f"{self.base_url}/api/concepts/{uuid}")
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    
    def search(self, query: str, top_k: int = 10, threshold: float = 0.5) -> List[Dict]:
        """Search for concepts."""
        r = requests.post(f"{self.base_url}/api/concepts/search", json={
            "query": query,
            "topK": top_k,
            "similarityThreshold": threshold
        })
        r.raise_for_status()
        return r.json()["results"]
    
    def add_association(self, from_uuid: str, to_uuid: str, 
                        rel_type: str, strength: float = 1.0) -> None:
        """Create association between concepts."""
        r = requests.post(f"{self.base_url}/api/associations", json={
            "fromConceptUuid": from_uuid,
            "toConceptUuid": to_uuid,
            "relationType": rel_type,
            "strength": strength
        })
        r.raise_for_status()
```

### JavaScript Client Implementation

```javascript
/**
 * knowshowgo-client.js - Copy to your repo
 */
export class KnowShowGoClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async health() {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
    return res.json();
  }

  async createPrototype(name, description = '', options = {}) {
    const res = await fetch(`${this.baseUrl}/api/prototypes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, ...options })
    });
    if (!res.ok) throw new Error(`Create prototype failed: ${res.status}`);
    return (await res.json()).uuid;
  }

  async createConcept(prototypeUuid, data) {
    const res = await fetch(`${this.baseUrl}/api/concepts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prototypeUuid, jsonObj: data })
    });
    if (!res.ok) throw new Error(`Create concept failed: ${res.status}`);
    return (await res.json()).uuid;
  }

  async search(query, topK = 10, threshold = 0.5) {
    const res = await fetch(`${this.baseUrl}/api/concepts/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK, similarityThreshold: threshold })
    });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return (await res.json()).results;
  }
}
```

### Environment Variables (Your Repo)

```bash
# Required
KNOWSHOWGO_URL=http://localhost:3000

# Optional
USE_KNOWSHOWGO_SERVICE=true
KNOWSHOWGO_TIMEOUT=5000
```

### Refactoring Checklist for Other Repos

When refactoring your agent to use KnowShowGo:

1. **Identify memory operations** in your codebase
   - Creating entities/concepts
   - Searching/querying
   - Creating relationships
   - Updating properties

2. **Decide what stays local vs remote**
   - **Local**: Real-time operations, session state, caching
   - **Remote**: Persistent storage, semantic search, knowledge base

3. **Implement the client** (copy from above)

4. **Add health checks** before critical operations
   ```python
   try:
       client.health()
   except Exception:
       # Fall back to local cache or queue for retry
   ```

5. **Handle network failures gracefully**
   - Queue failed writes for retry
   - Cache frequent reads locally
   - Log all KSG interactions for debugging

### osl-agent-prototype Specific

**Handoff Doc:** `https://github.com/lehelkovach/osl-agent-prototype/blob/main/docs/KNOWSHOWGO-SERVICE-HANDOFF.md`

| Branch | Contains |
|--------|----------|
| `archived/knowshowgo-service` | FastAPI service, Python client, adapter |
| `cursor/knowshowgo-repo-push-c83c` | Handoff docs |

---

## 12. Debugging & Development

### Debug Daemon

Run continuous health checks and tests:

```bash
# Single run with logging
node scripts/debug-daemon.js --once

# Continuous monitoring (60s interval)
node scripts/debug-daemon.js

# Include live ArangoDB tests
node scripts/debug-daemon.js --live

# Custom interval
node scripts/debug-daemon.js --interval 30000
```

### Log Files

| File | Contents |
|------|----------|
| `logs/debug-daemon.log` | Main daemon activity |
| `logs/health-checks.log` | Health check JSON results |
| `logs/test-results.log` | Test run summaries |

### Tandem Development Workflow

When developing KnowShowGo alongside another repo:

**Terminal 1: KnowShowGo Server**
```bash
cd knowshowgo
npm start
```

**Terminal 2: Debug Daemon**
```bash
cd knowshowgo
node scripts/debug-daemon.js --live
```

**Terminal 3: Your Agent**
```bash
cd your-agent-repo
# Run your agent, tests, etc.
```

**Terminal 4: Monitor Logs**
```bash
cd knowshowgo
tail -f logs/debug-daemon.log
```

### Debugging Checklist

1. **Service not responding?**
   - Check `curl http://localhost:3000/health`
   - Check `docker compose ps` if using Docker
   - Check logs: `docker compose logs knowshowgo-api`

2. **Tests failing?**
   - Run mock tests first: `npm test -- tests/integration/`
   - Check daemon log for patterns: `grep -i error logs/debug-daemon.log`
   - Run specific test: `npm test -- tests/integration/api.integration.test.js`

3. **Live tests failing but mock passing?**
   - Check ArangoDB: `curl http://localhost:8529/_api/version`
   - Verify credentials in env vars
   - Check connection: `ARANGO_URL=... node -e "..."`

4. **Performance issues?**
   - Check health latency in `logs/health-checks.log`
   - Monitor test duration in `logs/test-results.log`
   - Profile with: `npm test -- --detectOpenHandles`

### Development Iteration Pattern

```
1. Make code changes
         ↓
2. Run mock tests (fast feedback)
   npm test -- tests/integration/
         ↓
3. Check daemon logs (if running)
   tail -f logs/debug-daemon.log
         ↓
4. Run live tests (when ready)
   TEST_LIVE=true npm test -- tests/integration/
         ↓
5. Update docs (README first, then DEVELOPMENT-PLAN.md)
         ↓
6. Commit and push
         ↓
7. Repeat
```

---

## 13. Version Roadmap

```
v0.1.0 (Current)
├── Node/Edge/Provenance models
├── In-Memory + ArangoDB backends
├── REST API (17 endpoints)
├── ORM (prototype-based, lazy loading)
├── 93 tests (54 unit + 39 integration)
└── Mock & live test modes

v0.2.0 (MVP - Next)
├── Assertion model
├── WorkingMemoryGraph
├── WTA Resolution
├── Pattern Evolution
├── Centroid Embeddings
└── First-Class Edges

v0.3.0 (NeuroDAG)
├── createProposition, createRule, createDAG
├── Voting endpoints
└── ResolutionPolicy as Entity

v0.4.0 (GraphRAG)
├── Fact embeddings
├── Hybrid search
├── TransE link prediction

v1.0.0 (Stable)
├── npm publish
├── Production deployment
```

---

## Non-Negotiables

1. **Do not store facts twice** — Graph is authoritative; snapshots are derived
2. **Assertions are truth-bearing** — Weights, provenance, votes live on Assertions
3. **Policies are first-class** — Resolution must be reproducible
4. **Keep primitives small** — Entity/Type/Predicate/Assertion only
5. **Hebbian reinforcement** — "Fire together, wire together"
6. **Backward compatibility** — Existing endpoints continue to work

---

*Version 3.2 | 2026-01-14*
*Single source of truth for KnowShowGo development*
*Updated: Debug daemon, agent integration guide, tandem development workflow*
