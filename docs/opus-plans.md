# Opus MVP Execution Plan for Knowshowgo

## Executive Summary

This plan synthesizes recommendations from three sources:
1. **GPT-plans.md** — 4-primitive model (Entity/Type/Predicate/Assertion), WTA resolution
2. **salvage-knowshowgo.txt** — Cognitive primitives (WorkingMemoryGraph, AsyncReplicator, Hebbian learning)
3. **Current codebase analysis** — What exists vs what's missing

### The Critical Insight

> "osl-agent-prototype is the superior **product**, but this repository contains the superior **ENGINE DESIGN** for the memory subsystem." — Gemini 3 Pro

This JS implementation has:
- ✅ Good REST API, ArangoDB backend, basic ORM
- ❌ **Missing**: WorkingMemoryGraph, activation/decay, async replication
- ❌ **Missing**: First-class Assertions with truth/strength/votes
- ❌ **Missing**: WTA resolution for snapshot canonicalization

**The MVP must bridge both gaps**: Add cognitive primitives AND assertion-first data model.

---

## Unified Architecture Vision

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REST API Layer                                  │
│  /entities  /assertions  /predicates  /snapshot  /evidence  /working-memory│
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          KnowShowGo Core Engine                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │ Entity (Node)  │  │   Assertion    │  │  Predicate     │                 │
│  │ Type/Prototype │  │ (truth/strength│  │ (schema-as-    │                 │
│  │ stable UUID    │  │  votes/prov)   │  │  data)         │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
│                                                                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │ WorkingMemory  │  │ WTA Resolver   │  │ AsyncReplicator│                 │
│  │ (activation,   │  │ (policy-based  │  │ (queue-based   │                 │
│  │  Hebbian)      │  │  canonicalize) │  │  persistence)  │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Memory Backend Layer                               │
│              InMemory  │  ArangoDB  │  (future: ChromaDB, Neo4j)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current State vs Target State

### What We Have (JS Implementation)

| Component | Status | File |
|-----------|--------|------|
| Node model | ✅ Working | `src/models.js` |
| Edge model | ✅ Working | `src/models.js` |
| Provenance | ✅ Working | `src/models.js` |
| In-Memory backend | ✅ Working | `src/memory/in-memory.js` |
| ArangoDB backend | ✅ Working | `src/memory/arango-memory.js` |
| REST API | ✅ Working | `src/server/rest-api.js` |
| Basic ORM | ⚠️ Partial | `src/orm/ksg-orm.js` |
| Prototype inheritance | ✅ Working | `src/knowshowgo.js` |
| Concept creation | ✅ Working | `src/knowshowgo.js` |
| Semantic search | ✅ Working | `src/knowshowgo.js` |

### What's Missing (Critical Gaps)

| Component | Source | Priority |
|-----------|--------|----------|
| **Assertion model** | GPT-plans | 🔴 Critical |
| **WTA Resolution** | GPT-plans | 🔴 Critical |
| **Snapshot/Evidence API** | GPT-plans | 🔴 Critical |
| **WorkingMemoryGraph** | Salvage plan | 🔴 Critical |
| **Activation/Decay** | Salvage plan | 🟡 High |
| **AsyncReplicator** | Salvage plan | 🟡 High |
| **Deterministic parsing** | Salvage plan | 🟢 Medium |
| **Voting/governance** | GPT-plans | 🟢 Medium |

---

## The 4 Core Primitives (Non-Negotiable)

From GPT-plans — **do not exceed these in the core**:

### 1. Entity (Token/Topic/Concept)
Stable UUID identity anchor. Our current `Node` class.
```javascript
// Already exists as Node - add Entity alias
export { Node as Entity } from './models.js';
```

### 2. Type (Prototype)  
Category/schema token. Our current `Node` with `isPrototype: true`.
```javascript
// Already exists - no change needed
node.props.isPrototype = true;
```

### 3. Predicate
Property/relation kind. Currently `Node` with `isProperty: true`, rename to `isPredicate`.
```javascript
// Enhance existing Property node
node.props.isPredicate = true;
node.props.valueType = 'string|number|boolean|entity_ref|...';
node.props.cardinality = 'single|multiple';
```

