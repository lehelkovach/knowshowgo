# ORM & API Refactoring Plan

**Status:** Comprehensive plan incorporating all architecture docs
**Dependencies:** opus-plans.md, NEUROSYM_MASTER_PLAN.md, GRAPHRAG-EMBEDDINGS.md

---

## 1. Current State

### Existing ORM (`src/orm/ksg-orm.js`)
- ✅ Prototype registration
- ✅ Property getters/setters (lazy loading)
- ✅ Cached JSON documents
- ✅ Static methods: `Model.create()`, `Model.get()`, `Model.find()`
- ❌ No Assertion support
- ❌ No snapshot/evidence pattern
- ❌ No NeuroDAG support
- ❌ No working memory integration

### Existing API (`src/server/rest-api.js`)
- ✅ CRUD for prototypes, concepts, associations
- ✅ Semantic search
- ✅ ORM endpoints
- ✅ Procedure/Step DAG creation
- ❌ No `/assertions` endpoints
- ❌ No `/snapshot`, `/evidence`, `/explain`
- ❌ No NeuroDAG endpoints
- ❌ No working memory endpoints

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REST API Layer                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ EXISTING                    │ NEW (MVP)              │ NEW (Post-MVP)       │
│ /prototypes                 │ /assertions            │ /neuro/solve         │
│ /concepts                   │ /entities/:id/snapshot │ /neuro/explain       │
│ /associations               │ /entities/:id/evidence │ /graphrag/query      │
│ /nodes                      │ /entities/:id/explain  │ /predict/link        │
│ /procedures                 │ /predicates            │ /search/facts        │
│ /orm/*                      │ /working-memory/*      │                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ORM Layer                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ EXISTING                    │ NEW (MVP)              │ NEW (Post-MVP)       │
│ KSGORM                      │ EntityFacade           │ NeuroDAGFacade       │
│ - registerPrototype()       │ - snapshot()           │ - solve()            │
│ - Model.create()            │ - evidence()           │ - propagate()        │
│ - Model.get()               │ - assert()             │ - explain()          │
│ - Model.find()              │ - get(predicate)       │                      │
│                             │ AssertionManager       │ GraphRAGQuery        │
│                             │ - create()             │ - search()           │
│                             │ - vote()               │ - traverse()         │
│                             │ - getBySubject()       │ - reason()           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Core Engine                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ EXISTING                    │ NEW (MVP)              │ NEW (Post-MVP)       │
│ KnowShowGo                  │ Assertion model        │ NeuroEngine          │
│ - createPrototype()         │ WTAResolver            │ TransEPredictor      │
│ - createConcept()           │ WorkingMemoryGraph     │ FactEmbedder         │
│ - addAssociation()          │ AsyncReplicator        │                      │
│ - searchConcepts()          │                        │                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ORM Refactoring

### 3.1 EntityFacade (NEW)

The KISS pattern from GPT-plans: `ksg.entity(id).snapshot()`

```javascript
// src/orm/entity-facade.js

export class EntityFacade {
  constructor(ksg, entityUuid) {
    this.ksg = ksg;
    this.uuid = entityUuid;
    this._snapshotCache = null;
    this._evidenceCache = null;
  }

  /**
   * Get WTA-resolved canonical snapshot
   */
  async snapshot(policyId = null) {
    if (this._snapshotCache && !policyId) {
      return this._snapshotCache;
    }
    const result = await this.ksg.getSnapshot(this.uuid, policyId);
    if (!policyId) this._snapshotCache = result;
    return result;
  }

  /**
   * Get all assertions (evidence view)
   */
  async evidence() {
    if (this._evidenceCache) return this._evidenceCache;
    this._evidenceCache = await this.ksg.getEvidence(this.uuid);
    return this._evidenceCache;
  }

  /**
   * Create a new assertion
   */
  async assert(predicate, value, meta = {}) {
    this._snapshotCache = null; // Invalidate cache
    this._evidenceCache = null;
    
    return await this.ksg.createAssertion({
      subject: this.uuid,
      predicate,
      object: value,
      truth: meta.truth ?? 1.0,
      strength: meta.strength ?? 1.0,
      provenance: meta.provenance,
      neuro: meta.neuro // NeuroDAG metadata
    });
  }

  /**
   * Get a specific predicate's value + evidence
   */
  async get(predicate) {
    const { snapshot, evidence } = await this.snapshot();
    return {
      value: snapshot[predicate]?.value,
      truth: snapshot[predicate]?.truth,
      assertionId: snapshot[predicate]?.assertionId,
      evidence: evidence[predicate]
    };
  }

  /**
   * Get value with type coercion
   */
  async getValue(predicate, type = 'string') {
    const result = await this.get(predicate);
    if (result.value === undefined) return undefined;
    
    switch (type) {
      case 'number': return Number(result.value);
      case 'boolean': return Boolean(result.value);
      case 'date': return new Date(result.value);
      case 'ref': return this.ksg.entity(result.value); // Return another facade
      default: return result.value;
    }
  }

  /**
   * Check if entity has a predicate with sufficient truth
   */
  async has(predicate, minTruth = 0.5) {
    const result = await this.get(predicate);
    return result.value !== undefined && result.truth >= minTruth;
  }

  /**
   * Get related entities via predicate
   */
  async related(predicate) {
    const assertions = await this.ksg.getAssertions({
      subject: this.uuid,
      predicate
    });
    return assertions.map(a => this.ksg.entity(a.object));
  }

  /**
   * Invalidate caches (call after external changes)
   */
  invalidate() {
    this._snapshotCache = null;
    this._evidenceCache = null;
  }
}

