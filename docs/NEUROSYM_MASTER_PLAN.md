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

## 2. First-Class NeuroDAG Nodes

**Key Principle:** Every step in a DAG logic representation is itself a first-class Node in KnowShowGo.

A NeuroDAG is not a separate data structure — it IS KnowShowGo nodes and associations, recursively.

```
┌─────────────────────────────────────────────────────────────────┐
│                    NeuroDAG Node (Proposition)                   │
│                                                                  │
│  uuid: "prop:server_causes_churn"                               │
│                                                                  │
│  props: {                                                        │
│    label: "Server downtime implies churn risk",                 │
│    isNeuroDAG: true,                                            │
│    neurodag: {                                                  │
│      type: "IMPLICATION",                                       │
│      source: "prop:server_down",                                │
│      target: "prop:churn_risk",                                 │
│      weight: 0.9,                                               │
│      op: "IDENTITY"                                             │
│    }                                                            │
│  }                                                              │
│                                                                  │
│  llmEmbedding: [0.2, 0.4, ...]  // Vector of the DAG object    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
        │                                    │
        │ [dag_source]                       │ [dag_target]
        ▼                                    ▼
┌─────────────────────┐            ┌─────────────────────┐
│  prop:server_down   │            │  prop:churn_risk    │
│  (also a Node)      │            │  (also a Node)      │
└─────────────────────┘            └─────────────────────┘
```

### Why First-Class?

1. **Queryable**: Find all implications, all attacks, all propositions
2. **Embeddable**: Vector search over logical structures
3. **Versionable**: Track changes to reasoning chains
4. **Composable**: DAGs can reference other DAGs recursively
5. **Auditable**: Every logical step has provenance

---

## 3. Recursive Node Population

Every NeuroDAG element becomes a Node, and associations spell out the DAG structure:

### Proposition Node (Atomic Fact)
```javascript
// A simple proposition is a Node
{
  uuid: "prop:server_down",
  props: {
    label: "Server is offline",
    isProposition: true,
    neuro: {
      type: "DIGITAL",      // or "FUZZY"
      truth: 1.0,
      prior: 0.5,
      is_locked: true       // observed evidence
    }
  },
  llmEmbedding: [...]       // Vector of "Server is offline"
}
```

### Implication Node (Rule)
```javascript
// An implication is ALSO a Node that references other Nodes
{
  uuid: "rule:server_implies_churn",
  props: {
    label: "Server downtime implies churn risk",
    isRule: true,
    isNeuroDAG: true,
    neurodag: {
      type: "IMPLICATION",
      weight: 0.9,
      op: "IDENTITY"
    }
  },
  llmEmbedding: [...]       // Vector of the rule as text
}

// The rule's structure is spelled out via Associations:
// rule:server_implies_churn --[dag_source]--> prop:server_down
// rule:server_implies_churn --[dag_target]--> prop:churn_risk
```

### Attack Node (Defeater)
```javascript
// An attack is a Node that defeats another claim
{
  uuid: "attack:backup_defeats_churn",
  props: {
    label: "Having backup negates churn risk",
    isAttack: true,
    isNeuroDAG: true,
    neurodag: {
      type: "ATTACK",
      weight: 1.0
    }
  },
  llmEmbedding: [...]
}

// Associations:
// attack:backup_defeats_churn --[dag_source]--> prop:has_backup
// attack:backup_defeats_churn --[dag_target]--> prop:churn_risk
```

### Compound DAG Node (Nested Logic)
```javascript
// A compound DAG references other DAGs
{
  uuid: "dag:risk_model",
  props: {
    label: "Server Risk Assessment Model",
    isNeuroDAG: true,
    neurodag: {
      type: "COMPOUND",
      mode: "hybrid"
    }
  },
  llmEmbedding: [...]
}

// Associations spell out the full DAG:
// dag:risk_model --[contains_rule]--> rule:server_implies_churn
// dag:risk_model --[contains_attack]--> attack:backup_defeats_churn
// dag:risk_model --[contains_prop]--> prop:server_down
// dag:risk_model --[contains_prop]--> prop:has_backup
// dag:risk_model --[contains_prop]--> prop:churn_risk
```

---

## 4. Association Types for DAG Structure

| Association | Meaning |
|-------------|---------|
| `dag_source` | Source node of an implication/attack |
| `dag_target` | Target node of an implication/attack |
| `contains_rule` | DAG contains this rule |
| `contains_attack` | DAG contains this attack |
| `contains_prop` | DAG contains this proposition |
| `dag_parent` | This node is part of parent DAG |
| `implies` | Direct implication (sugar for dag_source + rule + dag_target) |
| `attacks` | Direct attack (sugar for dag_source + attack + dag_target) |

---

## 5. The NeuroDAG Schema (JSON View)

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

---

## 8. Populating KnowShowGo with NeuroDAGs

### Creating a Complete DAG (Recursive)

```javascript
// 1. Create proposition nodes
const serverDown = await ksg.createProposition({
  label: "Server is offline",
  type: "DIGITAL",
  truth: 1.0,
  is_locked: true  // observed fact
});

const hasBackup = await ksg.createProposition({
  label: "Backup system available",
  type: "DIGITAL",
  truth: 1.0,
  is_locked: true
});

const churnRisk = await ksg.createProposition({
  label: "Customer churn risk",
  type: "FUZZY",
  prior: 0.2
});

// 2. Create implication rule (as a Node)
const implRule = await ksg.createRule({
  label: "Server downtime implies churn risk",
  type: "IMPLICATION",
  weight: 0.9,
  source: serverDown,
  target: churnRisk
});
// This creates:
//   - Node for the rule
//   - Association: rule --[dag_source]--> serverDown
//   - Association: rule --[dag_target]--> churnRisk

// 3. Create attack (as a Node)
const attackRule = await ksg.createRule({
  label: "Backup negates churn risk",
  type: "ATTACK",
  weight: 1.0,
  source: hasBackup,
  target: churnRisk
});

// 4. Create compound DAG (as a Node)
const riskModel = await ksg.createDAG({
  label: "Server Risk Model",
  contains: [serverDown, hasBackup, churnRisk, implRule, attackRule]
});
// This creates associations for each contained element
```