### 4. Assertion (NEW - Critical Gap)
First-class belief/claim connecting subject–predicate–object with weights + provenance.
```javascript
// NEW CLASS - this is the key addition
export class Assertion {
  constructor({
    subject,           // Entity UUID
    predicate,         // Predicate UUID or string
    object,            // Entity UUID or literal value
    truth = 1.0,       // [0,1] probability claim is correct
    strength = 1.0,    // [0,1] association salience  
    voteScore = 0,     // Wilson score or int
    sourceRel = 1.0,   // [0,1] provenance reliability
    provenance = null,
    status = 'accepted',
    uuid = uuidv4(),
    prevAssertionId = null,
    createdAt = new Date().toISOString()
  }) { ... }
}
```

---

## The 3 Cognitive Primitives (From Salvage Plan)

These are what make knowshowgo's engine design **superior**:

### 1. WorkingMemoryGraph (NEW - Critical Gap)
Session-scoped activation with Hebbian reinforcement.

```javascript
// NEW FILE: src/memory/working-memory.js
export class WorkingMemoryGraph {
  constructor({ reinforceDelta = 1.0, maxWeight = 100.0, decayRate = 0.1 }) {
    this.weights = new Map();  // Map<"from:to", weight>
    this.reinforceDelta = reinforceDelta;
    this.maxWeight = maxWeight;
    this.decayRate = decayRate;
  }

  // Link two entities (create edge if not exists)
  link(fromUuid, toUuid, initialWeight = 1.0) {
    const key = `${fromUuid}:${toUuid}`;
    if (!this.weights.has(key)) {
      this.weights.set(key, initialWeight);
    }
    return this.weights.get(key);
  }

  // Access reinforces the edge (Hebbian: "fire together, wire together")
  access(fromUuid, toUuid) {
    const key = `${fromUuid}:${toUuid}`;
    const current = this.weights.get(key) || 0;
    const newWeight = Math.min(current + this.reinforceDelta, this.maxWeight);
    this.weights.set(key, newWeight);
    return newWeight;
  }

  // Decay all weights (call periodically)
  decayAll() {
    for (const [key, weight] of this.weights.entries()) {
      const decayed = weight * (1 - this.decayRate);
      if (decayed < 0.01) {
        this.weights.delete(key);
      } else {
        this.weights.set(key, decayed);
      }
    }
  }

  // Get activation boost for retrieval scoring
  getActivationBoost(fromUuid, toUuid) {
    const key = `${fromUuid}:${toUuid}`;
    return this.weights.get(key) || 0;
  }

  getWeight(fromUuid, toUuid) {
    return this.weights.get(`${fromUuid}:${toUuid}`) || 0;
  }
}
```

### 2. AsyncReplicator (NEW - High Priority)
Queue-based background persistence for high throughput.

```javascript
// NEW FILE: src/memory/async-replicator.js
export class EdgeUpdate {
  constructor({ source, target, delta, maxWeight }) {
    this.source = source;
    this.target = target;
    this.delta = delta;
    this.maxWeight = maxWeight;
    this.timestamp = Date.now();
  }
}

export class AsyncReplicator {
  constructor(graphClient, { maxQueueSize = 10000 } = {}) {
    this.client = graphClient;
    this.queue = [];
    this.maxQueueSize = maxQueueSize;
    this.processing = false;
  }

  enqueue(update) {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn('AsyncReplicator queue full, dropping oldest');
      this.queue.shift();
    }
    this.queue.push(update);
    this._processQueue();
  }

  async _processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, 100); // Process in batches
        await Promise.all(batch.map(u => 
          this.client.incrementEdgeWeight(u.source, u.target, u.delta, u.maxWeight)
        ));
      }
    } finally {
      this.processing = false;
    }
  }
}
```

### 3. WTA Resolution Engine (NEW - Critical Gap)
Convert competing assertions to canonical snapshot.