// Add to KnowShowGo class
KnowShowGo.prototype.entity = function(uuid) {
  return new EntityFacade(this, uuid);
};
```

### 3.2 AssertionManager (NEW)

Centralized assertion operations:

```javascript
// src/orm/assertion-manager.js

export class AssertionManager {
  constructor(ksg) {
    this.ksg = ksg;
  }

  /**
   * Create assertion with automatic value normalization
   */
  async create({ subject, predicate, object, truth, strength, provenance, neuro }) {
    // Normalize object to UUID if it's a literal
    let objectUuid = object;
    if (typeof object !== 'string' || !this.isUUID(object)) {
      objectUuid = await this.ksg.getOrCreateValueEntity(object);
    }

    const assertion = new Assertion({
      subject,
      predicate,
      object: objectUuid,
      truth: truth ?? 1.0,
      strength: strength ?? 1.0,
      provenance,
      neuro // { type: 'IMPLICATION'|'ATTACK', is_locked, etc. }
    });

    await this.ksg.memory.upsertAssertion(assertion);
    return assertion;
  }

  /**
   * Batch create assertions
   */
  async createBatch(assertions) {
    return Promise.all(assertions.map(a => this.create(a)));
  }

  /**
   * Vote on assertion
   */
  async vote(assertionId, direction) {
    const assertion = await this.ksg.memory.getAssertion(assertionId);
    if (!assertion) throw new Error('Assertion not found');

    assertion.voteScore += (direction === 'up' ? 1 : -1);
    await this.ksg.memory.upsertAssertion(assertion);
    return assertion;
  }

  /**
   * Get assertions by subject
   */
  async getBySubject(subjectUuid) {
    return this.ksg.memory.getAssertions({ subject: subjectUuid });
  }

  /**
   * Get assertions by predicate
   */
  async getByPredicate(predicateId) {
    return this.ksg.memory.getAssertions({ predicate: predicateId });
  }

  /**
   * Get competing assertions for subject+predicate
   */
  async getCompeting(subjectUuid, predicateId) {
    return this.ksg.memory.getAssertions({
      subject: subjectUuid,
      predicate: predicateId
    });
  }

  isUUID(str) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }
}
```

### 3.3 NeuroDAGFacade (Post-MVP)

For working with first-class NeuroDAG nodes:

```javascript
// src/orm/neurodag-facade.js

export class NeuroDAGFacade {
  constructor(ksg, dagUuid) {
    this.ksg = ksg;
    this.uuid = dagUuid;
  }

  /**
   * Create a proposition node
   */
  async addProposition({ label, type = 'FUZZY', truth, prior, is_locked }) {
    const embedding = await this.ksg.embedFn(label);
    
    const node = await this.ksg.createNode({
      label,
      props: {
        isProposition: true,
        neuro: { type, truth, prior, is_locked }
      },
      embedding
    });

    // Link to this DAG
    await this.ksg.createAssertion({
      subject: this.uuid,
      predicate: 'contains_prop',
      object: node.uuid,
      truth: 1.0
    });

    return this.ksg.entity(node.uuid);
  }

