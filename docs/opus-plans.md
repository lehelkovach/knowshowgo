# Opus MVP Execution Plan for Knowshowgo

## Executive Summary

After reviewing the current codebase and the GPT refactoring recommendations, this document outlines the **fastest path to a working MVP** that aligns both visions while preserving backward compatibility.

### Current State Assessment

| Component | Status | Notes |
|-----------|--------|-------|
| Core Node/Edge model | ✅ Working | `Node`, `Edge`, `Provenance` classes |
| In-Memory backend | ✅ Working | Full test coverage |
| ArangoDB backend | ✅ Working | Production-ready |
| REST API | ✅ Working | All basic CRUD endpoints |
| ORM | ⚠️ Partial | Prototype-based, needs Assertion support |
| Assertions (first-class) | ❌ Missing | **Critical gap** |
| WTA Resolution | ❌ Missing | **Critical gap** |
| Snapshot/Evidence views | ❌ Missing | **Critical gap** |
| Voting/Governance | ❌ Missing | Can defer post-MVP |

### Key Insight: Minimal Refactor Strategy

The current architecture is **80% aligned** with the GPT recommendations:

| Current | GPT Recommendation | Alignment |
|---------|-------------------|-----------|
| `Node` (kind: 'topic') | `Entity` | ✅ Same concept |
| `Node` (isPrototype: true) | `Type` | ✅ Same concept |
| `Node` (isProperty: true) | `Predicate` | ✅ Same concept |
| `Edge` (rel, w, confidence) | `Assertion` | ⚠️ **Needs enhancement** |

**The main gap**: Edges need to become first-class `Assertions` with `truth`, `strength`, `voteScore`, and proper provenance.

---

## MVP Goals

### Primary Goals (Week 1-2)
1. **First-class Assertions** — Upgrade Edge model to support truth/strength/votes
2. **Snapshot API** — WTA resolution to produce canonical JSON from competing assertions
3. **Evidence API** — Return all assertions for auditability
4. **Working demo** — Agent can store/retrieve semantic memory with provenance

### Secondary Goals (Week 3-4)
1. **Predicates as Entities** — Property definitions stored as nodes
2. **Type templates** — Recommended predicates per Type
3. **Basic voting** — Up/down votes on assertions
4. **Resolution policies** — Configurable WTA weights

### Deferred (Post-MVP)
- NeuroProgram / factor graphs
- Full governance workflow
- Code as data representation
- Complex argumentation graphs

---

## Phase 1: Assertion-First Refactor (Days 1-3)

### 1.1 Upgrade Edge → Assertion

**File: `src/models.js`**

```javascript
export class Assertion {
  constructor({
    subject,        // Entity UUID
    predicate,      // Predicate UUID or string
    object,         // Entity UUID or literal value
    truth = 1.0,    // [0,1] probability claim is correct
    strength = 1.0, // [0,1] association salience
    voteScore = 0,  // Wilson score or simple int
    sourceRel = 1.0,// [0,1] source reliability
    provenance = null,
    status = 'accepted',
    uuid = uuidv4(),
    prevAssertionId = null
  }) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.truth = truth;
    this.strength = strength;
    this.voteScore = voteScore;
    this.sourceRel = sourceRel;
    this.provenance = provenance;
    this.status = status;
    this.uuid = uuid;
    this.prevAssertionId = prevAssertionId;
    this.createdAt = new Date().toISOString();
  }
}
```

### 1.2 Add Assertion Methods to KnowShowGo API

**File: `src/knowshowgo.js`**

```javascript
/**
 * Create an assertion (first-class claim/belief)
 */
async createAssertion({
  subject,
  predicate,
  object,
  truth = 1.0,
  strength = 1.0,
  provenance = null
}) {
  // If object is a literal, normalize to ValueEntity
  let objectUuid = object;
  if (typeof object !== 'string' || !isUUID(object)) {
    objectUuid = await this.getOrCreateValueEntity(object);
  }
  
  const assertion = new Assertion({
    subject,
    predicate,
    object: objectUuid,
    truth,
    strength,
    provenance
  });
  
  await this.memory.upsertAssertion(assertion);
  return assertion.uuid;
}

/**
 * Get all assertions for an entity (evidence view)
 */
async getEvidence(entityUuid) {
  return await this.memory.getAssertions({ subject: entityUuid });
}

/**
 * Get canonical snapshot via WTA resolution
 */
async getSnapshot(entityUuid, policyId = null) {
  const assertions = await this.getEvidence(entityUuid);
  const policy = policyId 
    ? await this.getResolutionPolicy(policyId) 
    : this.defaultPolicy;
  
  return this.resolveWTA(assertions, policy);
}
```