```javascript
// NEW FILE: src/resolution/wta-resolver.js
export const DEFAULT_POLICY = {
  weights: {
    truth: 0.45,      // Probability dominates
    voteScore: 0.20,  // Community preference
    sourceRel: 0.15,  // Source reliability
    recency: 0.10,    // Recency bias
    strength: 0.10    // Association salience
  },
  recencyHalfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
  minTruthThreshold: 0.0,
  tieBreaker: 'mostRecent'
};

export class WTAResolver {
  constructor(policy = DEFAULT_POLICY) {
    this.policy = policy;
  }

  scoreAssertion(assertion, now = Date.now()) {
    const w = this.policy.weights;
    const age = now - new Date(assertion.createdAt).getTime();
    const recencyScore = Math.exp(-age / this.policy.recencyHalfLife);
    const normVote = 1 / (1 + Math.exp(-assertion.voteScore / 10));

    return (
      w.truth * assertion.truth +
      w.voteScore * normVote +
      w.sourceRel * assertion.sourceRel +
      w.recency * recencyScore +
      w.strength * assertion.strength
    );
  }

  resolve(assertions) {
    // Group by predicate
    const byPredicate = {};
    for (const a of assertions) {
      const key = typeof a.predicate === 'string' ? a.predicate : a.predicate;
      if (!byPredicate[key]) byPredicate[key] = [];
      byPredicate[key].push(a);
    }

    const snapshot = {};
    const evidence = {};

    for (const [predKey, candidates] of Object.entries(byPredicate)) {
      const scored = candidates
        .map(a => ({ assertion: a, score: this.scoreAssertion(a) }))
        .sort((x, y) => y.score - x.score);

      const winner = scored[0];
      snapshot[predKey] = {
        value: winner.assertion.object,
        assertionId: winner.assertion.uuid,
        truth: winner.assertion.truth,
        score: winner.score
      };

      evidence[predKey] = scored.map(s => ({
        assertionId: s.assertion.uuid,
        value: s.assertion.object,
        score: s.score,
        truth: s.assertion.truth
      }));
    }

    return { snapshot, evidence };
  }
}
```

---

## MVP Implementation Plan (3 Weeks)

### Week 1: Core Primitives (Days 1-5)

| Day | Task | Deliverable | Tests |
|-----|------|-------------|-------|
| 1 | Add `Assertion` class | `src/models.js` | ✅ |
| 2 | Add `WorkingMemoryGraph` | `src/memory/working-memory.js` | ✅ |
| 3 | Add `WTAResolver` | `src/resolution/wta-resolver.js` | ✅ |
| 4 | Add assertion methods to KSG | `src/knowshowgo.js` | ✅ |
| 5 | Add snapshot/evidence methods | `src/knowshowgo.js` | ✅ |

**Day 1: Assertion Model**
```javascript
// src/models.js - ADD
export class Assertion {
  constructor({ subject, predicate, object, truth, strength, voteScore, sourceRel, provenance, status, uuid, prevAssertionId }) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.truth = truth ?? 1.0;
    this.strength = strength ?? 1.0;
    this.voteScore = voteScore ?? 0;
    this.sourceRel = sourceRel ?? 1.0;
    this.provenance = provenance;
    this.status = status ?? 'accepted';
    this.uuid = uuid ?? uuidv4();
    this.prevAssertionId = prevAssertionId;
    this.createdAt = new Date().toISOString();
  }
}
```

**Day 2: WorkingMemoryGraph**
- Create `src/memory/working-memory.js`
- Implement `link()`, `access()`, `decayAll()`, `getActivationBoost()`
- Add tests in `tests/working-memory.test.js`

**Day 3: WTA Resolver**
- Create `src/resolution/wta-resolver.js`
- Implement scoring function and resolution
- Add tests in `tests/wta-resolver.test.js`

**Day 4-5: KSG Integration**
```javascript
// src/knowshowgo.js - ADD methods
async createAssertion({ subject, predicate, object, truth, strength, provenance }) { ... }
async getEvidence(entityUuid) { ... }
async getSnapshot(entityUuid, policyId = null) { ... }
```

### Week 2: REST API & ORM (Days 6-10)

| Day | Task | Deliverable | Tests |
|-----|------|-------------|-------|
| 6 | Assertion endpoints | `src/server/rest-api.js` | ✅ |
| 7 | Snapshot/Evidence endpoints | `src/server/rest-api.js` | ✅ |
| 8 | EntityFacade ORM | `src/orm/entity-facade.js` | ✅ |
| 9 | AsyncReplicator | `src/memory/async-replicator.js` | ✅ |
| 10 | Integration tests | `tests/integration/` | ✅ |

**New REST Endpoints (Day 6-7)**
```javascript
// Assertions
POST   /api/assertions              // Create assertion
GET    /api/assertions              // List (filter by subject/predicate)
POST   /api/assertions/:id/vote     // Vote up/down

// Snapshot & Evidence (the killer feature)
GET    /api/entities/:id/snapshot   // WTA-resolved canonical object
GET    /api/entities/:id/evidence   // All assertions (auditable)
GET    /api/entities/:id/explain    // WTA breakdown per predicate

// Working Memory (session-scoped)
POST   /api/working-memory/link     // Create/reinforce link
POST   /api/working-memory/access   // Reinforce existing link
POST   /api/working-memory/decay    // Trigger decay
GET    /api/working-memory/boost    // Get activation boost
```

