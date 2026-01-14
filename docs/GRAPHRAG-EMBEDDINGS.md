# GraphRAG & Advanced Embeddings for KnowShowGo

**Status:** Future Feature (Post-MVP)
**Dependencies:** NeuroSym.js, Assertion model, Vector search

---

## 1. Three Embedding Spaces

KnowShowGo will support three levels of embedding:

### Level 1: Entity Embeddings (Current)
What we have now — embed the node/entity.

```javascript
// Current implementation
Entity {
  uuid: "deepseek",
  props: { label: "DeepSeek" },
  llmEmbedding: [0.1, 0.3, ...]  // Vector of the entity
}
```

### Level 2: Relationship Embeddings (Future)
Embed the **Predicates** themselves using translating embeddings.

```javascript
// TransE-style: Subject + Predicate ≈ Object
Predicate {
  uuid: "trained_on",
  props: { label: "trained on" },
  llmEmbedding: [0.05, -0.2, ...]  // Vector of the relationship
}

// The math constraint:
// Vector(DeepSeek) + Vector(trained_on) ≈ Vector(OpenAI)
```

**Use case:** Link prediction — infer missing relationships from vector geometry.

### Level 3: Triple/Fact Embeddings (Future)
Embed the **entire assertion** as a natural language sentence.

```javascript
Assertion {
  subject: "deepseek",
  predicate: "trained_on",
  object: "openai",
  // Serialize to text, then embed
  factText: "DeepSeek was trained on outputs from OpenAI.",
  factEmbedding: [0.2, 0.4, ...]  // Vector of the claim
}
```

**Use case:** Hybrid search — find relevant facts before graph traversal.

---

## 2. NeuroDAG Representation

Extend the NeuroSym schema to support all three embedding types:

```json
{
  "nodes": [
    {
      "id": "deepseek",
      "type": "FUZZY",
      "content": { "text": "DeepSeek AI model" },
      "embeddings": {
        "entity": [0.1, 0.3, ...],
        "context": [0.2, 0.1, ...]
      },
      "state": { "truth": 1.0, "prior": 0.5 }
    }
  ],
  
  "edges": [
    {
      "id": "assertion:123",
      "source": "deepseek",
      "target": "openai",
      "predicate": "trained_on",
      "type": "IMPLICATION",
      "weight": 0.9,
      "embeddings": {
        "predicate": [0.05, -0.2, ...],
        "triple": [0.2, 0.4, ...]
      },
      "factText": "DeepSeek was trained on outputs from OpenAI."
    }
  ],
  
  "predicates": [
    {
      "id": "trained_on",
      "label": "trained on",
      "embedding": [0.05, -0.2, ...],
      "transE": {
        "translation": [0.05, -0.2, ...],
        "margin": 1.0
      }
    }
  ]
}
```

---

## 3. TransE Link Prediction

### The Math

For a triple `(s, p, o)`:
```
Vector(s) + Vector(p) ≈ Vector(o)
```

**Score function:**
```javascript
score(s, p, o) = -||embedding(s) + embedding(p) - embedding(o)||
```

Lower distance = more likely to be true.

### Implementation Sketch

```javascript
// src/embeddings/transe.js

class TransEPredictor {
  constructor(entities, predicates) {
    this.entities = entities;    // Map<id, vector>
    this.predicates = predicates; // Map<id, vector>
  }

  /**
   * Score a potential triple
   * Lower score = more likely true
   */
  score(subjectId, predicateId, objectId) {
    const s = this.entities.get(subjectId);
    const p = this.predicates.get(predicateId);
    const o = this.entities.get(objectId);
    
    if (!s || !p || !o) return Infinity;
    
    // L2 distance: ||s + p - o||
    let dist = 0;
    for (let i = 0; i < s.length; i++) {
      const diff = s[i] + p[i] - o[i];
      dist += diff * diff;
    }
    return Math.sqrt(dist);
  }

  /**
   * Predict missing object given subject + predicate
   * Returns top-k candidate entities
   */
  predictObject(subjectId, predicateId, topK = 5) {
    const s = this.entities.get(subjectId);
    const p = this.predicates.get(predicateId);
    
    if (!s || !p) return [];
    
    // Target vector: s + p
    const target = s.map((v, i) => v + p[i]);
    
    // Find nearest entities to target
    const candidates = [];
    for (const [id, vec] of this.entities.entries()) {
      const dist = this.cosineDist(target, vec);
      candidates.push({ id, dist });
    }
    
    return candidates
      .sort((a, b) => a.dist - b.dist)
      .slice(0, topK);
  }

  /**
   * Predict missing predicate given subject + object
   */
  predictPredicate(subjectId, objectId, topK = 5) {
    const s = this.entities.get(subjectId);
    const o = this.entities.get(objectId);
    
    if (!s || !o) return [];
    
    // Target vector: o - s (the translation needed)
    const target = o.map((v, i) => v - s[i]);
    
    const candidates = [];
    for (const [id, vec] of this.predicates.entries()) {
      const dist = this.cosineDist(target, vec);
      candidates.push({ id, dist });
    }
    
    return candidates
      .sort((a, b) => a.dist - b.dist)
      .slice(0, topK);
  }

  cosineDist(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1 - sim; // Convert similarity to distance
  }
}

module.exports = TransEPredictor;
```