### 1.3 Default Resolution Policy

```javascript
const DEFAULT_POLICY = {
  weights: {
    truth: 0.45,
    voteScore: 0.20,
    sourceRel: 0.15,
    recency: 0.10,
    strength: 0.10
  },
  recencyHalfLife: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  minTruthThreshold: 0.0,
  tieBreaker: 'mostRecent'
};
```

---

## Phase 2: WTA Resolution Engine (Days 4-5)

### 2.1 Scoring Function

```javascript
/**
 * Score an assertion according to policy
 */
scoreAssertion(assertion, policy, now = Date.now()) {
  const w = policy.weights;
  const age = now - new Date(assertion.createdAt).getTime();
  const recencyScore = Math.exp(-age / policy.recencyHalfLife);
  const normVote = this.normalizeVote(assertion.voteScore);
  
  return (
    w.truth * assertion.truth +
    w.voteScore * normVote +
    w.sourceRel * assertion.sourceRel +
    w.recency * recencyScore +
    w.strength * assertion.strength
  );
}

normalizeVote(voteScore) {
  // Wilson score or simple sigmoid
  return 1 / (1 + Math.exp(-voteScore / 10));
}
```

### 2.2 WTA Resolution

```javascript
/**
 * Resolve assertions to canonical snapshot via WTA
 */
resolveWTA(assertions, policy) {
  // Group assertions by predicate
  const byPredicate = {};
  for (const a of assertions) {
    const key = typeof a.predicate === 'string' ? a.predicate : a.predicate.uuid;
    if (!byPredicate[key]) byPredicate[key] = [];
    byPredicate[key].push(a);
  }
  
  // For each predicate, pick winner
  const snapshot = {};
  const evidence = {};
  
  for (const [predKey, candidates] of Object.entries(byPredicate)) {
    // Score and sort
    const scored = candidates.map(a => ({
      assertion: a,
      score: this.scoreAssertion(a, policy)
    })).sort((x, y) => y.score - x.score);
    
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
```

---

## Phase 3: REST API Updates (Days 6-7)

### 3.1 New Endpoints

```javascript
// Assertions
router.post('/api/assertions', async (req, res) => {
  const { subject, predicate, object, truth, strength, provenance } = req.body;
  const uuid = await ksg.createAssertion({ subject, predicate, object, truth, strength, provenance });
  res.json({ uuid });
});

router.get('/api/assertions', async (req, res) => {
  const { subject, predicate } = req.query;
  const assertions = await ksg.memory.getAssertions({ subject, predicate });
  res.json(assertions);
});

router.post('/api/assertions/:id/vote', async (req, res) => {
  const { direction } = req.body; // 'up' | 'down'
  await ksg.voteAssertion(req.params.id, direction);
  res.json({ success: true });
});

// Snapshot & Evidence
router.get('/api/entities/:id/snapshot', async (req, res) => {
  const { policy } = req.query;
  const result = await ksg.getSnapshot(req.params.id, policy);
  res.json(result.snapshot);
});

router.get('/api/entities/:id/evidence', async (req, res) => {
  const assertions = await ksg.getEvidence(req.params.id);
  res.json(assertions);
});

router.get('/api/entities/:id/explain', async (req, res) => {
  const { predicate, policy } = req.query;
  const result = await ksg.getSnapshot(req.params.id, policy);
  if (predicate && result.evidence[predicate]) {
    res.json({ predicate, candidates: result.evidence[predicate] });
  } else {
    res.json(result.evidence);
  }
});

// Predicates
router.post('/api/predicates', async (req, res) => {
  const { name, valueType, cardinality, allowedTargetTypes } = req.body;
  const uuid = await ksg.createPredicate({ name, valueType, cardinality, allowedTargetTypes });
  res.json({ uuid });
});
```

---

## Phase 4: ORM Enhancement (Days 8-9)

### 4.1 Entity Facade Pattern

```javascript
class EntityFacade {
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
const snapshot = await bob.snapshot();
await bob.assert('hasAge', 40, { truth: 0.95 });
```

---

## Phase 5: Migration & Backward Compatibility (Day 10)

### 5.1 Edge → Assertion Migration

