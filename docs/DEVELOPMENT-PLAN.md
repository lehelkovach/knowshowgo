# KnowShowGo Development Plan

**Version:** 4.0  
**Date:** 2026-01-17  
**North Star:** KnowShowGo is a semantic memory engine where **Assertions are the only truth-bearing units**, Evidence is auditable, Snapshot is canonical-by-policy, and prototype-theory emerges from exemplar aggregation.

---

## Table of Contents

1. [Prime Directives](#1-prime-directives)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Primitives](#3-core-primitives)
4. [Claims & Deduplication](#4-claims--deduplication)
5. [NeuroSym Logic Engine](#5-neurosym-logic-engine)
6. [Staged Implementation](#6-staged-implementation)
7. [API Reference](#7-api-reference)
8. [ORM & Client SDK](#8-orm--client-sdk)
9. [osl-agent-prototype Integration](#9-osl-agent-prototype-integration)
10. [Deployment & Debugging](#10-deployment--debugging)
11. [Repo Strategy](#11-repo-strategy)
12. [Definition of Done](#12-definition-of-done)

---

## 1. Prime Directives

**Do not violate these principles:**

1. **Do not store facts twice** — Graph of Assertions is authoritative; snapshots are derived
2. **Assertions are truth-bearing** — truth/strength/voteScore/sourceRel/provenance live on Assertions
3. **Resolver policy is reproducible** — WTA must explain why a value won
4. **Everything writes to the spine** — UI, ORM, seeder, procedures, logic graphs all create Assertions
5. **Backward compatible endpoints** — Preserve existing API shapes while transitioning
6. **Embeddings are indexes, not truth** — Embeddings help retrieval/clustering; Assertions determine truth

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KnowShowGo Architecture                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Agents    │    │  Curator UI │    │   Seeder    │    │  NeuroSym   │  │
│  │ (osl-agent) │    │   (Human)   │    │  (Import)   │    │  (Logic)    │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┴──────────────────┴──────────────────┘          │
│                                    │                                         │
│                          ┌─────────▼─────────┐                              │
│                          │    REST API       │                              │
│                          │  /api/assertions  │                              │
│                          │  /api/snapshot    │                              │
│                          │  /api/neuro/solve │                              │
│                          └─────────┬─────────┘                              │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │ Assertions  │          │  WTA        │          │  Claim      │         │
│  │ (Truth)     │◄────────►│  Resolver   │◄────────►│  Clusters   │         │
│  └─────────────┘          └─────────────┘          └─────────────┘         │
│         │                          │                          │             │
│         │                          ▼                          │             │
│         │                 ┌─────────────┐                     │             │
│         │                 │  Snapshot   │                     │             │
│         │                 │  (Derived)  │                     │             │
│         │                 └─────────────┘                     │             │
│         │                                                     │             │
│         └─────────────────────────┬───────────────────────────┘             │
│                                   │                                          │
│                          ┌────────▼────────┐                                │
│                          │  Memory Backend │                                │
│                          │ (InMem/Arango)  │                                │
│                          └─────────────────┘                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Primitives

### 3.1 The Four Primitives

| Primitive | Purpose | Key Properties |
|-----------|---------|----------------|
| **Entity** | Stable UUID identity anchor | `uuid`, `embedding`, `labels` |
| **Type** | Category/schema (also an Entity) | `isPrototype: true`, `centroid` |
| **Predicate** | Property/relation kind | `isPredicate: true`, `valueType` |
| **Assertion** | First-class belief with weights | See below |

### 3.2 Assertion Model (The Spine)

```typescript
interface Assertion {
  uuid: string;
  
  // Triple
  subject: string;      // Entity UUID
  predicate: string;    // Predicate UUID or string
  object: string | any; // Entity UUID or literal value
  
  // Truth-bearing weights
  truth: TruthValue;      // [0,1] probability claim is correct
  strength: TruthValue;   // [0,1] association salience
  voteScore: number;      // Community votes (+/-)
  sourceRel: TruthValue;  // [0,1] source reliability
  
  // Metadata
  provenance: Provenance;
  status: 'pending' | 'accepted' | 'disputed' | 'merged' | 'retracted';
  prevAssertionId?: string; // For edit lineage
  
  // Deduplication (optional)
  clusterId?: string;     // Claim cluster membership
  isCanonical?: boolean;  // Is this the merged winner?
}
```

### 3.3 Provenance Envelope

```typescript
interface Provenance {
  source: 'user' | 'agent' | 'llm' | 'import' | 'system';
  sourceRef?: string;     // userId, agentId, URL
  method: 'manual' | 'llm_extract' | 'import_wikidata' | 'solver_neurodag' | 'observation';
  ts: string;             // ISO-8601
  traceId: string;        // Run/session UUID
  inputs?: string[];      // Input assertion UUIDs (for derived)
  confidence: TruthValue;
}
```

### 3.4 WTA Resolver

```typescript
const DEFAULT_POLICY = {
  weights: {
    truth: 0.35,
    voteScore: 0.20,
    sourceRel: 0.20,
    recency: 0.15,
    strength: 0.10
  },
  tieBreaker: 'most_recent'
};

class WTAResolver {
  scoreAssertion(a: Assertion): number {
    return (
      a.truth * weights.truth +
      normalize(a.voteScore) * weights.voteScore +
      a.sourceRel * weights.sourceRel +
      recencyScore(a) * weights.recency +
      a.strength * weights.strength
    );
  }
  
  resolve(assertions: Assertion[]): {
    winner: Assertion;
    snapshot: Record<string, any>;
    evidence: Assertion[];
    explanation: string;
  }
}
```

---

## 4. Claims & Deduplication

### 4.1 Claim Pipeline

Claims are Assertions with deduplication support:

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Ingest  │───►│ Embed & │───►│ Cluster │───►│ Curate/ │───►│ Promote │
│ Claim   │    │Normalize│    │ Similar │    │ Merge   │    │ to Fact │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### 4.2 Claim Cluster

```typescript
interface ClaimCluster {
  id: string;
  canonicalAssertionId?: string;  // Merged winner
  memberIds: string[];            // All assertions in cluster
  centroidEmbedding: number[];    // Mean embedding
  mergePolicy: 'auto' | 'manual' | 'voting';
  state: {
    needsReview: boolean;
    similarity: number;  // Min similarity in cluster
  };
}
```

### 4.3 Deduplication Flow

1. **On new assertion:** Embed the claim text
2. **Search similar:** Find assertions with cosine similarity > threshold
3. **Cluster:** Add to existing cluster or create new one
4. **Auto-merge (optional):** If similarity > 0.95 and same source type
5. **Manual review:** Flag clusters with 0.8 < similarity < 0.95

### 4.4 Merge Strategies

| Strategy | Formula | When |
|----------|---------|------|
| **Source-Weighted** | `Σ(sourceRel × truth) / Σ(sourceRel)` | Multiple agents |
| **Consensus** | `median(truths)` if N+ sources agree | High-stakes |
| **Recency-Biased** | `0.7 × newest + 0.3 × weighted` | Time-sensitive |
| **Manual** | Human picks | Disputes |

---

## 5. NeuroSym Logic Engine

### 5.1 NeuroJSON Schema

Logic represented as computable DAG:

```typescript
interface NeuroJSON {
  version: string;
  variables: Record<string, Variable>;
  rules: Rule[];
  constraints: Constraint[];
}

interface Variable {
  type: 'bool' | 'continuous';
  prior: TruthValue;
  locked?: boolean;
}

interface Rule {
  id: string;
  type: 'IMPLICATION' | 'CONJUNCTION' | 'DISJUNCTION' | 'EQUIVALENCE';
  inputs: string[];
  output: string;
  op: 'IDENTITY' | 'AND' | 'OR' | 'NOT' | 'WEIGHTED';
  weight: TruthValue;
  learnable?: boolean;
}

interface Constraint {
  id: string;
  type: 'ATTACK' | 'SUPPORT' | 'MUTEX';
  source: string;
  target: string | string[];
  weight: TruthValue;
}
```

### 5.2 Logic Operations (Lukasiewicz T-Norms)

| Operation | Formula | Use |
|-----------|---------|-----|
| NOT | `1 - a` | Negation |
| AND | `max(0, Σa - (n-1))` | Conjunction |
| OR | `min(1, Σa)` | Disjunction |
| IMPLIES | `min(1, 1 - a + b)` | Implication |
| ATTACK | `target × (1 - attacker × weight)` | Inhibition |
| SUPPORT | `target + (1-target) × src × weight` | Reinforcement |

### 5.3 Integration with Assertions

NeuroDAG nodes are backed by Assertions:

```typescript
// A proposition becomes an Assertion
const prop = await ksg.createAssertion({
  subject: 'context:risk_model',
  predicate: 'hasProposition',
  object: 'prop:server_down',
  truth: 1.0,
  provenance: { method: 'observation' }
});

// Rules are also Assertions
const rule = await ksg.createAssertion({
  subject: 'prop:server_down',
  predicate: 'implies',
  object: 'prop:churn_risk',
  truth: 0.9,  // Rule weight
  provenance: { method: 'manual' }
});
```

---

## 6. Staged Implementation

### Stage 1: Assertion Spine (v0.2.0) 🔴 CRITICAL

**Priority: Enables everything else**

| Task | Status | Deliverable |
|------|--------|-------------|
| Assertion model | ❌ | `src/models/assertion.js` |
| Assertion CRUD | ❌ | `createAssertion`, `getAssertions`, `vote` |
| WTA Resolver | ❌ | `src/resolution/wta-resolver.js` |
| Snapshot endpoint | ❌ | `GET /api/entities/:id/snapshot` |
| Evidence endpoint | ❌ | `GET /api/entities/:id/evidence` |
| Explain endpoint | ❌ | `GET /api/entities/:id/explain` |
| createConcept → Assertions | ❌ | Expand jsonObj into assertions |
| Tests | ❌ | 20+ new tests |

**Acceptance:** Assertions can be created, queried, voted on. Snapshot derives from WTA.

### Stage 2: Procedures as DAGs (v0.2.1) 🔴 CRITICAL FOR AGENT

**Priority: Agent memory for workflows**

| Task | Status | Deliverable |
|------|--------|-------------|
| Procedure as Entity Type | ✅ | Seeded via osl-agent |
| Step as Entity Type | ✅ | Seeded |
| Step ordering via Assertions | ❌ | `next`, `order` predicates |
| Step semantics | ❌ | `does`, `usesSelector`, `expects` |
| Procedure retrieval | ❌ | `GET /api/procedures/:id` → DAG JSON |
| Procedure search | ✅ | `POST /api/procedures/search` |

**Acceptance:** Agent can store learned workflow and retrieve by semantic search.

### Stage 3: Claim Deduplication (v0.2.2) 🟡 HIGH

**Priority: Multiple sources reporting same thing**

| Task | Status | Deliverable |
|------|--------|-------------|
| ClaimCluster model | ❌ | `src/models/claim-cluster.js` |
| Duplicate detection | ❌ | On assertion create, find similar |
| Cluster CRUD | ❌ | `POST /api/clusters`, `GET /api/clusters/:id` |
| Merge endpoint | ❌ | `POST /api/claims/merge` |
| Auto-merge policy | ❌ | Configurable threshold |

**Acceptance:** Duplicate claims are detected and can be merged.

### Stage 4: WorkingMemoryGraph (v0.2.3) 🟡 HIGH

**Priority: Agent session state**

| Task | Status | Deliverable |
|------|--------|-------------|
| WorkingMemoryGraph class | ❌ | `src/memory/working-memory.js` |
| Hebbian link/access/decay | ❌ | Methods implemented |
| Export as npm class | ❌ | Usable by agents |
| Session persistence (optional) | ❌ | Save/restore |

**Acceptance:** Agents can use WMG for session-scoped activation.

### Stage 5: NeuroSym Engine (v0.3.0) 🟡 HIGH

**Priority: Logic/reasoning capability**

| Task | Status | Deliverable |
|------|--------|-------------|
| Port types.ts | ❌ | `src/neuro/types.js` |
| Port logic-core.ts | ❌ | `src/neuro/logic-core.js` |
| Port engine.ts | ❌ | `src/neuro/engine.js` |
| REST endpoint | ❌ | `POST /api/neuro/solve` |
| Integration with Assertions | ❌ | NeuroDAG nodes are Assertions |

**Acceptance:** Can define logic graph and run inference.

### Stage 6: Prototype Theory (v0.3.1) 🟢 MEDIUM

**Priority: Dynamic schemas, UI scaffolding**

| Task | Status | Deliverable |
|------|--------|-------------|
| Type.centroid | ❌ | Weighted centroid of exemplars |
| addExemplar | ❌ | Add instance to type |
| recomputeCentroid | ❌ | Update on exemplar change |
| Feature template | ❌ | Aggregate predicates from exemplars |
| recomputeTemplate | ❌ | Derive recommended predicates |

**Acceptance:** Types have computed centroids and feature templates.

### Stage 7: Arango Parity (v0.4.0) 🟢 MEDIUM

**Priority: Production persistence**

| Task | Status | Deliverable |
|------|--------|-------------|
| Assertion storage | ❌ | Arango collection |
| Cluster storage | ❌ | Arango collection |
| Snapshot AQL | ❌ | Efficient WTA query |
| Live tests | ❌ | `TEST_LIVE=true` passing |

---

## 7. API Reference

### 7.1 Existing Endpoints ✅

```
GET  /health
POST /api/prototypes
GET  /api/prototypes/:uuid
POST /api/concepts
GET  /api/concepts/:uuid
POST /api/concepts/search
POST /api/associations
POST /api/nodes
POST /api/knodes
POST /api/procedures
POST /api/procedures/search
POST /api/seed/osl-agent
POST /api/orm/register
POST /api/orm/:proto/create
GET  /api/orm/:proto/:uuid
```

### 7.2 New Endpoints (v0.2.0+) ❌

```
# Assertions
POST /api/assertions              # Create assertion
GET  /api/assertions              # Query (filter by subject/predicate/object)
POST /api/assertions/:id/vote     # Vote on assertion
GET  /api/assertions/:id/lineage  # Edit history

# Snapshot/Evidence
GET  /api/entities/:id/snapshot   # Canonical values (WTA winners)
GET  /api/entities/:id/evidence   # All competing assertions
GET  /api/entities/:id/explain    # Why value X won

# Claims/Deduplication
POST /api/claims/similar          # Find similar claims
GET  /api/clusters/:id            # Get cluster with members
POST /api/claims/merge            # Merge claims into canonical
POST /api/claims/:id/promote      # Promote to verified fact

# NeuroSym
POST /api/neuro/solve             # Run inference on logic graph
POST /api/neuro/transpile         # Convert to natural language
```

---

## 8. ORM & Client SDK

### 8.1 EntityFacade Pattern

```javascript
const bob = ksg.entity('uuid-bob');

// Write via Assertions
await bob.assert('hasAge', 40, { truth: 0.95, source: 'user' });
await bob.assert('worksAt', companyId, { strength: 0.8 });

// Read via Snapshot (derived)
const snapshot = await bob.snapshot();
console.log(snapshot.hasAge);  // 40

// Inspect Evidence
const evidence = await bob.evidence('hasAge');
// Returns: [{ value: 40, truth: 0.95, ... }, { value: 39, truth: 0.3, ... }]

// Vote
await bob.vote('hasAge', assertionId, +1);
```

### 8.2 Lazy ORM (Existing)

```javascript
const Person = await ksg.orm.registerPrototype('Person', {
  properties: {
    name: { type: 'string', required: true },
    age: { type: 'string' }
  }
});

const john = await Person.create({ name: 'John', age: '30' });
const retrieved = await Person.get(john.uuid);
const name = await retrieved._getProperty('name');
```

### 8.3 Client SDK (JavaScript)

```javascript
import { KnowShowGoClient } from 'knowshowgo-client';

const client = new KnowShowGoClient('http://localhost:3000');

// Assertions
const assertionId = await client.assert(subjectId, 'hasAge', 40, { truth: 0.9 });
await client.vote(assertionId, +1);

// Snapshot
const snapshot = await client.snapshot(entityId);

// Search
const results = await client.search('person named John', { topK: 5 });

// NeuroSym
const result = await client.solve(neuroJSON, { 'fact_a': 1.0 });
```

---

## 9. osl-agent-prototype Integration

### 9.1 Architecture

```
osl-agent-prototype (Python)
├── WorkingMemoryGraph (LOCAL - latency sensitive)
├── AsyncReplicator (LOCAL - queues writes)
├── DeterministicParser (LOCAL - rule-based NLP)
└── KnowShowGoClient → knowshowgo service (REMOTE)
    ├── Store learned procedures
    ├── Retrieve similar workflows
    ├── Assert observations
    └── Query semantic memory
```

### 9.2 What Agent Stores

```python
# Store a learned workflow
procedure_id = client.create_procedure(
    title="LinkedIn Login",
    steps=[
        {"action": "navigate", "selector": "linkedin.com"},
        {"action": "click", "selector": "#login-button"},
        {"action": "type", "selector": "#username", "value": "..."}
    ]
)

# Store an observation as Assertion
client.assert(
    subject=session_id,
    predicate="observed",
    object="login_successful",
    truth=1.0,
    provenance={"source": "agent", "method": "observation"}
)
```

### 9.3 What Agent Queries

```python
# Find similar procedure
results = client.search_procedures("log into linkedin", top_k=3)

# Get procedure DAG
procedure = client.get_procedure(procedure_id)
for step in procedure.steps:
    execute(step)

# Get entity snapshot
user_data = client.snapshot(user_entity_id)
```

### 9.4 Environment Variables

```bash
KNOWSHOWGO_URL=http://localhost:3000
USE_KNOWSHOWGO_SERVICE=true
KNOWSHOWGO_TIMEOUT=5000
```

---

## 10. Deployment & Debugging

### 10.1 Local Development

```bash
npm run dev                                    # Hot reload
docker compose -f docker-compose.dev.yml up   # Docker with hot reload
```

### 10.2 Remote Development (OCI)

```bash
cp .env.remote.example .env.remote
# Edit with your OCI VM details

./scripts/remote-dev.sh status    # Check services
./scripts/remote-dev.sh logs      # Stream logs
./scripts/remote-dev.sh deploy    # Pull & restart
./scripts/remote-dev.sh hotfix "fix"  # Commit + push + deploy
./scripts/remote-dev.sh rollback  # Rollback to previous
```

### 10.3 Debug Daemon

```bash
node scripts/debug-daemon.js --once    # Single run
node scripts/debug-daemon.js --live    # Include live tests
```

### 10.4 Test Modes

```bash
npm test                              # All tests (93)
npm test -- tests/integration/        # Integration only
TEST_LIVE=true npm test               # With ArangoDB
```

---

## 11. Repo Strategy

### 11.1 Multi-Repo (Recommended for Scale)

| Repo | Purpose |
|------|---------|
| `knowshowgo` | Core service + REST API |
| `knowshowgo-js` | Client SDK + ORM |
| `knowshowgo-curator` | Human web UI |
| `knowshowgo-seeder` | ETL + import tools |
| `neurosym-js` | Logic engine (standalone) |

### 11.2 Current Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Stable releases |
| `cursor/current-system-status-*` | Active development |
| `dev/assertions` | Assertion spine work |
| `dev/neuro` | NeuroSym integration |

---

## 12. Definition of Done

### v0.2.0 (Assertion Spine) ✅ when:
- [ ] Assertion CRUD + voting shipped
- [ ] Snapshot/evidence/explain endpoints working
- [ ] createConcept expands jsonObj into assertions
- [ ] Procedures storable/retrievable by search
- [ ] 20+ new tests passing

### v0.2.2 (Deduplication) ✅ when:
- [ ] Duplicate detection on assertion create
- [ ] Cluster CRUD endpoints
- [ ] Merge endpoint working
- [ ] Auto-merge with configurable threshold

### v0.3.0 (NeuroSym) ✅ when:
- [ ] Logic engine ported from TypeScript
- [ ] `/api/neuro/solve` endpoint
- [ ] NeuroDAG nodes backed by Assertions
- [ ] 50+ logic tests passing

### v1.0.0 (Production) ✅ when:
- [ ] Arango parity complete
- [ ] Live tests passing
- [ ] npm package published
- [ ] Deployed on OCI

---

## Non-Negotiables

1. **Assertions are truth-bearing** — Never treat jsonObj or snapshots as authoritative
2. **Resolver is reproducible** — Same inputs → same output, with explanation
3. **Provenance on everything** — Every assertion has source, method, timestamp
4. **Backward compatible** — Existing endpoints continue to work
5. **Embeddings are indexes** — Help retrieval, don't determine truth
6. **Finish the spine first** — Everything else becomes easy after Assertions + Resolver

---

*Version 4.0 | 2026-01-17*
*Unified plan: Assertions + Claims/Dedup + NeuroSym + Prototype Theory*
*Priority: osl-agent-prototype functionality first*
