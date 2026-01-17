# KnowShowGo Development Plan

**Version:** 4.2 (KISS)  
**Date:** 2026-01-17  
**North Star:** Assertions hold truth. Snapshots are derived. Keep it simple.

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

### 🎯 #1: KISS (Keep It Simple Stupid)

**This is the top priority. Every decision must pass this test:**
- Can we ship without this feature? → Ship without it
- Can we simplify this? → Simplify it
- Is this the minimum viable version? → If not, cut scope

### Core Principles

1. **KISS** — Simplest solution that works. Add complexity only when proven necessary.
2. **Assertions are truth-bearing** — truth + provenance live on Assertions
3. **Backward compatible** — Existing endpoints continue to work
4. **Ship incrementally** — Working code beats perfect plans

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

### 3.2 Assertion Model (v0.2.0 Minimum)

```javascript
// Start with just this. Add fields only when needed.
{
  uuid: 'uuid',
  subject: 'entity-uuid',      // WHO
  predicate: 'name',           // WHAT (string, not UUID - simpler)
  object: 'John',              // VALUE
  truth: 0.9,                  // HOW TRUE [0,1]
  source: 'user',              // WHERE FROM
  createdAt: '2026-01-17'
}
```

**Add later (only when needed):**
- `strength`, `voteScore`, `sourceRel` → v0.2.1 for weighted WTA
- Full `provenance` envelope → when audit trail matters
- `status`, `prevAssertionId` → when lineage matters
- `clusterId` → v0.2.3 for deduplication

### 3.3 Resolver (KISS)

**v0.2.0: Simple Resolver (THIS IS ALL WE BUILD FIRST)**
```javascript
function resolve(assertions) {
  // Highest truth wins. Ties: most recent.
  return assertions.sort((a, b) => 
    b.truth - a.truth || new Date(b.createdAt) - new Date(a.createdAt)
  )[0];
}
```

**v0.2.1+: Weighted resolver (LATER, only if needed)**

### 3.4 Backward Compatibility

**Existing APIs keep working.** Assertions are additive:

| Version | What Changes |
|---------|--------------|
| v0.1.x | `jsonObj` stored, `jsonObj` returned |
| v0.2.0 | `jsonObj` + assertions, `jsonObj` still returned |
| v0.3.0+ | Assertions primary, snapshot derived |

---

## 4. Claims & Deduplication (v0.2.3 - LATER)

**KISS: Defer until v0.2.3.** For now, assertions can duplicate.

When we build it:
1. On create, return `similarClaims[]` if embedding match > 0.9
2. Let user/agent decide whether to merge
3. No auto-merge in v1

---

## 5. NeuroSym Logic Engine (v0.3.0 - LATER)

**KISS: Defer until v0.3.0.** Focus on Assertions first.

When we build it:
1. Port from `neurosym-js` repo
2. Works standalone (no KSG required)
3. Optional KSG integration via `/api/neuro/solve-persist`

---

## 6. Staged Implementation (KISS)

### The Rule: Ship the Minimum

Each stage ships the **smallest useful increment**. Cut anything that isn't essential.

---

### v0.2.0: Assertions (THE SPINE) 🔴

**One job:** Make assertions work.

```javascript
// This is all we need
await ksg.createAssertion({ subject, predicate, object, truth });
await ksg.getAssertions({ subject });
await ksg.snapshot(entityId);  // Returns highest-truth values
```

| Do | Don't |
|----|-------|
| ✅ Assertion CRUD | ❌ Weighted WTA (later) |
| ✅ Simple resolver (highest truth wins) | ❌ Explain endpoint (later) |
| ✅ Snapshot endpoint | ❌ Voting (later) |
| ✅ Evidence endpoint | ❌ Lineage tracking (later) |

**Done when:** Can create assertions, get snapshot. 10 tests.

---

### v0.2.1: Agent Memory 🔴

**One job:** Agent can store and retrieve workflows.

| Do | Don't |
|----|-------|
| ✅ Procedure retrieval as DAG | ❌ Full WTA weights |
| ✅ Step semantics (`does`, `expects`) | ❌ Complex ordering |

