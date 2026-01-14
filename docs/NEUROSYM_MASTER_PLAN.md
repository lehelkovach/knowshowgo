# NeuroSym: Fuzzy Logic as DAG Data Structures

**Relevance to KnowShowGo:** Encoding propositions, fuzzy truth values, and argumentation (attack/support) as graph data.

---

## 1. Core Concept

Treat **Code as Data** in the knowledge graph:

* **Nodes** = Variables (propositions with truth values)
* **Edges** = Functions (logical relationships: implies, attacks)
* **Inference** = Forward propagation through the DAG

This enables representing probabilistic/fuzzy knowledge that can be reasoned over.

---

## 2. The NeuroDAG Schema

This JSON structure represents fuzzy logic as graph data. Maps directly to KnowShowGo Entities and Assertions.

```json
{
  "nodes": [
    {
      "id": "fact:server_down",
      "type": "DIGITAL",
      "state": { 
        "truth": 1.0,
        "prior": 0.5,
        "is_locked": true
      }
    },
    {
      "id": "risk:churn",
      "type": "FUZZY",
      "state": { "truth": 0.5, "prior": 0.2 }
    }
  ],

  "edges": [
    {
      "source": "fact:server_down",
      "target": "risk:churn",
      "type": "IMPLICATION",
      "weight": 0.9
    },
    {
      "source": "fact:has_backup",
      "target": "risk:churn",
      "type": "ATTACK",
      "weight": 1.0
    }
  ]
}
```

---

## 3. Schema Field Reference

### Node Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `type` | `DIGITAL` \| `FUZZY` | DIGITAL snaps to 0/1, FUZZY is continuous |
| `state.truth` | float [0,1] | Current computed/observed value |
| `state.prior` | float [0,1] | Default belief before evidence |
| `state.is_locked` | boolean | If true, value is immutable evidence |

### Edge Fields

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Source node ID |
| `target` | string | Target node ID |
| `type` | `IMPLICATION` \| `ATTACK` | Support vs inhibit relationship |
| `weight` | float [0,1] | Confidence/strength of connection |

---

## 4. Mapping to KnowShowGo Primitives

| NeuroDAG | KnowShowGo | Notes |
|----------|------------|-------|
| Node | Entity | Add `neuro.mode`, `neuro.truth`, `neuro.prior` |
| Node.type | Entity metadata | `DIGITAL` or `FUZZY` |
| Node.state.truth | Assertion.truth | Current belief value |
| Edge (IMPLICATION) | Assertion | Positive `strength` |
| Edge (ATTACK) | Assertion | Negative relationship (inhibitor) |
| Edge.weight | Assertion.strength | Connection confidence |

### Entity Extension

```javascript
// KnowShowGo Entity with neuro metadata
{
  uuid: "risk:churn",
  props: {
    label: "Churn Risk",
    neuro: {
      mode: "FUZZY",      // or "DIGITAL"
      prior: 0.2          // default belief
    }
  }
}
```

### Assertion Extension

```javascript
// KnowShowGo Assertion with neuro metadata
{
  subject: "fact:server_down",
  predicate: "implies",
  object: "risk:churn",
  truth: 0.9,              // existing field
  strength: 0.9,           // existing field
  neuro: {
    type: "IMPLICATION",   // or "ATTACK"
    op: "IDENTITY"         // logic gate type
  }
}
```

---

## 5. Fuzzy Logic Operations

### Supported Logic Gates

| Operation | Formula | Use Case |
|-----------|---------|----------|
| **Implication** | `target = source × weight` | Weighted inference |
| **Fuzzy OR** | `max(v1, v2, ...)` | Multiple support paths |
| **Fuzzy AND** | `max(0, Σv - (n-1))` | All conditions required (Łukasiewicz) |
| **Attack/Inhibit** | `val × (1 - attacker × weight)` | Defeasible reasoning |
| **Digital Snap** | `v > 0.5 ? 1.0 : 0.0` | Boolean collapse |

### Propagation Example

```
Given:
  server_down.truth = 1.0
  has_backup.truth = 0.0
  
  server_down --[IMPLICATION, w=0.9]--> churn_risk
  has_backup  --[ATTACK, w=1.0]------> churn_risk

Calculation:
  support = 1.0 × 0.9 = 0.9
  attack  = 0.0 × 1.0 = 0.0
  churn_risk.truth = 0.9 × (1.0 - 0.0) = 0.9
```

---

## 6. Integration with WTA Resolution

NeuroSym inference can run **before** WTA canonicalization:

1. **Collect assertions** for an entity
2. **Run fuzzy propagation** to compute derived truth values
3. **Apply WTA** to select canonical snapshot

```javascript
// In WTA resolution, consider neuro-computed truth
async getSnapshot(entityUuid, policyId) {
  const assertions = await this.getEvidence(entityUuid);
  
  // Optional: Run neuro inference to update truth values
  if (this.neuroEnabled) {
    assertions = await this.neuroPropagate(assertions);
  }
  
  return this.resolveWTA(assertions, policy);
}
```

---

## 7. Use Cases for KnowShowGo

### Probabilistic Claims
```javascript
// "Server downtime implies 90% churn risk"
await ksg.createAssertion({
  subject: "fact:server_down",
  predicate: "implies",
  object: "risk:churn",
  truth: 0.9,
  neuro: { type: "IMPLICATION" }
});
```

### Defeaters (Attack Edges)
```javascript
// "Having backup negates churn risk"
await ksg.createAssertion({
  subject: "fact:has_backup",
  predicate: "defeats",
  object: "risk:churn",
  truth: 1.0,
  neuro: { type: "ATTACK" }
});
```

### Evidence Injection
```javascript
// Lock observed facts as immutable evidence
await ksg.createAssertion({
  subject: "observation:2026-01-14",
  predicate: "observes",
  object: "fact:server_down",
  truth: 1.0,
  neuro: { is_locked: true }
});
```

---

## 8. Summary

**Key additions to KnowShowGo for fuzzy logic support:**

1. Add `neuro.mode` to Entities (`DIGITAL` | `FUZZY`)
2. Add `neuro.prior` to Entities (default belief)
3. Add `neuro.type` to Assertions (`IMPLICATION` | `ATTACK`)
4. Add `neuro.is_locked` to mark immutable evidence
5. Propagation logic uses existing `truth` and `strength` fields

This keeps the core 4-primitive model (Entity/Type/Predicate/Assertion) while enabling probabilistic reasoning.

---

*Extracted from NeuroSym.js Master Plan v2.0*
*Relevant sections for KnowShowGo fuzzy logic representation*
