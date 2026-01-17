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
11. [osl-agent-prototype Integration](#11-osl-agent-prototype-integration)
12. [Version Roadmap](#12-version-roadmap)

---

## 1. Executive Summary

KnowShowGo is a semantic memory engine for AI agents, providing:

- **4 Core Primitives** — Entity, Type, Predicate, Assertion
- **Cognitive Memory** — WorkingMemory with Hebbian reinforcement
- **Fuzzy Logic** — NeuroDAG propositions with WTA resolution
- **Dual Views** — Evidence (auditable) vs Snapshot (canonical)

**Current Status:** 54 tests passing | 74.57% line coverage

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

**Total: 54 tests | 7 suites | 74.57% line coverage**

| File | Lines |
|------|-------|
| `src/models.js` | 100% |
| `src/orm/ksg-orm.js` | 90% |
| `src/memory/in-memory.js` | 87% |
| `src/knowshowgo.js` | 83% |
| `src/server/rest-api.js` | 75% |
| `src/memory/arango-memory.js` | 0% |

### Run Tests

```bash
npm test                    # Run all
npm test -- --coverage      # With coverage
npm test -- tests/rest-api.test.js  # Specific file
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

## 11. osl-agent-prototype Integration

**Handoff Doc:** `https://github.com/lehelkovach/osl-agent-prototype/blob/main/docs/KNOWSHOWGO-SERVICE-HANDOFF.md`

### Architecture

```
osl-agent-prototype (Python)
├── WorkingMemoryGraph (local)
├── AsyncReplicator (local)
├── DeterministicParser (local)
└── KnowShowGoClient → knowshowgo-js service (remote)
```

### Existing Branches in osl-agent-prototype

| Branch | Contains |
|--------|----------|
| `archived/knowshowgo-service` | FastAPI service, Python client, adapter |
| `cursor/knowshowgo-repo-push-c83c` | Handoff docs |

### Python Client Usage

```python
from knowshowgo.client import KnowShowGoClient

client = KnowShowGoClient(base_url="http://localhost:3000")
uuid = client.create_concept(prototype_uuid, {"name": "Test"})
results = client.search("query", top_k=5)
```

### Environment Variables

```bash
KNOWSHOWGO_URL=http://localhost:3000
USE_KNOWSHOWGO_SERVICE=true
```

---

## 12. Version Roadmap

```
v0.1.0 (Current)
├── Node/Edge/Provenance models
├── In-Memory + ArangoDB backends
├── REST API (17 endpoints)
├── ORM (prototype-based)
└── 54 tests, 74.57% coverage

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

*Version 3.0 | 2026-01-17*
*Single source of truth for KnowShowGo development*