**Done when:** Agent stores procedure, retrieves by search. 5 tests.

---

### v0.2.2: WorkingMemory 🟡

**One job:** Session-scoped activation for agents.

```javascript
const wm = new WorkingMemoryGraph();
wm.link(a, b);      // Strengthen
wm.access(a, b);    // Reinforce on use
wm.decayAll();      // Periodic decay
```

**Done when:** WMG class works. 5 tests.

---

### v0.2.3: Deduplication 🟡

**One job:** Detect duplicate claims.

| Do | Don't |
|----|-------|
| ✅ Find similar on create | ❌ Auto-merge (manual first) |
| ✅ Return `similarClaims[]` | ❌ Complex merge strategies |

**Done when:** Creating claim returns similar ones. 5 tests.

---

### v0.3.0: NeuroSym 🟢

**One job:** Run logic inference.

```javascript
const result = engine.run(schema, evidence);
```

| Do | Don't |
|----|-------|
| ✅ Standalone engine | ❌ KSG integration (optional) |
| ✅ `/api/neuro/solve` | ❌ Transpiler (later) |

**Done when:** Can solve a logic graph. Port existing tests.

---

### v0.4.0: Production 🟢

**One job:** Arango persistence.

| Do | Don't |
|----|-------|
| ✅ Store assertions in Arango | ❌ Feature templates |
| ✅ Live tests pass | ❌ Centroid aggregation |

**Done when:** `TEST_LIVE=true npm test` passes.

---

## 7. API Reference

### Existing ✅
`GET /health`, `POST /api/prototypes`, `POST /api/concepts`, `POST /api/concepts/search`, `POST /api/associations`, `POST /api/procedures`, `POST /api/orm/*`

### v0.2.0 (Building Now)
```
POST /api/assertions           # Create assertion
GET  /api/assertions           # Query by subject/predicate
GET  /api/entities/:id/snapshot  # Resolved values
GET  /api/entities/:id/evidence  # All competing assertions
```

---

## 8. ORM & Client

### Existing ORM ✅
```javascript
const Person = await ksg.orm.registerPrototype('Person', {...});
const john = await Person.create({ name: 'John' });
```

### v0.2.0: Add Assertions
```javascript
await ksg.createAssertion({ subject: john.uuid, predicate: 'age', object: 30, truth: 0.9 });
const snapshot = await ksg.snapshot(john.uuid);  // { age: 30, ... }
```

---

## 9. osl-agent-prototype Integration

**Agent consumes KSG as a service:**

```python
# Store procedure
client.create_procedure(title="Login", steps=[...])

# Search  
results = client.search_procedures("login")

# Assert observation
client.assert(subject_id, "observed", "success", truth=1.0)
```

**Env vars:** `KNOWSHOWGO_URL=http://localhost:3000`

---

## 10. Development

```bash
npm run dev                 # Local hot reload
npm test                    # Run tests (93 passing)
TEST_LIVE=true npm test     # With ArangoDB
./scripts/remote-dev.sh     # OCI helpers
```

---

## 11. Repo

- `main` — stable
- `cursor/current-system-status-*` — dev branch
- Ship to `main` when tests pass

---

## 12. Definition of Done (KISS)

| Version | Done When |
|---------|-----------|
| **v0.2.0** | Assertions CRUD + snapshot works. 10 tests. |
| **v0.2.1** | Agent stores/retrieves procedures. 5 tests. |
| **v0.2.2** | WorkingMemoryGraph class works. 5 tests. |
| **v0.2.3** | Duplicate detection returns similar claims. 5 tests. |
| **v0.3.0** | NeuroSym solves logic graphs. Port tests. |
| **v0.4.0** | `TEST_LIVE=true npm test` passes. |

---

## Non-Negotiables

1. **KISS** — Simplest solution that works
2. **Ship incrementally** — Working code beats perfect plans
3. **Backward compatible** — Existing endpoints continue to work
4. **Assertions are truth** — Not jsonObj, not snapshots

---

*Version 4.2 | 2026-01-17*
*KISS: Keep It Simple Stupid*