### API Methods

```javascript
// Create a proposition node
async createProposition({ label, type, truth, prior, is_locked }) {
  const embedding = await this.embedFn(label);
  
  const node = await this.createNode({
    label,
    props: {
      isProposition: true,
      neuro: { type, truth, prior, is_locked }
    },
    embedding
  });
  
  return node.uuid;
}

// Create a rule node with associations
async createRule({ label, type, weight, source, target }) {
  const embedding = await this.embedFn(label);
  
  // Create the rule node
  const rule = await this.createNode({
    label,
    props: {
      isRule: true,
      isNeuroDAG: true,
      neurodag: { type, weight }
    },
    embedding
  });
  
  // Spell out DAG structure via associations
  await this.createAssertion({
    subject: rule.uuid,
    predicate: 'dag_source',
    object: source,
    truth: 1.0
  });
  
  await this.createAssertion({
    subject: rule.uuid,
    predicate: 'dag_target',
    object: target,
    truth: 1.0
  });
  
  return rule.uuid;
}

// Create a compound DAG node
async createDAG({ label, contains }) {
  const embedding = await this.embedFn(label);
  
  const dag = await this.createNode({
    label,
    props: {
      isNeuroDAG: true,
      neurodag: { type: 'COMPOUND' }
    },
    embedding
  });
  
  // Create containment associations
  for (const nodeUuid of contains) {
    const node = await this.getConcept(nodeUuid);
    const predicate = node.props.isRule ? 'contains_rule' 
                    : node.props.isAttack ? 'contains_attack'
                    : 'contains_prop';
    
    await this.createAssertion({
      subject: dag.uuid,
      predicate,
      object: nodeUuid,
      truth: 1.0
    });
  }
  
  return dag.uuid;
}
```

---

## 9. Querying NeuroDAG Structures

### Find All Rules Targeting a Proposition
```javascript
const rules = await ksg.searchAssertions({
  predicate: 'dag_target',
  object: 'prop:churn_risk'
});
// Returns all rules that affect churn_risk
```

### Reconstruct DAG from Nodes
```javascript
async reconstructDAG(dagUuid) {
  const dag = await this.getConcept(dagUuid);
  const containsAssertions = await this.getAssertions({
    subject: dagUuid,
    predicate: /contains_.*/
  });
  
  const nodes = [];
  const edges = [];
  
  for (const a of containsAssertions) {
    const node = await this.getConcept(a.object);
    nodes.push({
      id: node.uuid,
      type: node.props.neuro?.type || 'FUZZY',
      state: {
        truth: node.props.neuro?.truth ?? 0.5,
        prior: node.props.neuro?.prior ?? 0.5,
        is_locked: node.props.neuro?.is_locked ?? false
      }
    });
    
    // Get rule structure
    if (node.props.isRule) {
      const sourceAssn = await this.getAssertions({
        subject: node.uuid,
        predicate: 'dag_source'
      });
      const targetAssn = await this.getAssertions({
        subject: node.uuid,
        predicate: 'dag_target'
      });
      
      if (sourceAssn[0] && targetAssn[0]) {
        edges.push({
          source: sourceAssn[0].object,
          target: targetAssn[0].object,
          type: node.props.neurodag.type,
          weight: node.props.neurodag.weight
        });
      }
    }
  }
  
  return { nodes, edges };
}
```

### Vector Search Over Logic
```javascript
// Find similar logical structures
const query = "risk increases when service fails";
const similar = await ksg.searchConcepts({
  query,
  filters: { 'props.isNeuroDAG': true },
  topK: 5
});
// Returns DAG nodes with similar semantics
```

---

## 10. Summary

**First-Class NeuroDAG Architecture:**

1. **Every proposition is a Node** with `isProposition: true` and `neuro` metadata
2. **Every rule/attack is a Node** with `isRule: true` and `neurodag` object
3. **DAG structure is spelled out via Associations** (`dag_source`, `dag_target`, `contains_*`)
4. **Compound DAGs are Nodes** that contain other DAG elements
5. **All DAG nodes have embeddings** — enabling vector search over logic
6. **Recursive composition** — DAGs can reference other DAGs

This maintains the 4-primitive model (Entity/Type/Predicate/Assertion) while making every logical step queryable, embeddable, and auditable.

```
Entity (Node)
    │
    ├── Proposition (isProposition: true)
    │       └── neuro: { type, truth, prior, is_locked }
    │
    ├── Rule (isRule: true, isNeuroDAG: true)
    │       ├── neurodag: { type: IMPLICATION|ATTACK, weight }
    │       ├── --[dag_source]--> Proposition
    │       └── --[dag_target]--> Proposition
    │
    └── CompoundDAG (isNeuroDAG: true)
            ├── --[contains_prop]--> Proposition
            ├── --[contains_rule]--> Rule
            └── --[contains_attack]--> Rule
```

---

*Updated: 2026-01-14*
*Architecture: First-class NeuroDAG nodes with recursive association structure*
