# KnowShowGo Master Plan

**Version:** 2.0  
**Status:** Canonical planning document (single source of truth)  
**Consolidates:** gpt-plans, opus-plans, salvage-knowshowgo, NEUROSYM_MASTER_PLAN, GRAPHRAG-EMBEDDINGS, ORM-API-REFACTOR

---

## Executive Summary

KnowShowGo is a semantic memory engine for AI agents, providing:

1. **4 Core Primitives** — Entity, Type, Predicate, Assertion
2. **Cognitive Memory** — WorkingMemory with Hebbian reinforcement
3. **Fuzzy Logic** — NeuroDAG propositions with WTA resolution
4. **Dual Views** — Evidence (auditable) vs Snapshot (canonical)

This document is the single source of truth for architecture and implementation.

---

## 1. The 4 Core Primitives

> "Do not exceed these in the core" — GPT-plans

| Primitive | Purpose | Implementation |
|-----------|---------|----------------|
| **Entity** | Stable UUID identity anchor | `Node` class |
| **Type** | Category/schema (also an Entity) | `Node` with `isPrototype: true` |
| **Predicate** | Property/relation kind | `Node` with `isPredicate: true` |
| **Assertion** | First-class belief with weights + provenance | `Assertion` class (NEW) |

### Assertion Model (Critical Addition)

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
    prevAssertionId = null,
    createdAt = new Date().toISOString()
  }) { ... }
}
```

**Key Principle:** Every property/value/relation is an Assertion with probabilistic truth and governance metadata.

---

## 2. Cognitive Primitives

> "The deprecated repository contains the superior ENGINE DESIGN for the memory subsystem" — Gemini 3 Pro

### 2.1 WorkingMemoryGraph

Session-scoped activation with Hebbian reinforcement ("fire together, wire together").

```javascript
class WorkingMemoryGraph {
  constructor({ reinforceDelta = 1.0, maxWeight = 100.0, decayRate = 0.1 })
  
  link(fromUuid, toUuid, initialWeight = 1.0)  // Create edge
  access(fromUuid, toUuid)                      // Reinforce on use
  decayAll()                                    // Periodic decay
  getWeight(fromUuid, toUuid)                   // Get current weight
  getActivationBoost(fromUuid, toUuid)          // For retrieval scoring
}
```

### 2.2 AsyncReplicator

Queue-based background persistence for high throughput.

```javascript
class AsyncReplicator {
  constructor(graphClient, { maxQueueSize = 10000 })
  
  enqueue(update)      // Add to persistence queue
  _processQueue()      // Batch persist to backend
}
```

### 2.3 WTA Resolution

Convert competing assertions to canonical snapshot.

```javascript
class WTAResolver {
  constructor(policy = DEFAULT_POLICY)
  
  scoreAssertion(assertion)  // Weighted scoring
  resolve(assertions)        // Returns { snapshot, evidence }
}

