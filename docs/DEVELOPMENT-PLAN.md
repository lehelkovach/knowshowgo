# KnowShowGo Development Plan

**Version:** 4.1  
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
7. **Start simple, add complexity later** — Simple resolver first, weighted WTA later

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
│  │ Assertions  │          │  Resolver   │          │  Claim      │         │
│  │ (Truth)     │◄────────►│  (Simple→   │◄────────►│  Clusters   │         │
│  │             │          │   WTA)      │          │             │         │
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

### 3.4 Resolver (Staged Complexity)

**v0.2.0: Simple Resolver**
```typescript
class SimpleResolver {
  resolve(assertions: Assertion[]): Assertion {
    // Highest truth wins, tiebreak by most recent
    return assertions
      .sort((a, b) => {
        if (b.truth !== a.truth) return b.truth - a.truth;
        return new Date(b.provenance.ts) - new Date(a.provenance.ts);
      })[0];
  }
}
```

**v0.2.1+: Full WTA Resolver**
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
  scoreAssertion(a: Assertion, policy = DEFAULT_POLICY): number {
    const { weights } = policy;
    return (
      a.truth * weights.truth +
      normalize(a.voteScore) * weights.voteScore +
      a.sourceRel * weights.sourceRel +
      recencyScore(a) * weights.recency +
      a.strength * weights.strength
    );
  }
  
  resolve(assertions: Assertion[], policy?): {
    winner: Assertion;
    snapshot: Record<string, any>;
    evidence: Assertion[];
    explanation: string;
  }
}
```

### 3.5 Hybrid Property Mode

**Not everything needs to be an assertion.** Use this heuristic:

| Property Type | Storage | When |
|---------------|---------|------|
| **Simple/Internal** | `jsonObj` (fast path) | IDs, timestamps, system fields |
| **Contested/Auditable** | Assertion | User-facing, may have conflicts |
| **Derived** | Snapshot cache | Computed from assertions |

```javascript
// Simple property (no assertion needed)
await entity.setProperty('internalId', '12345');  // → jsonObj only

// Auditable property (assertion)
await entity.assert('hasAge', 40, { truth: 0.9 }); // → creates assertion

// Reading always checks snapshot first
const snapshot = await entity.snapshot();
```

### 3.6 jsonObj Transition Path

**Backward compatibility preserved:**

| Version | Write Behavior | Read Behavior |
|---------|----------------|---------------|
| v0.1.x (current) | jsonObj stored directly | jsonObj returned |
| v0.2.0 | jsonObj + assertions created | jsonObj returned (compat) |
| v0.3.0 | jsonObj + assertions | Snapshot derived from assertions |
| v1.0.0 | jsonObj is write-only convenience | Snapshot always |

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
  centroidEmbedding: number[];    // Mean embedding (incremental)
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

### 5.1 Loose Coupling Design

NeuroSym is a **standalone engine** that CAN integrate with assertions but doesn't require it:

```javascript
// Mode A: Ephemeral (no persistence)
import { NeuroEngine } from 'neurosym';
const result = engine.run(schema, evidence);  // Pure computation

// Mode B: Persistent (backed by KSG assertions)
const result = await ksg.neuro.solveAndPersist(contextId, evidence);
// Reads/writes assertions for propositions and rules
```

### 5.2 NeuroJSON Schema

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
  assertionId?: string;  // Optional: link to KSG assertion
}

interface Rule {
  id: string;
  type: 'IMPLICATION' | 'CONJUNCTION' | 'DISJUNCTION' | 'EQUIVALENCE';
  inputs: string[];
  output: string;
  op: 'IDENTITY' | 'AND' | 'OR' | 'NOT' | 'WEIGHTED';
  weight: TruthValue;
  learnable?: boolean;
  assertionId?: string;  // Optional: link to KSG assertion
}

interface Constraint {
  id: string;
  type: 'ATTACK' | 'SUPPORT' | 'MUTEX';
  source: string;
  target: string | string[];
  weight: TruthValue;
}
```

### 5.3 Logic Operations (Lukasiewicz T-Norms)

| Operation | Formula | Use |
|-----------|---------|-----|
| NOT | `1 - a` | Negation |
| AND | `max(0, Σa - (n-1))` | Conjunction |
| OR | `min(1, Σa)` | Disjunction |
| IMPLIES | `min(1, 1 - a + b)` | Implication |
| ATTACK | `target × (1 - attacker × weight)` | Inhibition |
| SUPPORT | `target + (1-target) × src × weight` | Reinforcement |