```javascript
async migrateEdgesToAssertions() {
  const edges = await this.memory.getAllEdges();
  
  for (const edge of edges) {
    // Convert Edge to Assertion
    const assertion = new Assertion({
      subject: edge.fromNode,
      predicate: edge.rel,
      object: edge.toNode,
      truth: edge.props.confidence ?? 1.0,
      strength: edge.props.w ?? 1.0,
      provenance: edge.props.provenance,
      status: edge.props.status ?? 'accepted'
    });
    
    await this.memory.upsertAssertion(assertion);
  }
}
```

### 5.2 Backward-Compatible API

Keep existing endpoints working:
- `POST /api/concepts` → creates Entity + Assertions
- `GET /api/concepts/:id` → returns snapshot view
- `POST /api/associations` → creates Assertion

---

## Implementation Order (Fastest Path)

### Week 1: Core Refactor
| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Add `Assertion` model | `src/models.js` |
| 2 | Add `createAssertion`, `getEvidence` | `src/knowshowgo.js` |
| 3 | Add `scoreAssertion`, `resolveWTA` | `src/knowshowgo.js` |
| 4 | Add `getSnapshot` endpoint | `src/server/rest-api.js` |
| 5 | Add `evidence`, `explain` endpoints | `src/server/rest-api.js` |

### Week 2: ORM & Polish
| Day | Task | Deliverable |
|-----|------|-------------|
| 6 | Add `EntityFacade` ORM | `src/orm/entity-facade.js` |
| 7 | Add Predicate as Entity | `src/knowshowgo.js` |
| 8 | Add voting endpoints | `src/server/rest-api.js` |
| 9 | Migration script | `scripts/migrate-edges.js` |
| 10 | Tests + documentation | `tests/`, `docs/` |

---

## Success Criteria for MVP

### Must Have ✅
- [ ] Create entities with UUIDs
- [ ] Create assertions (subject-predicate-object with truth/strength)
- [ ] Get snapshot (WTA-resolved canonical object)
- [ ] Get evidence (all assertions)
- [ ] Basic provenance tracking

### Should Have ⭐
- [ ] Predicates as entities
- [ ] Voting on assertions
- [ ] Explain endpoint (WTA breakdown)
- [ ] Resolution policy as entity

### Nice to Have 🎯
- [ ] Type templates
- [ ] TypeScript interfaces
- [ ] Batch assertion creation
- [ ] Cached snapshots

---

## Risk Mitigation

### Risk 1: Breaking Changes
**Mitigation**: Keep all existing endpoints working, add new `/assertions` and `/entities/:id/snapshot` alongside them.

### Risk 2: Performance
**Mitigation**: Add snapshot caching keyed by (entityUuid, policyId, maxAssertionTimestamp).

### Risk 3: Complexity Creep
**Mitigation**: Strictly limit Phase 1-5 scope. All "code as data", "factor graphs", "argumentation" features are **post-MVP**.

---

## Architecture After MVP

```
┌─────────────────────────────────────────────────────────────────┐
│                         REST API                                │
│  /entities  /assertions  /predicates  /snapshot  /evidence     │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     KnowShowGo Core                             │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Entity   │  │ Assertion │  │ Predicate│  │ WTA Resolver  │  │
│  │ (Node)   │  │ (Edge++)  │  │ (Node)   │  │ (Policy-based)│  │
│  └──────────┘  └───────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    Memory Backend                               │
│           InMemory  │  ArangoDB  │  (future: ChromaDB)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Create feature branch** `feat/assertion-first`
3. **Start Phase 1** — Add Assertion model
4. **Daily commits** with working tests
5. **Week 2** — ORM, voting, docs

---

## Appendix: Naming Alignment

| Current Code | GPT Recommendation | MVP Decision |
|--------------|-------------------|--------------|
| `Node` | `Entity` | Keep `Node`, add `Entity` alias |
| `Node.isPrototype` | `Type` | Keep as-is, Types are Nodes |
| `Node.isProperty` | `Predicate` | Rename to `isPredicate` |
| `Edge` | `Assertion` | **Add `Assertion` class**, deprecate `Edge` gradually |
| `Edge.w` | `Assertion.strength` | Rename |
| `Edge.confidence` | `Assertion.truth` | Rename |
| N/A | `Assertion.voteScore` | **Add** |
| N/A | `Assertion.sourceRel` | **Add** |

---

*Document created: 2026-01-14*  
*Author: Opus (Claude)*  
*Version: 1.0*