  /**
   * Create a rule (implication or attack)
   */
  async addRule({ label, type, weight, source, target }) {
    const embedding = await this.ksg.embedFn(label);

    const rule = await this.ksg.createNode({
      label,
      props: {
        isRule: true,
        isNeuroDAG: true,
        neurodag: { type, weight }
      },
      embedding
    });

    // Spell out DAG structure
    await this.ksg.createAssertion({
      subject: rule.uuid,
      predicate: 'dag_source',
      object: source,
      truth: 1.0
    });

    await this.ksg.createAssertion({
      subject: rule.uuid,
      predicate: 'dag_target',
      object: target,
      truth: 1.0
    });

    // Link to this DAG
    const containsPred = type === 'ATTACK' ? 'contains_attack' : 'contains_rule';
    await this.ksg.createAssertion({
      subject: this.uuid,
      predicate: containsPred,
      object: rule.uuid,
      truth: 1.0
    });

    return this.ksg.entity(rule.uuid);
  }

  /**
   * Reconstruct JSON NeuroDAG from nodes
   */
  async toJSON() {
    const contains = await this.ksg.getAssertions({
      subject: this.uuid,
      predicate: /contains_.*/
    });

    const nodes = [];
    const edges = [];

    for (const a of contains) {
      const node = await this.ksg.getConcept(a.object);
      
      nodes.push({
        id: node.uuid,
        type: node.props.neuro?.type || 'FUZZY',
        content: { text: node.props.label },
        state: {
          truth: node.props.neuro?.truth ?? 0.5,
          prior: node.props.neuro?.prior ?? 0.5,
          is_locked: node.props.neuro?.is_locked ?? false
        }
      });

      if (node.props.isRule) {
        const sourceAssn = await this.ksg.getAssertions({
          subject: node.uuid,
          predicate: 'dag_source'
        });
        const targetAssn = await this.ksg.getAssertions({
          subject: node.uuid,
          predicate: 'dag_target'
        });

        if (sourceAssn[0] && targetAssn[0]) {
          edges.push({
            id: node.uuid,
            source: sourceAssn[0].object,
            target: targetAssn[0].object,
            type: node.props.neurodag?.type || 'IMPLICATION',
            weight: node.props.neurodag?.weight ?? 1.0
          });
        }
      }
    }

    return { 
      graph: { id: this.uuid, mode: 'hybrid' },
      nodes, 
      edges 
    };
  }

  /**
   * Run inference on this DAG
   */
  async solve(evidence = {}, iterations = 5) {
    const schema = await this.toJSON();
    const engine = new NeuroEngine(schema);
    return engine.run(evidence, iterations);
  }
}

// Factory method
KnowShowGo.prototype.neurodag = function(uuid) {
  return new NeuroDAGFacade(this, uuid);
};

KnowShowGo.prototype.createNeuroDAG = async function({ label }) {
  const embedding = await this.embedFn(label);
  const dag = await this.createNode({
    label,
    props: {
      isNeuroDAG: true,
      neurodag: { type: 'COMPOUND' }
    },
    embedding
  });
  return new NeuroDAGFacade(this, dag.uuid);
};
```

---

## 4. API Refactoring

### 4.1 New Assertion Endpoints

```javascript
// Add to src/server/rest-api.js

// ===== Assertion Endpoints =====

/**
 * POST /api/assertions
 * Create a new assertion
 */