### 5.4 Optional Integration with Assertions

```typescript
// Only when persistence is needed
const prop = await ksg.createAssertion({
  subject: 'context:risk_model',
  predicate: 'hasProposition',
  object: 'prop:server_down',
  truth: 1.0,
  provenance: { method: 'observation' }
});

// NeuroJSON can reference it
const schema = {
  variables: {
    'server_down': { 
      type: 'bool', 
      prior: 1.0,
      assertionId: prop.uuid  // Optional link
    }
  }
};
```

---

## 6. Staged Implementation

### Stage 1: Assertion Spine (v0.2.0) 🔴 CRITICAL

**Priority: Enables everything else. Start SIMPLE.**

| Task | Status | Deliverable |
|------|--------|-------------|
| Assertion model | ❌ | `src/models/assertion.js` |
| Assertion CRUD | ❌ | `createAssertion`, `getAssertions`, `vote` |
| **Simple Resolver** | ❌ | Highest truth wins, recency tiebreak |
| Snapshot endpoint | ❌ | `GET /api/entities/:id/snapshot` |
| Evidence endpoint | ❌ | `GET /api/entities/:id/evidence` |
| createConcept → dual write | ❌ | jsonObj + assertions (compat) |
| Tests | ❌ | 15+ new tests |

**Acceptance:** Assertions work. Snapshot returns winner. Existing API unchanged.

### Stage 2: Procedures + Full WTA (v0.2.1) 🔴 CRITICAL FOR AGENT

**Priority: Agent memory for workflows + configurable resolution**

| Task | Status | Deliverable |
|------|--------|-------------|
| Full WTA Resolver | ❌ | Configurable weights |
| Explain endpoint | ❌ | `GET /api/entities/:id/explain` |
| Step ordering via Assertions | ❌ | `next`, `order` predicates |
| Step semantics | ❌ | `does`, `usesSelector`, `expects` |
| Procedure retrieval | ❌ | `GET /api/procedures/:id` → DAG JSON |

**Acceptance:** Agent can store/retrieve workflows. WTA explains decisions.

### Stage 3: WorkingMemoryGraph (v0.2.2) 🟡 HIGH

**Priority: Agent session state (swapped with dedup - agent needs this first)**

| Task | Status | Deliverable |
|------|--------|-------------|
| WorkingMemoryGraph class | ❌ | `src/memory/working-memory.js` |
| Hebbian link/access/decay | ❌ | Methods implemented |
| Export as npm class | ❌ | Usable by agents |
| Session persistence (optional) | ❌ | Save/restore |

**Acceptance:** Agents can use WMG for session-scoped activation.

### Stage 4: Claim Deduplication (v0.2.3) 🟡 HIGH

**Priority: Multiple sources reporting same thing**

| Task | Status | Deliverable |
|------|--------|-------------|
| ClaimCluster model | ❌ | `src/models/claim-cluster.js` |
| Duplicate detection | ❌ | On assertion create, find similar |
| Incremental centroid | ❌ | `(old * n + new) / (n + 1)` |
| Cluster CRUD | ❌ | `POST /api/clusters`, `GET /api/clusters/:id` |
| Merge endpoint | ❌ | `POST /api/claims/merge` |

**Acceptance:** Duplicate claims detected and can be merged.

### Stage 5: NeuroSym Engine (v0.3.0) 🟡 HIGH

**Priority: Logic/reasoning capability (loosely coupled)**

| Task | Status | Deliverable |
|------|--------|-------------|
| Port types.ts | ❌ | `src/neuro/types.js` |
| Port logic-core.ts | ❌ | `src/neuro/logic-core.js` |
| Port engine.ts | ❌ | `src/neuro/engine.js` |
| Standalone mode | ❌ | Works without KSG |
| REST endpoint | ❌ | `POST /api/neuro/solve` |
| Optional assertion backing | ❌ | `solveAndPersist` |

**Acceptance:** Can run inference standalone or with KSG persistence.

### Stage 6: Centroid Embeddings (v0.3.1) 🟢 MEDIUM

**Priority: Prototype theory - centroids only first**

| Task | Status | Deliverable |
|------|--------|-------------|
| Type.centroid field | ❌ | Stored on type entity |
| addExemplar | ❌ | Incremental centroid update |
| Incremental formula | ❌ | `newCentroid = (old * n + new) / (n + 1)` |
| getCentroid | ❌ | Returns current centroid |

