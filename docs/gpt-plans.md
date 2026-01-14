# Knowshowgo Refactoring Recommendations (v0.1.1)

## Purpose
Knowshowgo is an open, community-curated semantic registry for **canonical semantic units** (UUID-anchored "tokens") that can be used to:
- Tag and subscribe to topics across the web (semantic web layer / "Wiki 2.0 for super-tags")
- Provide stable concept references for third‑party software (UUID grounding)
- Support **AI semantic memory** (entities, tasks, procedures, claims, evidence) with auditability
- Represent **fuzzy / probabilistic knowledge** and converge to a canonical symbolic snapshot via **WTA resolution**
- Represent **code as data**, logic, argumentation, and probabilistic factor graphs as first-class citizens

This document summarizes the recommended refactor that keeps the system **simple**, **first‑class**, **auditable**, and **API/ORM friendly**.

---

## Executive Summary of the Refactor
### The 4 primitives (do not exceed these in the core)
1. **Entity** (Token / Topic / Concept) — stable UUID identity anchor  
2. **Type** (Prototype) — category/schema token (also an Entity)  
3. **Predicate** — property/relation kind (also an Entity or a dedicated collection)  
4. **Assertion** — a first‑class "belief/claim" connecting subject–predicate–object with weights + provenance  

Everything else (versions, votes, evidence, embeddings, programs, procedures) attaches to **Entities** and especially **Assertions**.

### The key design shift
**Treat every property/value/relation as an Assertion** with:
- Probabilistic truth (`truth`)
- Association salience (`strength`)
- Provenance + governance (votes, revisions)
- Optional typicality and context scoring

Then expose two API views:
- **Evidence view**: all Assertions (auditable ground truth)
- **Snapshot view**: flattened canonical object computed via **WTA** over weighted Assertions

---

## Naming (cognitively aligned, engineering friendly)
Recommended code-level naming:
- `Entity` = token / topic / concept (identity anchor)
- `Type` = prototype/category (schema-as-data)
- `Predicate` = feature/relation kind (property definition)
- `Assertion` = claim/belief (the thing that gets weighted and voted)

Optional UI aliases:
- "Token" as a friendly synonym for Entity
- "Prototype" as a friendly synonym for Type

Rationale: this aligns with cognitive models (objects, categories, features, beliefs) without overloading jargon.

---

## Core Data Model (conceptual)

### Entity (Token)
Minimum stable identity + basic labels:
- `id` (UUID)
- `label`, `aliases[]`, `summary`
- `namespace`, `status`
- timestamps, createdBy
- optional `embedding`

### Predicate
A Predicate defines meaning and constraints (lightweight schema-as-data):
- `id` (UUID)
- `name`
- `valueType` (`entity_ref | string | number | boolean | date | url | json | quantity`)
- `cardinality` (optional advisory)
- optional: `allowedTargetTypes[]` (advisory)

### Assertion (the universal first-class "property instance")
An Assertion connects:
- `subject` (Entity)
- `predicate` (Predicate)
- `object` (Entity or ValueEntity)

And carries fuzzy + governance metadata:
- `truth` ∈ [0,1] — probability the claim is correct (evidence / inference / curator)
- `strength` ∈ [0,1] — salience / retrieval weight (usefulness, association strength)
- `voteScore` (or up/down + Wilson score)
- `sourceRel` ∈ [0,1] — provenance reliability
- `recency` (computed) or timestamps
- `provenance` (source URL, user/system/model run, dataset, quote)
- `revisionId` / `prevAssertionId` (optional)
- `status` (`proposed|accepted|rejected|deprecated`)

**Rule:** provenance/versioning belongs to the **Assertion**, not the Entity.  
Entities are stable anchors; Assertions are evolving beliefs.

---

## Versioning + Governance (KISS)
- Changes are proposed as new Assertions or new Revisions that materialize new Assertions.
- Votes apply to the change (Revision) or directly to Assertions.
- "Accepted" is determined by simple policy: threshold score or curator override.

**Important:** avoid storing the same fact twice (no "truth JSON" + graph truth).  
Flattened JSON is a **derived snapshot**, never the primary truth.

---

## WTA Canonicalization (fuzzy → symbolic)
### Goal
Convert multiple competing Assertions into a single canonical "symbolic object" snapshot.

### Scoring
For a given `(subject, predicate)` gather candidate Assertions and score:

```
Score(a) = α·truth + β·normVote + γ·sourceRel + δ·recency + ε·strength
```

Recommended default coefficients:
- α=0.45 (truth dominates)
- β=0.20 (community preference)
- γ=0.15 (source reliability)
- δ=0.10 (recency bias)
- ε=0.10 (salience)

### Winner-Take-All
- Winner = argmax Score(a)
- Return winner + top-k alternatives + explanation trace

