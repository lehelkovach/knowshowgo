# Cognitive Memory Model for KnowShowGo

## Goal

Model KnowShowGo to mimic **human semantic memory** - a cognitive-inspired neurosymbolic semantic fuzzy DAG graph memory database.

## Human Semantic Memory Characteristics

### 1. **Prototype-Based Categories**
- Humans form categories around prototypes (typical examples)
- Exemplars vary in typicality
- Categories have fuzzy boundaries

### 2. **Associative Networks**
- Concepts linked by associations
- Strength of association varies
- Activation spreads through network

### 3. **Context-Dependent Retrieval**
- Memory retrieval depends on context
- Similar contexts activate similar memories
- Transfer learning across contexts

### 4. **Hierarchical Organization**
- Concepts organized in hierarchies
- Multiple inheritance (e.g., "penguin" is both "bird" and "swimmer")
- Top-down and bottom-up processing

### 5. **Fuzzy Boundaries**
- Categories have fuzzy boundaries
- Partial matches, not exact
- Degrees of membership

## KnowShowGo Cognitive Model

### 1. Prototypes as Categories

```javascript
// Prototype = Category schema
Person (Prototype)
  ├─ Typical properties: name, age, email
  ├─ Typical exemplars: John, Jane, Bob
  └─ Fuzzy boundary: Similarity threshold determines membership
```

### 2. Concepts as Exemplars

```javascript
// Concept = Exemplar instance
John (Concept) instanceOf Person
  ├─ Properties: name='John', age=30
  ├─ Typicality: How typical of Person category
  └─ Context: When/where this exemplar was learned
```

### 3. Associations as Memory Links

```javascript
// Association = Memory link with strength
John --[knows, w=0.8]--> Jane
John --[works_with, w=0.6]--> Bob

// Activation spreads:
// Query "John" → activates John → spreads to Jane (0.8), Bob (0.6)
```

### 4. Embeddings as Semantic Space

```javascript
// Embedding = Position in semantic space
Person embedding: [0.1, 0.2, 0.3, ...]
John embedding: [0.12, 0.21, 0.31, ...]  // Close to Person

// Similarity = Distance in semantic space
// Fuzzy matching = Nearby in semantic space
```

### 5. Context-Aware Retrieval

```javascript
// Context affects retrieval
const results = await ksg.searchConcepts({
  query: 'person',
  context: 'work',  // Context affects similarity
  topK: 10
});

// Different contexts → different results
// "person" in "work" context → different from "person" in "family" context
```

## Optimal Architecture

### Single Unified Model

```
Topic (Node)
  ├─ All concepts, prototypes, properties, values, edges
  ├─ Embedding (neural/semantic)
  ├─ Properties via associations (symbolic)
  └─ Weights via associations (fuzzy)

Association (Topic → Topic)
  ├─ All relationships
  ├─ Weight (0.0-1.0) - fuzzy strength
  ├─ Embedding - semantic relationship
  └─ Context - when/where relationship learned
```

### Why This Model?

1. **Cognitive Fidelity**: Matches human semantic memory structure
2. **Neurosymbolic**: Neural (embeddings) + Symbolic (graph)
3. **Fuzzy**: Degrees of membership, not binary
4. **Semantic**: Meaning-based, not syntax-based
5. **DAG**: Hierarchical, no cycles
6. **Uniform**: Everything is a node, everything uses associations

## Implementation

### Current Status
- ✅ Everything is a Topic (node)
- ✅ Multiple inheritance via "is_a"
- ✅ Properties and values as nodes
- ✅ Associations with weights
- ✅ Embeddings for all nodes

### To Complete
- ⏳ Edges as nodes (hyperedges)
- ⏳ Context-aware embeddings
- ⏳ Activation spreading
- ⏳ Query-time generalization
- ⏳ Schema generalization
- ⏳ Layered weighting

## Benefits

1. **Cognitive Fidelity**: Matches human memory structure
2. **Neurosymbolic**: Best of both worlds
3. **Fuzzy**: Handles uncertainty and partial matches
4. **Semantic**: Meaning-based retrieval
5. **DAG**: Efficient, no cycles
6. **Uniform**: Simple, elegant model