**Acceptance:** Types have computed centroids via incremental updates.

### Stage 7: Feature Templates + Arango (v0.4.0) 🟢 MEDIUM

**Priority: Production persistence + dynamic schemas**

| Task | Status | Deliverable |
|------|--------|-------------|
| Feature template aggregation | ❌ | Derive predicates from exemplars |
| recomputeTemplate | ❌ | Aggregate on demand |
| Assertion storage (Arango) | ❌ | Collection + indexes |
| Cluster storage (Arango) | ❌ | Collection |
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
# Assertions (v0.2.0)
POST /api/assertions              # Create assertion
GET  /api/assertions              # Query (filter by subject/predicate/object)
POST /api/assertions/:id/vote     # Vote on assertion
GET  /api/assertions/:id/lineage  # Edit history

# Snapshot/Evidence (v0.2.0)
GET  /api/entities/:id/snapshot   # Canonical values (resolver winners)
GET  /api/entities/:id/evidence   # All competing assertions

# Explain (v0.2.1)
GET  /api/entities/:id/explain    # Why value X won

# Claims/Deduplication (v0.2.3)
POST /api/claims/similar          # Find similar claims
GET  /api/clusters/:id            # Get cluster with members
POST /api/claims/merge            # Merge claims into canonical
POST /api/claims/:id/promote      # Promote to verified fact

# NeuroSym (v0.3.0)
POST /api/neuro/solve             # Run inference (standalone)
POST /api/neuro/solve-persist     # Run + write assertions
POST /api/neuro/transpile         # Convert to natural language
```

---

## 8. ORM & Client SDK

### 8.1 EntityFacade Pattern

```javascript
const bob = ksg.entity('uuid-bob');

// Write via Assertions (auditable)
await bob.assert('hasAge', 40, { truth: 0.95, source: 'user' });

// Write simple property (fast path, not auditable)
await bob.setProperty('lastSeen', new Date().toISOString());

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

// NeuroSym (standalone)
const result = await client.neuroSolve(schema, evidence);

// NeuroSym (persistent)
const result = await client.neuroSolvePersist(contextId, evidence);
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
- [ ] Simple resolver (highest truth wins)
- [ ] Snapshot/evidence endpoints working
- [ ] createConcept dual-writes (jsonObj + assertions)
- [ ] Existing API unchanged (backward compat)
- [ ] 15+ new tests passing

### v0.2.1 (Procedures + WTA) ✅ when:
- [ ] Full WTA with configurable weights
- [ ] Explain endpoint shows score breakdown
- [ ] Procedures storable/retrievable by search
- [ ] 10+ new tests passing

### v0.2.2 (WorkingMemoryGraph) ✅ when:
- [ ] WMG class exported and usable by agents
- [ ] Hebbian link/access/decay working
- [ ] Session save/restore optional
- [ ] 5+ tests passing

### v0.2.3 (Deduplication) ✅ when:
- [ ] Duplicate detection on assertion create
- [ ] Incremental centroid updates
- [ ] Cluster CRUD + merge endpoints
- [ ] 10+ tests passing

### v0.3.0 (NeuroSym) ✅ when:
- [ ] Engine works standalone (no KSG required)
- [ ] `/api/neuro/solve` endpoint
- [ ] Optional assertion backing via `solve-persist`
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
6. **Start simple** — Simple resolver first, weighted WTA in v0.2.1
7. **Loose coupling** — NeuroSym works standalone, KSG integration optional
8. **Finish the spine first** — Everything else becomes easy after Assertions + Resolver

---

## Summary of v4.1 Refinements

1. **Simplified v0.2.0 WTA** → Simple resolver (highest truth wins), full WTA in v0.2.1
2. **Swapped v0.2.2 and v0.2.3** → WorkingMemoryGraph before Deduplication (agent needs it first)
3. **NeuroSym loose coupling** → Works standalone, KSG integration optional
4. **Hybrid property mode** → Not everything needs to be an assertion
5. **Incremental centroids** → `(old * n + new) / (n + 1)` to avoid O(n) recomputation
6. **jsonObj transition path** → Backward compat: dual-write now, snapshot-only later

---

*Version 4.1 | 2026-01-17*
*Refined: Simpler start, agent-first priorities, loose coupling*