### ResolutionPolicy (first-class)
Store resolution weights as an Entity of Type `ResolutionPolicy` so behavior is reproducible:
- weights for truth/vote/sourceRel/recency/strength
- recency half-life
- thresholds (minTruth, tie handling)

---

## Flattened Snapshot vs Evidence View
### Evidence view (auditable)
Returns *all* Assertions with metadata. Used for:
- neurosymbolic verification
- provenance audits
- disagreement/controversy visualization

### Snapshot view (developer-friendly)
Returns a flattened JSON object with WTA winners per predicate:
- simple ORM access
- stable shape for LLM grounding
- still includes evidence pointers (assertionId, truth, sources)

---

## API Layout (updated model)

### Entities
- `POST /entities` — create entity (token)
- `GET /entities/{id}` — raw entity metadata
- `GET /entities/search?q=...` — label/alias search (+ optional vector match)

### Assertions
- `POST /assertions` — create assertions (supports literals; server normalizes into ValueEntities)
- `GET /assertions?subject=...&predicate=...` — list competing claims
- `POST /assertions/{id}/vote` — vote up/down
- `POST /assertions/{id}/revise` — propose revision (or use separate revisions API)

### Typing & Templates (schema-as-data)
- `POST /types` — create Type (Entity with Type semantics)
- `POST /predicates` — create Predicate
- `GET /types/{id}/template` — recommended predicates + UI hints (advisory)

### Canonicalization
- `GET /entities/{id}/snapshot` — flattened object via default policy
- `GET /entities/{id}/snapshot?policy={policyId}` — use policy
- `GET /entities/{id}/explain?predicate=...` — winner + alternatives + scoring breakdown

### Optional: Programs / Probabilistic Inference
- `POST /programs` — create NeuroProgram (raw JSON payload)
- `POST /programs/{id}/compile` — compile into variables/factors as Entities + Assertions
- `POST /programs/{id}/infer` — run inference using evidence; write back posterior truth

---

## ORM Pattern (JS/TS) — simple and ergonomic
### The KISS client facade
- `entity(id).snapshot()` → flattened view
- `entity(id).evidence()` → assertions
- `entity(id).assert(predicate, value, meta)` → creates assertions

Example usage:
```ts
const bob = await ksg.entity("ent:bob").snapshot();
bob.get("hasAge").number;         // 40
bob.get("worksFor").ref;          // ent:org123
bob.get("hasAge").evidence;       // assertionId, truth, sources
```

### Typed facades (optional, without enforcing rigid schemas)
Generate TypeScript interfaces from Type templates for DX:
```ts
interface Person { hasAge?: Quantity; email?: string; worksFor?: EntityRef; }
const bob = await ksg.entity<Person>("ent:bob").snapshot();
```

**Note:** Do not rely on runtime JS prototype inheritance for correctness.  
Instead, **Types provide templates**, and snapshots are computed via WTA.

---

## "Code as Data" + Logic + Argumentation + Factor Graphs (first-class)
These are supported by defining additional Types (still Entities) and using Assertions.

### Code as Data
Types: `CodeArtifact`, `Function`, `Rule`, `Procedure`, `Step`, `Commandlet`  
Predicates: `language`, `sourceText`, `imports`, `calls`, `dependsOn`, `hasStep`, `usesCommandlet`, `params`

### Logic / FOL representation
Represent atomic facts as Assertions.
Optionally represent formulas as expression trees:
Types: `Formula`, `Variable`, `Quantifier`  
Predicates: `hasAtom`, `operator`, `children`, `quantifier`, `scope`

### Argumentation / Claims / Evidence
Types: `Claim`, `Evidence`, `Argument`  
Predicates: `asserts`, `supportedBy`, `premise`, `conclusion`, `attacks`, `supports`

### Probabilistic Factor Graphs ("NeuroJSON" as program)
Types: `NeuroProgram`, `RandomVariable`, `Factor`, `Observation`, `InferenceRun`  
Predicates: `hasVariable`, `hasFactor`, `inputs`, `output`, `logicOp`, `weight`, `observes`, `observedValue`, `producedBy`

**Integration rule:** inference updates `truth` on Assertions; WTA produces canonical symbolic snapshots.

---

## Practical MVP Guidance (avoid scope creep)
Implement in this order:
1. Entities + Predicates + Assertions (with truth/strength/provenance)
2. Snapshot WTA resolver + explain endpoint
3. Type templates (recommended predicates)
4. Revisions/voting
5. Procedures (agent memory) as Entities + Assertions
6. NeuroProgram module (optional) to compute `truth` via factor graphs

---

## Non-negotiables (keeps the system sane)
- **Do not store facts twice** (graph truth is authoritative; JSON snapshots are derived/cached)
- **Assertions are the truth-bearing units** (weights, provenance, votes live here)
- **Policies are first-class** (resolution must be reproducible and explainable)
- **Keep the core primitives small** (Entity/Type/Predicate/Assertion)
