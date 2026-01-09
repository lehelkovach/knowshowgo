# KnowShowGo Versioning Strategy

## Design Philosophy

KnowShowGo should balance **simplicity for common operations** with **rich history for learning and audit trails**. The strategy differs for concepts vs. prototypes.

## Recommended Approach

### 1. **Concepts (Instances/Data): Hybrid Model**

**For Now (MVP):**
- **In-place updates** for simple property changes (status, priority, metadata)
- **Versioned updates** for significant changes (procedure steps, structure, learning adaptations)
- User/agent chooses via `update_properties()` vs. `create_concept(previous_version_uuid=...)`

**Rationale:**
- Most updates are simple (task.status = "done", procedure.priority = 5)
- Versioning everything would create excessive nodes and complexity
- But learning/adaptation benefits from history (see how procedure evolved)

**Implementation:**
```python
# Simple update (in-place)
ksg.update_properties(concept_uuid, {"status": "completed", "priority": 5})

# Significant change (versioned)
new_uuid = ksg.create_concept(
    prototype_uuid=proc_proto_uuid,
    json_obj=adapted_procedure,
    embedding=adapted_embedding,
    previous_version_uuid=concept_uuid  # Creates version chain
)
```

**Future (Ideal):**
- **Automatic versioning** with configurable thresholds:
  - Version if: structural change (steps added/removed), embedding changes significantly, or explicit flag
  - In-place if: simple property updates (status, priority, metadata)
- **Time-based snapshots**: Periodic snapshots of frequently-updated concepts
- **Diff storage**: Store only changes between versions (delta encoding)

### 2. **Prototypes (Schemas/Categories): Immutable + Versioned**

**Always versioned** - schemas should be stable and auditable.

```python
# Prototype changes create new versions
new_proto_uuid = ksg.create_prototype(
    name="ProcedureV2",
    description="Updated procedure schema",
    context="ctx",
    labels=["procedure", "v2"],
    embedding=new_embedding,
    base_prototype_uuid=old_proto_uuid  # Links to previous
)
```

**Rationale:**
- Schemas define structure - changes affect all instances
- Need to track schema evolution for compatibility
- Immutability prevents accidental breaking changes

### 3. **Weighting: Separate Records (Layered)**

**Current:** Weights stored on edges (Association `w` property)

**Ideal:** Separate weighting records that reference concepts/edges

```python
# Weighting as separate concepts
WeightRecord {
    prototype_uuid: "WeightRecord",
    props: {
        "target_uuid": concept_uuid,  # What is being weighted
        "target_type": "concept" | "edge" | "association",
        "weight_type": "use_frequency" | "votes" | "confidence" | "relevance",
        "value": 0.85,
        "source": "user" | "agent" | "community",
        "timestamp": "2024-01-01T00:00:00Z"
    }
}
```

**Benefits:**
- Multiple weighting systems coexist (use frequency, votes, confidence)
- Weights can be updated independently without versioning the concept
- Historical weighting data preserved
- Community voting separate from agent use frequency

**Query-time aggregation:**
```python
# Get effective weight = aggregate(use_frequency, votes, confidence)
effective_weight = aggregate_weights(
    concept_uuid,
    weights=["use_frequency", "votes", "confidence"],
    aggregation="weighted_average"  # or "max", "min", etc.
)
```

## Implementation Plan

### Phase 1: Current State (Now)
✅ In-place updates via `update_properties()`
✅ Versioned updates via `previous_version_uuid`
✅ Weights on edges (`w` property)

### Phase 2: Enhanced Versioning (Next)
- Add `update_concept()` method that auto-decides: version vs. in-place
- Add versioning thresholds (configurable)
- Add `get_version_history(concept_uuid)` to traverse `next_version` chain

### Phase 3: Separate Weighting (Future)
- Create `WeightRecord` prototype
- Migrate edge weights to `WeightRecord` concepts
- Add `aggregate_weights()` function
- Support multiple weight types per concept/edge

### Phase 4: Advanced Features (Future)
- Time-based snapshots
- Delta encoding for versions
- Weight decay over time
- Community voting system

## API Design

### Current API
```python
# In-place update
ksg.update_properties(concept_uuid, {"status": "done"})

# Versioned update
new_uuid = ksg.create_concept(
    prototype_uuid, json_obj, embedding,
    previous_version_uuid=old_uuid
)
```

### Enhanced API (Phase 2)
```python
# Auto-decide version vs. in-place
result = ksg.update_concept(
    concept_uuid,
    properties={"steps": new_steps},  # Structural change -> version
    force_version=False,  # Auto-detect if needed
    version_threshold=0.3  # Embedding similarity threshold
)
# Returns: {"updated_uuid": uuid, "versioned": True/False}

# Get version history
history = ksg.get_version_history(concept_uuid)
# Returns: [{"uuid": uuid, "version": n, "timestamp": "...", "changes": {...}}]
```

### Weighting API (Phase 3)
```python
# Add weight
ksg.add_weight(
    target_uuid=concept_uuid,
    weight_type="use_frequency",
    value=0.85,
    source="agent"
)

# Get aggregated weight
weight = ksg.get_weight(
    target_uuid=concept_uuid,
    weight_types=["use_frequency", "votes"],
    aggregation="weighted_average"
)
```

## Decision Matrix

| Change Type | Current | Recommended | Rationale |
|------------|---------|-------------|-----------|
| Simple property (status, priority) | In-place | In-place | Too frequent for versioning |
| Structural change (steps, schema) | Version | Version | Learning needs history |
| Prototype change | Version | Version | Schemas must be immutable |
| Weight update | Edge property | Separate record | Multiple weight types coexist |
| Learning adaptation | Version | Version | Track evolution |

## Summary

**For Now:**
- ✅ Keep hybrid model (in-place + versioned)
- ✅ Prototypes always versioned
- ✅ Weights on edges (simple)

**Ideal:**
- ✅ Auto-versioning with thresholds
- ✅ Separate weighting records
- ✅ Rich version history and diffs

**Key Principle:** Version when it matters for learning/audit, update in-place for efficiency.