app.post('/api/assertions', async (req, res) => {
  try {
    const { subject, predicate, object, truth, strength, provenance, neuro } = req.body;
    
    if (!subject || !predicate || object === undefined) {
      return res.status(400).json({ 
        error: 'subject, predicate, and object are required' 
      });
    }

    const assertion = await ksg.assertions.create({
      subject, predicate, object, truth, strength, provenance, neuro
    });

    res.json({ uuid: assertion.uuid, assertion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/assertions
 * List assertions with filters
 */
app.get('/api/assertions', async (req, res) => {
  try {
    const { subject, predicate, object } = req.query;
    const assertions = await ksg.memory.getAssertions({ subject, predicate, object });
    res.json({ assertions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/assertions/:id/vote
 * Vote on an assertion
 */
app.post('/api/assertions/:id/vote', async (req, res) => {
  try {
    const { direction } = req.body;
    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be "up" or "down"' });
    }
    
    const assertion = await ksg.assertions.vote(req.params.id, direction);
    res.json({ assertion });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.2 Snapshot/Evidence Endpoints

```javascript
// ===== Entity View Endpoints (The Killer Feature) =====

/**
 * GET /api/entities/:id/snapshot
 * Get WTA-resolved canonical object
 */
app.get('/api/entities/:id/snapshot', async (req, res) => {
  try {
    const { policy } = req.query;
    const entity = ksg.entity(req.params.id);
    const result = await entity.snapshot(policy);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/entities/:id/evidence
 * Get all assertions (auditable view)
 */
app.get('/api/entities/:id/evidence', async (req, res) => {
  try {
    const entity = ksg.entity(req.params.id);
    const assertions = await entity.evidence();
    res.json({ entityId: req.params.id, assertions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/entities/:id/explain
 * Get WTA scoring breakdown
 */
app.get('/api/entities/:id/explain', async (req, res) => {
  try {
    const { predicate, policy } = req.query;
    const result = await ksg.getSnapshot(req.params.id, policy);
    
    if (predicate && result.evidence[predicate]) {
      res.json({ 
        predicate, 
        winner: result.snapshot[predicate],
        alternatives: result.evidence[predicate] 
      });
    } else {
      res.json(result.evidence);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.3 Working Memory Endpoints

```javascript
// ===== Working Memory Endpoints =====

/**
 * POST /api/working-memory/link
 * Create or get link between entities
 */
app.post('/api/working-memory/link', async (req, res) => {
  try {
    const { from, to, initialWeight } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to are required' });
    }
    
    const weight = ksg.workingMemory.link(from, to, initialWeight);
    res.json({ from, to, weight });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/working-memory/access
 * Reinforce link (Hebbian learning)
 */
app.post('/api/working-memory/access', async (req, res) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to are required' });
    }
    
    const weight = ksg.workingMemory.access(from, to);
    res.json({ from, to, weight });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/working-memory/decay
 * Trigger decay on all weights
 */
app.post('/api/working-memory/decay', async (req, res) => {
  try {
    ksg.workingMemory.decayAll();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/working-memory/boost
 * Get activation boost for a link
 */
app.get('/api/working-memory/boost', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to are required' });
    }
    
    const boost = ksg.workingMemory.getActivationBoost(from, to);
    res.json({ from, to, boost });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4.4 NeuroDAG Endpoints (Post-MVP)

```javascript
// ===== NeuroDAG Endpoints =====

/**
 * POST /api/neuro/dag
 * Create a new NeuroDAG
 */
app.post('/api/neuro/dag', async (req, res) => {
  try {
    const { label } = req.body;
    if (!label) {
      return res.status(400).json({ error: 'label is required' });
    }
    
    const dag = await ksg.createNeuroDAG({ label });
    res.json({ uuid: dag.uuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neuro/dag/:id/proposition
 * Add a proposition to a DAG
 */
app.post('/api/neuro/dag/:id/proposition', async (req, res) => {
  try {
    const { label, type, truth, prior, is_locked } = req.body;
    const dag = ksg.neurodag(req.params.id);
    const prop = await dag.addProposition({ label, type, truth, prior, is_locked });
    res.json({ uuid: prop.uuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neuro/dag/:id/rule
 * Add a rule (implication/attack) to a DAG
 */
app.post('/api/neuro/dag/:id/rule', async (req, res) => {
  try {
    const { label, type, weight, source, target } = req.body;
    const dag = ksg.neurodag(req.params.id);
    const rule = await dag.addRule({ label, type, weight, source, target });
    res.json({ uuid: rule.uuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/neuro/dag/:id/solve
 * Run inference on a DAG
 */
app.post('/api/neuro/dag/:id/solve', async (req, res) => {
  try {
    const { evidence, iterations } = req.body;
    const dag = ksg.neurodag(req.params.id);
    const result = await dag.solve(evidence || {}, iterations || 5);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/neuro/dag/:id
 * Get DAG as JSON
 */
app.get('/api/neuro/dag/:id', async (req, res) => {
  try {
    const dag = ksg.neurodag(req.params.id);
    const json = await dag.toJSON();
    res.json(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 5. Implementation Phases

### Phase 1: Core Assertion Support (Week 1)

| File | Changes |
|------|---------|
| `src/models.js` | Add `Assertion` class |
| `src/memory/in-memory.js` | Add assertion storage/retrieval |
| `src/memory/arango-memory.js` | Add assertion collection |
| `src/knowshowgo.js` | Add `createAssertion()`, `getEvidence()`, `getSnapshot()` |
| `src/resolution/wta-resolver.js` | NEW: WTA scoring and resolution |
| `tests/assertion.test.js` | NEW: Assertion tests |

### Phase 2: ORM Enhancement (Week 2)

| File | Changes |
|------|---------|
| `src/orm/entity-facade.js` | NEW: `entity(id).snapshot()` pattern |
| `src/orm/assertion-manager.js` | NEW: Centralized assertion ops |
| `src/knowshowgo.js` | Add `entity()` factory method |
| `src/memory/working-memory.js` | NEW: WorkingMemoryGraph |
| `tests/entity-facade.test.js` | NEW: Facade tests |

### Phase 3: API Endpoints (Week 2-3)

| File | Changes |
|------|---------|
| `src/server/rest-api.js` | Add assertion endpoints |
| `src/server/rest-api.js` | Add snapshot/evidence endpoints |
| `src/server/rest-api.js` | Add working memory endpoints |
| `tests/rest-api.test.js` | Add new endpoint tests |

### Phase 4: NeuroDAG Support (Week 3-4)

| File | Changes |
|------|---------|
| `src/orm/neurodag-facade.js` | NEW: NeuroDAG ORM |
| `src/libs/neurosym/engine.js` | NEW: NeuroSym engine |
| `src/server/rest-api.js` | Add neuro endpoints |
| `tests/neurodag.test.js` | NEW: NeuroDAG tests |

---

## 6. API Reference (After Refactor)

### Entities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/entities/:id` | Get entity |
| GET | `/api/entities/:id/snapshot` | WTA-resolved view |
| GET | `/api/entities/:id/evidence` | All assertions |
| GET | `/api/entities/:id/explain` | WTA breakdown |

### Assertions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assertions` | Create assertion |
| GET | `/api/assertions` | List with filters |
| POST | `/api/assertions/:id/vote` | Vote up/down |

### Working Memory
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/working-memory/link` | Create link |
| POST | `/api/working-memory/access` | Reinforce link |
| POST | `/api/working-memory/decay` | Decay all |
| GET | `/api/working-memory/boost` | Get boost |

### NeuroDAG (Post-MVP)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/neuro/dag` | Create DAG |
| POST | `/api/neuro/dag/:id/proposition` | Add proposition |
| POST | `/api/neuro/dag/:id/rule` | Add rule |
| POST | `/api/neuro/dag/:id/solve` | Run inference |
| GET | `/api/neuro/dag/:id` | Get DAG JSON |

---

## 7. ORM Usage Examples

### EntityFacade Pattern
```javascript
// Get entity and work with it
const bob = ksg.entity('uuid-bob');

// Create assertion
await bob.assert('hasAge', 40, { truth: 0.95 });
await bob.assert('worksFor', 'uuid-acme', { truth: 1.0 });

// Get snapshot (WTA-resolved)
const snapshot = await bob.snapshot();
console.log(snapshot.hasAge.value); // 40

// Get specific predicate with evidence
const age = await bob.get('hasAge');
console.log(age.value);    // 40
console.log(age.truth);    // 0.95
console.log(age.evidence); // [{ assertionId, value, score }, ...]

// Type-safe access
const ageNum = await bob.getValue('hasAge', 'number');
const employer = await bob.getValue('worksFor', 'ref'); // Returns EntityFacade
```

### NeuroDAG Pattern
```javascript
// Create a risk model DAG
const riskModel = await ksg.createNeuroDAG({ label: 'Server Risk Model' });

// Add propositions
const serverDown = await riskModel.addProposition({
  label: 'Server is offline',
  type: 'DIGITAL',
  truth: 1.0,
  is_locked: true
});

const hasBackup = await riskModel.addProposition({
  label: 'Backup available',
  type: 'DIGITAL',
  truth: 1.0,
  is_locked: true
});

const churnRisk = await riskModel.addProposition({
  label: 'Churn risk',
  type: 'FUZZY',
  prior: 0.2
});

// Add rules
await riskModel.addRule({
  label: 'Downtime implies churn',
  type: 'IMPLICATION',
  weight: 0.9,
  source: serverDown.uuid,
  target: churnRisk.uuid
});

await riskModel.addRule({
  label: 'Backup negates churn',
  type: 'ATTACK',
  weight: 1.0,
  source: hasBackup.uuid,
  target: churnRisk.uuid
});

// Run inference
const result = await riskModel.solve();
console.log(result[churnRisk.uuid]); // 0.0 (backup defeats risk)
```

---

*Document created: 2026-01-14*
*Status: Comprehensive ORM/API refactoring plan*