---

## 4. GraphRAG Architecture

The hybrid search pattern combining vectors + graph traversal:

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                                │
│  "How are Chinese models learning from American ones?"          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Vector Search (The Scout)                              │
│                                                                  │
│  query_embedding = embed("How are Chinese models...")           │
│                                                                  │
│  Search entity embeddings → Find "DeepSeek" (high similarity)   │
│  Search fact embeddings → Find "DeepSeek trained on OpenAI"     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Graph Traversal (The Map)                              │
│                                                                  │
│  Starting from DeepSeek node, traverse assertions:              │
│                                                                  │
│  DeepSeek --[trained_on]--> OpenAI                              │
│  DeepSeek --[based_on]--> LLaMA                                 │
│  DeepSeek --[origin]--> China                                   │
│  OpenAI --[origin]--> USA                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: NeuroSym Reasoning (The Brain)                         │
│                                                                  │
│  Run fuzzy inference on subgraph:                               │
│  - trained_on has truth=0.9 (high confidence claim)             │
│  - Attack edges? Check for contradicting evidence               │
│  - Compute canonical snapshot via WTA                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Answer Generation                                       │
│                                                                  │
│  LLM receives structured evidence:                              │
│  {                                                              │
│    "path": "DeepSeek -> trained_on -> OpenAI",                  │
│    "facts": ["DeepSeek trained on OpenAI outputs"],             │
│    "confidence": 0.9,                                           │
│    "sources": ["assertion:123"]                                 │
│  }                                                              │
│                                                                  │
│  → Grounded answer with provenance                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. API Design

### Search Endpoints

```javascript
// Vector search on entities
POST /api/search/entities
{
  "query": "Chinese AI models",
  "topK": 10,
  "threshold": 0.7
}

// Vector search on facts (triple embeddings)
POST /api/search/facts
{
  "query": "models trained on other models",
  "topK": 10
}

// Link prediction
POST /api/predict/link
{
  "subject": "deepseek",
  "predicate": "trained_on",
  "topK": 5
}
// Returns: [{ object: "openai", score: 0.92 }, ...]

// Predicate prediction
POST /api/predict/predicate
{
  "subject": "deepseek",
  "object": "openai",
  "topK": 5
}
// Returns: [{ predicate: "trained_on", score: 0.85 }, ...]
```

### GraphRAG Query

```javascript
// Full GraphRAG query
POST /api/graphrag/query
{
  "question": "How are Chinese models learning from American ones?",
  "maxHops": 3,
  "includeReasoning": true
}

// Response
{
  "answer": "DeepSeek, a Chinese AI model, was trained on outputs from OpenAI...",
  "evidence": {
    "entities": ["deepseek", "openai"],
    "paths": [
      { "from": "deepseek", "via": "trained_on", "to": "openai", "truth": 0.9 }
    ],
    "facts": [
      {
        "assertionId": "assertion:123",
        "text": "DeepSeek was trained on outputs from OpenAI.",
        "truth": 0.9,
        "sources": ["news:reuters:2024"]
      }
    ]
  },
  "reasoning": {
    "neurodag": { /* NeuroSym subgraph */ },
    "inference": { /* WTA resolution trace */ }
  }
}
```

---

## 6. Integration with Existing Architecture

### Assertion Extension

```javascript
// Extended Assertion model
class Assertion {
  constructor({
    subject,
    predicate,
    object,
    truth,
    strength,
    // ... existing fields ...
    
    // NEW: Embedding fields
    factText: null,           // Serialized triple as sentence
    factEmbedding: null,      // Vector of the fact
    predicateEmbedding: null  // TransE predicate vector
  }) { ... }
}
```