const DEFAULT_POLICY = {
  weights: {
    truth: 0.45,      // Probability dominates
    voteScore: 0.20,  // Community preference
    sourceRel: 0.15,  // Source reliability
    recency: 0.10,    // Recency bias
    strength: 0.10    // Association salience
  }
};
```

---

## 3. NeuroDAG: Fuzzy Logic as Graph Data

Every logical step is a first-class Node in KnowShowGo.

### Node Types

| Type | Props | Purpose |
|------|-------|---------|
| **Proposition** | `isProposition: true`, `neuro: {type, truth, prior, is_locked}` | Atomic fact |
| **Rule** | `isRule: true`, `neurodag: {type: 'IMPLICATION', weight}` | Inference |
| **Attack** | `isAttack: true`, `neurodag: {type: 'ATTACK', weight}` | Defeater |
| **CompoundDAG** | `isNeuroDAG: true`, `neurodag: {type: 'COMPOUND'}` | Container |

### Association Types for DAG Structure

| Association | Meaning |
|-------------|---------|
| `dag_source` | Source node of implication/attack |
| `dag_target` | Target node of implication/attack |
| `contains_rule` | DAG contains this rule |
| `contains_attack` | DAG contains this attack |
| `contains_prop` | DAG contains this proposition |

### Fuzzy Logic Operations

| Operation | Formula |
|-----------|---------|
| Implication | `target = source × weight` |
| Fuzzy OR | `max(v1, v2, ...)` |
| Fuzzy AND | `max(0, Σv - (n-1))` (Łukasiewicz) |
| Attack | `val × (1 - attacker × weight)` |
| Digital Snap | `v > 0.5 ? 1.0 : 0.0` |

---

## 4. API Views: Evidence vs Snapshot

### Evidence View (Auditable)
```
GET /api/entities/:id/evidence
→ Returns ALL assertions with full metadata
```

### Snapshot View (Canonical)
```
GET /api/entities/:id/snapshot
→ Returns WTA-resolved object with winning values
```

### Explain View (Debugging)
```
GET /api/entities/:id/explain?predicate=hasAge
→ Returns winner + alternatives + scoring breakdown
```

---

## 5. Implementation Status

### ✅ Implemented (Current)

| Component | File | Tests |
|-----------|------|-------|
| Node model | `src/models.js` | ✅ |
| Edge model | `src/models.js` | ✅ |
| Provenance | `src/models.js` | ✅ |
| In-Memory backend | `src/memory/in-memory.js` | ✅ |
| ArangoDB backend | `src/memory/arango-memory.js` | ⚠️ |
| REST API | `src/server/rest-api.js` | ✅ |
| ORM | `src/orm/ksg-orm.js` | ✅ |
| Prototype inheritance | `src/knowshowgo.js` | ✅ |
| Semantic search | `src/knowshowgo.js` | ✅ |

**54 tests passing | 74.57% line coverage**

### ❌ Not Yet Implemented (MVP)

| Component | Target File | Priority |
|-----------|-------------|----------|
| Assertion class | `src/models.js` | 🔴 Critical |
| WTAResolver | `src/resolution/wta-resolver.js` | 🔴 Critical |
| WorkingMemoryGraph | `src/memory/working-memory.js` | 🔴 Critical |
| Snapshot/Evidence API | `src/server/rest-api.js` | 🔴 Critical |
| AsyncReplicator | `src/memory/async-replicator.js` | 🟡 High |
| EntityFacade ORM | `src/orm/entity-facade.js` | 🟡 High |
| NeuroDAG methods | `src/knowshowgo.js` | 🟢 Medium |

---

## 6. File Structure (Target)

```
knowshowgo/
├── src/
│   ├── index.js
│   ├── knowshowgo.js           # Main API
│   ├── models.js               # Node, Edge, Assertion, Provenance
│   │
│   ├── memory/
│   │   ├── in-memory.js        # ✅ Exists
│   │   ├── arango-memory.js    # ✅ Exists
│   │   ├── working-memory.js   # ❌ NEW
│   │   └── async-replicator.js # ❌ NEW
│   │
│   ├── resolution/
│   │   └── wta-resolver.js     # ❌ NEW
│   │
│   ├── orm/
│   │   ├── ksg-orm.js          # ✅ Exists
│   │   └── entity-facade.js    # ❌ NEW
│   │
│   └── server/
│       └── rest-api.js         # ✅ Exists (needs endpoints)
│
├── tests/
│   ├── assertion.test.js       # ✅ Concepts tested
│   ├── knowshowgo.test.js      # ✅ Exists
│   ├── orm.test.js             # ✅ Exists
│   └── rest-api.test.js        # ✅ Exists
│
└── docs/
    ├── MASTER-PLAN.md          # This document
    ├── API.md
    └── OSL-AGENT-INTEGRATION-GUIDE.md
```

---

## 7. REST API (Target)

### Existing Endpoints ✅
```
POST   /api/prototypes          # Create prototype
GET    /api/prototypes          # List prototypes
POST   /api/concepts            # Create concept
GET    /api/concepts/:uuid      # Get concept
POST   /api/concepts/search     # Search concepts
POST   /api/associations        # Create association
```

### New Endpoints ❌ (MVP)
```
# Assertions
POST   /api/assertions              # Create assertion
GET    /api/assertions              # List (filter by subject/predicate)
POST   /api/assertions/:id/vote     # Vote up/down