**EntityFacade ORM (Day 8)**
```javascript
// src/orm/entity-facade.js
export class EntityFacade {
  constructor(ksg, entityUuid) {
    this.ksg = ksg;
    this.uuid = entityUuid;
  }

  async snapshot(policyId = null) {
    return await this.ksg.getSnapshot(this.uuid, policyId);
  }

  async evidence() {
    return await this.ksg.getEvidence(this.uuid);
  }

  async assert(predicate, value, meta = {}) {
    return await this.ksg.createAssertion({
      subject: this.uuid,
      predicate,
      object: value,
      truth: meta.truth ?? 1.0,
      strength: meta.strength ?? 1.0,
      provenance: meta.provenance
    });
  }

  async get(predicate) {
    const { snapshot, evidence } = await this.ksg.getSnapshot(this.uuid);
    return {
      value: snapshot[predicate]?.value,
      evidence: evidence[predicate]
    };
  }
}

// Usage
const bob = ksg.entity('uuid-bob');
await bob.assert('hasAge', 40, { truth: 0.95 });
const snapshot = await bob.snapshot();
```

### Week 3: Polish & Documentation (Days 11-15)

| Day | Task | Deliverable |
|-----|------|-------------|
| 11 | Migration script (Edge → Assertion) | `scripts/migrate-edges.js` |
| 12 | Predicate as Entity | `src/knowshowgo.js` |
| 13 | ResolutionPolicy as Entity | `src/knowshowgo.js` |
| 14 | Documentation update | `docs/API.md`, `README.md` |
| 15 | End-to-end demo | `examples/agent-memory.js` |

---

## File Structure After MVP

```
knowshowgo/
├── src/
│   ├── index.js                    # Public exports
│   ├── knowshowgo.js               # Main API (ENHANCED)
│   ├── models.js                   # Node, Edge, Assertion, Provenance
│   │
│   ├── memory/
│   │   ├── in-memory.js            # Existing
│   │   ├── arango-memory.js        # Existing
│   │   ├── working-memory.js       # NEW: WorkingMemoryGraph
│   │   └── async-replicator.js     # NEW: AsyncReplicator
│   │
│   ├── resolution/
│   │   └── wta-resolver.js         # NEW: WTA canonicalization
│   │
│   ├── orm/
│   │   ├── ksg-orm.js              # Existing (prototype-based)
│   │   └── entity-facade.js        # NEW: entity(id).snapshot()
│   │
│   └── server/
│       └── rest-api.js             # ENHANCED: new endpoints
│
├── tests/
│   ├── knowshowgo.test.js          # Existing
│   ├── assertion.test.js           # NEW
│   ├── working-memory.test.js      # NEW
│   ├── wta-resolver.test.js        # NEW
│   └── integration/
│       └── agent-memory.test.js    # NEW
│
├── scripts/
│   └── migrate-edges.js            # NEW: Edge → Assertion migration
│
└── examples/
    └── agent-memory.js             # NEW: Demo for osl-agent-prototype
```

---

## API Views: Evidence vs Snapshot

This is the **killer feature** that differentiates knowshowgo:

### Evidence View (Auditable Ground Truth)
```javascript
GET /api/entities/:id/evidence

// Returns ALL assertions with full metadata
{
  "entityId": "uuid-bob",
  "assertions": [
    {
      "uuid": "assertion-1",
      "predicate": "hasAge",
      "object": 40,
      "truth": 0.95,
      "strength": 1.0,
      "voteScore": 5,
      "sourceRel": 0.9,
      "provenance": { "source": "user-input", "ts": "2026-01-14" },
      "status": "accepted"
    },
    {
      "uuid": "assertion-2",
      "predicate": "hasAge",
      "object": 39,  // Competing claim!
      "truth": 0.6,
      "strength": 0.8,
      "voteScore": -2,
      "sourceRel": 0.5,
      "provenance": { "source": "inferred", "ts": "2026-01-10" },
      "status": "accepted"
    }
  ]
}
```

### Snapshot View (Developer-Friendly)
```javascript
GET /api/entities/:id/snapshot

// Returns WTA-resolved canonical object
{
  "entityId": "uuid-bob",
  "snapshot": {
    "hasAge": {
      "value": 40,           // Winner!
      "assertionId": "assertion-1",
      "truth": 0.95,
      "score": 0.87
    },
    "worksFor": {
      "value": "uuid-acme-corp",
      "assertionId": "assertion-3",
      "truth": 1.0,
      "score": 0.92
    }
  }
}
```