### Entity Extension

```javascript
// Extended Entity/Node model
class Node {
  constructor({
    // ... existing fields ...
    
    // NEW: Multiple embedding spaces
    embeddings: {
      entity: null,    // Standard semantic embedding
      context: null,   // Contextual embedding (from connected nodes)
      transE: null     // TransE entity embedding (learned)
    }
  }) { ... }
}
```

### Predicate as First-Class Entity

```javascript
// Predicate with its own embedding
class Predicate extends Node {
  constructor({
    name,
    valueType,
    // ... existing fields ...
    
    // NEW: Relationship embedding
    translationVector: null,  // TransE learned translation
    embedding: null           // Semantic embedding of predicate name
  }) { ... }
}
```

---

## 7. Implementation Phases

### Phase 1: Fact Embeddings (v0.4)
- [ ] Add `factText` generation to Assertion
- [ ] Add `factEmbedding` field
- [ ] Implement `/api/search/facts` endpoint
- [ ] Index fact embeddings in memory/ArangoDB

### Phase 2: GraphRAG Query (v0.5)
- [ ] Implement hybrid search (vector → graph traversal)
- [ ] Integrate with NeuroSym for reasoning step
- [ ] Add `/api/graphrag/query` endpoint
- [ ] Return structured evidence with provenance

### Phase 3: TransE Link Prediction (v0.6)
- [ ] Implement `TransEPredictor` class
- [ ] Add predicate embeddings
- [ ] Add `/api/predict/link` endpoint
- [ ] Training loop for learning translations

### Phase 4: Advanced Embeddings (v1.0+)
- [ ] RotatE (rotation-based relations)
- [ ] Contextual entity embeddings
- [ ] Multi-hop reasoning with embeddings
- [ ] Confidence calibration

---

## 8. Example: Full GraphRAG Flow

```javascript
// User query
const question = "How are Chinese models learning from American ones?";

// Step 1: Vector search
const queryEmb = await ksg.embedFn(question);
const relevantFacts = await ksg.searchFacts(queryEmb, { topK: 5 });
// → [{ assertion: "DeepSeek trained on OpenAI", score: 0.92 }]

// Step 2: Extract seed entities
const seedEntities = relevantFacts.flatMap(f => [f.subject, f.object]);
// → ["deepseek", "openai"]

// Step 3: Graph traversal (expand neighborhood)
const subgraph = await ksg.traverseNeighborhood(seedEntities, { maxHops: 2 });
// → Nodes: [deepseek, openai, china, usa, llama, ...]
// → Edges: [trained_on, origin, based_on, ...]

// Step 4: NeuroSym reasoning
const neurodag = ksg.toNeuroDAG(subgraph);
const engine = new NeuroEngine(neurodag);
const inference = engine.run({
  'deepseek': 1.0,  // Observed entity
  'openai': 1.0     // Observed entity
});
// → Propagates truth through implications/attacks

// Step 5: WTA canonicalization
const snapshot = await ksg.getSnapshot('deepseek');
// → Canonical view with winning assertions

// Step 6: Generate answer
const context = {
  question,
  facts: relevantFacts,
  paths: subgraph.paths,
  inference,
  snapshot
};
const answer = await llm.generateAnswer(context);
// → "DeepSeek, developed in China, was trained on outputs from OpenAI..."
```

---

## 9. Data Model Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    Entity (Node)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ entity_emb  │  │ context_emb │  │ transE_emb  │             │
│  │ (semantic)  │  │ (neighbors) │  │ (learned)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Assertion
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Assertion (Edge)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ pred_emb    │  │ fact_emb    │  │ truth/      │             │
│  │ (TransE)    │  │ (sentence)  │  │ strength    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  factText: "DeepSeek was trained on OpenAI outputs."            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Link Prediction
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TransE Constraint                             │
│                                                                  │
│       Vector(Subject) + Vector(Predicate) ≈ Vector(Object)      │
│                                                                  │
│       DeepSeek_vec + trained_on_vec ≈ OpenAI_vec                │
└─────────────────────────────────────────────────────────────────┘
```

---

*Document created: 2026-01-14*
*Status: Future Feature Specification*
*Dependencies: NeuroSym.js, Assertion model (MVP)*