# Snapshot & Evidence
GET    /api/entities/:id/snapshot   # WTA-resolved canonical
GET    /api/entities/:id/evidence   # All assertions (auditable)
GET    /api/entities/:id/explain    # WTA breakdown

# Working Memory
POST   /api/working-memory/link     # Create/reinforce link
POST   /api/working-memory/access   # Reinforce existing
POST   /api/working-memory/decay    # Trigger decay
GET    /api/working-memory/boost    # Get activation boost
```

---

## 8. ORM Pattern (Target)

### EntityFacade
```javascript
const bob = ksg.entity('uuid-bob');

await bob.assert('hasAge', 40, { truth: 0.95 });
const snapshot = await bob.snapshot();
const evidence = await bob.evidence();
const age = await bob.get('hasAge');
// { value: 40, evidence: [...] }
```

### NeuroDAG Methods
```javascript
const prop = await ksg.createProposition({
  label: "Server is offline",
  type: "DIGITAL",
  truth: 1.0,
  is_locked: true
});

const rule = await ksg.createRule({
  label: "Server downtime implies churn risk",
  type: "IMPLICATION",
  weight: 0.9,
  source: prop,
  target: churnRisk
});

const dag = await ksg.createDAG({
  label: "Risk Model",
  contains: [prop, rule, churnRisk]
});
```

---

## 9. Integration with osl-agent-prototype

**Guide:** `docs/OSL-AGENT-INTEGRATION-GUIDE.md`

### Existing Work (in osl-agent-prototype branches)

| Branch | Contains |
|--------|----------|
| `archived/knowshowgo-service` | FastAPI service, Python client, adapter |
| `cursor/knowshowgo-repo-push-c83c` | Handoff docs, queue integration |

### Architecture

```
osl-agent-prototype
├── WorkingMemoryGraph (local, session-scoped)
├── AsyncReplicator (local, syncs to remote)
├── DeterministicParser (local)
└── KnowShowGoClient (remote) → knowshowgo-js service
```

---

## 10. Non-Negotiables

1. **Do not store facts twice** — Graph truth is authoritative; snapshots are derived
2. **Assertions are truth-bearing** — Weights, provenance, votes live on Assertions
3. **Policies are first-class** — Resolution must be reproducible/explainable
4. **Keep primitives small** — Entity/Type/Predicate/Assertion only
5. **Hebbian reinforcement** — "Fire together, wire together" for working memory
6. **Backward compatibility** — Existing API endpoints continue to work

---

## 11. Version Roadmap

```
v0.1.0 (Current)
├── Node/Edge/Provenance models
├── In-Memory + ArangoDB backends
├── REST API (basic)
├── ORM (prototype-based)
└── 54 tests, 74.57% coverage

v0.2.0 (MVP)
├── Assertion model
├── WorkingMemoryGraph
├── WTA Resolution
├── Snapshot/Evidence API
├── EntityFacade ORM
└── AsyncReplicator

v0.3.0 (NeuroDAG)
├── NeuroDAG methods (createProposition, createRule, createDAG)
├── Voting endpoints
├── ResolutionPolicy as Entity
└── Python SDK sync

v0.4.0 (GraphRAG Phase 1)
├── Fact embeddings (assertion as sentence)
├── /api/search/facts endpoint
├── Triple text generation

v0.5.0 (GraphRAG Phase 2)
├── Hybrid search (vector → graph traversal)
├── NeuroSym reasoning integration
├── /api/graphrag/query endpoint

v0.6.0 (Link Prediction)
├── TransE predicate embeddings
├── /api/predict/link endpoint
├── /api/predict/predicate endpoint