### Explain View (Debugging)
```javascript
GET /api/entities/:id/explain?predicate=hasAge

// Shows WTA breakdown
{
  "predicate": "hasAge",
  "winner": {
    "assertionId": "assertion-1",
    "value": 40,
    "score": 0.87,
    "breakdown": {
      "truth": 0.95 * 0.45 = 0.4275,
      "voteScore": 0.73 * 0.20 = 0.146,
      "sourceRel": 0.9 * 0.15 = 0.135,
      "recency": 0.95 * 0.10 = 0.095,
      "strength": 1.0 * 0.10 = 0.10
    }
  },
  "alternatives": [
    {
      "assertionId": "assertion-2",
      "value": 39,
      "score": 0.52
    }
  ]
}
```

---

## Integration with osl-agent-prototype

### Option 1: REST API Client (Recommended for MVP)
```python
# In osl-agent-prototype
from knowshowgo_client import KnowShowGoClient

client = KnowShowGoClient("http://localhost:3000")

# Store a memory
await client.create_assertion(
    subject="task-123",
    predicate="status",
    object="completed",
    truth=1.0,
    provenance={"source": "agent-execution"}
)

# Retrieve canonical state
snapshot = await client.get_snapshot("task-123")
print(snapshot["status"]["value"])  # "completed"
```

### Option 2: Dual Implementation (Long-term)
Mirror the JS implementation in Python for osl-agent-prototype:
```
knowshowgo (JS - this repo)     →  canonical source
    ↓ sync
osl-agent-prototype (Python)    →  uses as dependency or mirrored code
```

---

## Success Criteria for MVP

### Must Have ✅ (Week 1-2)
- [ ] `Assertion` model with truth/strength/voteScore/sourceRel
- [ ] `WorkingMemoryGraph` with link/access/decay
- [ ] `WTAResolver` with configurable policy
- [ ] `createAssertion()`, `getEvidence()`, `getSnapshot()` API
- [ ] REST endpoints for assertions, snapshot, evidence
- [ ] `EntityFacade` ORM with `entity(id).snapshot()` pattern
- [ ] All existing tests still pass
- [ ] 10+ new tests for new components

### Should Have ⭐ (Week 3)
- [ ] `AsyncReplicator` for background persistence
- [ ] Predicates as Entities
- [ ] `ResolutionPolicy` as Entity
- [ ] Migration script for existing edges
- [ ] Updated API documentation

### Nice to Have 🎯 (Post-MVP)
- [ ] Voting endpoints
- [ ] Deterministic parsing (from salvage plan)
- [ ] Type templates
- [ ] Cached snapshots
- [ ] Python SDK sync

---

## Non-Negotiables (From All Sources)

1. **Do not store facts twice** — Graph truth is authoritative; JSON snapshots are derived
2. **Assertions are truth-bearing units** — Weights, provenance, votes live on Assertions
3. **Policies are first-class** — Resolution must be reproducible and explainable
4. **Keep core primitives small** — Entity/Type/Predicate/Assertion only
5. **Hebbian reinforcement** — "Fire together, wire together" for working memory
6. **Backward compatibility** — Existing API endpoints continue to work

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking changes | Keep all existing endpoints, add new ones alongside |
| Performance | Add snapshot caching keyed by (entityUuid, policyId, maxTimestamp) |
| Complexity creep | Defer factor graphs, argumentation, code-as-data to post-MVP |
| Integration issues | Create `examples/agent-memory.js` demo early |

---

## Next Steps (Immediate Actions)

1. **Create feature branch**: `git checkout -b feat/assertion-first-mvp`
2. **Day 1**: Add `Assertion` class to `src/models.js`
3. **Day 2**: Create `src/memory/working-memory.js` with tests
4. **Day 3**: Create `src/resolution/wta-resolver.js` with tests
5. **Commit daily** with working tests
6. **Week 2**: REST API endpoints, EntityFacade ORM
7. **Week 3**: Polish, docs, demo

---

## Version Roadmap

```
v0.2.0 (This MVP)
├── Assertion model
├── WorkingMemoryGraph
├── WTA Resolution
├── Snapshot/Evidence API
└── EntityFacade ORM

v0.3.0 (Post-MVP)
├── AsyncReplicator
├── Voting endpoints
├── Deterministic parsing
└── Python SDK sync

v1.0.0 (Stable)
├── Full documentation
├── PyPI/npm publish
├── osl-agent-prototype integration
└── Production deployment
```

---

*Document created: 2026-01-14*  
*Author: Opus (Claude)*  
*Version: 2.0 — Synthesized from GPT-plans, salvage-knowshowgo, and codebase analysis*