v1.0.0 (Stable)
├── Full documentation
├── npm publish
├── osl-agent-prototype integration
└── Production deployment
```

---

## 12. GraphRAG & Advanced Embeddings (Post-MVP)

### Three Embedding Levels

| Level | What | Use Case |
|-------|------|----------|
| **Entity** | Node/concept embedding | Semantic search (current) |
| **Predicate** | TransE relationship vector | Link prediction |
| **Triple/Fact** | Assertion as sentence | Hybrid RAG search |

### TransE Link Prediction

```javascript
// Math: Subject + Predicate ≈ Object
score(s, p, o) = -||embed(s) + embed(p) - embed(o)||

// Predict missing object
predictObject(subject, predicate) → topK candidates
// Predict missing predicate  
predictPredicate(subject, object) → topK candidates
```

### GraphRAG Query Flow

```
User Query → Vector Search (facts) → Graph Traversal → NeuroSym Reasoning → WTA → Answer
```

### Future API Endpoints

```
POST /api/search/facts          # Search assertion embeddings
POST /api/predict/link          # TransE object prediction
POST /api/predict/predicate     # TransE predicate prediction
POST /api/graphrag/query        # Full hybrid RAG query
```

---

## 13. ORM Refactoring Details

### EntityFacade Pattern

```javascript
// Target ORM usage
const bob = ksg.entity('uuid-bob');

// Assert facts
await bob.assert('hasAge', 40, { truth: 0.95 });
await bob.assert('worksFor', 'acme-uuid');

// Get canonical snapshot (WTA-resolved)
const snapshot = await bob.snapshot();
// { hasAge: { value: 40, truth: 0.95 }, worksFor: { value: 'acme-uuid' } }

// Get all evidence (auditable)
const evidence = await bob.evidence();
// { hasAge: [{ value: 40, truth: 0.95 }, { value: 39, truth: 0.6 }] }

// Get specific property with evidence
const age = await bob.get('hasAge');
// { value: 40, evidence: [...] }

// Find related entities
const colleagues = await bob.related('worksFor');
```

### AssertionManager

```javascript
// Batch assertion creation
const manager = new AssertionManager(ksg);

await manager.batch([
  { subject: bob, predicate: 'hasAge', object: 40 },
  { subject: bob, predicate: 'email', object: 'bob@acme.com' }
]);

// Query assertions
const ageAssertions = await manager.getByPredicate('hasAge');
const bobAssertions = await manager.getBySubject(bob.uuid);
```

### NeuroDAGFacade

```javascript
// Create neuro structures via ORM
const neuro = ksg.neurodag();

const serverDown = await neuro.addProposition('Server is offline', {
  type: 'DIGITAL', truth: 1.0, is_locked: true
});

const churnRisk = await neuro.addProposition('Churn risk', {
  type: 'FUZZY', prior: 0.2
});

await neuro.addRule(serverDown, churnRisk, {
  type: 'IMPLICATION', weight: 0.9
});

// Solve and get results
const results = await neuro.solve();
// { 'churn_risk': 0.9 }
```

---

## 14. Quick Reference

### Create Assertion
```javascript
await ksg.createAssertion({
  subject: entityUuid,
  predicate: 'hasAge',
  object: 40,
  truth: 0.95,
  strength: 1.0,
  provenance: { source: 'user-input' }
});
```

### Get Snapshot (WTA)
```javascript
const { snapshot, evidence } = await ksg.getSnapshot(entityUuid);
// snapshot.hasAge.value → 40 (winner)
// evidence.hasAge → [all candidates with scores]
```

### Working Memory
```javascript
const wm = new WorkingMemoryGraph();
wm.link(entityA, entityB);
wm.access(entityA, entityB);  // Reinforce
wm.decayAll();                // Periodic decay
const boost = wm.getActivationBoost(entityA, entityB);
```

### NeuroDAG Inference
```javascript
// Propagation: server_down --[IMPL,w=0.9]--> churn_risk
// support = 1.0 × 0.9 = 0.9
// attack  = has_backup.truth × attack_weight
// churn_risk.truth = support × (1.0 - attack)
```

---

*Document created: 2026-01-14*  
*Version 2.0: 2026-01-17*  
*Single source of truth for all KnowShowGo planning*
