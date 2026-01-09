# KnowShowGo Update Branch

## Purpose

This branch contains work on **KnowShowGo refactoring and generalization**, including:

- Versioning strategy (hybrid model: in-place + versioned)
- Query-time generalization (merging similar concepts)
- Schema generalization (emergent prototypes from exemplars)
- Weighting system (separate records for layered weights)
- Architecture improvements (unified model, fuzzy DAG, hyperedges)
- ORM enhancements (prototype-based object hydration)

## Branch Strategy

- **Main branch**: Stable agent prototype with current KnowShowGo implementation
- **Cognitive architecture branch**: Experimental cognitive features (attention, learning, self-concept)
- **KnowShowGo update branch**: Core KnowShowGo refactoring and generalization

## Files in This Branch

### Design Documents
- `docs/knowshowgo-versioning-strategy.md` - Hybrid versioning model (in-place + versioned)
- `docs/knowshowgo-ontology-architecture.md` - Prototype-based OOP model
- `docs/knowshowgo-fuzzy-ontology.md` - Fuzzy ontology design
- `docs/knowshowgo-design-alignment.md` - Alignment with v0.1 system design
- `docs/Knowshowgo_SYSTEM_DESIGN_v0.1.md` - Original system design (reference)

### Implementation (To Be Added)
- `src/personal_assistant/knowshowgo_v2.py` - Refactored KnowShowGo API
- `src/personal_assistant/versioning.py` - Auto-versioning with thresholds
- `src/personal_assistant/weighting.py` - Separate WeightRecord system
- `src/personal_assistant/generalization.py` - Query-time generalization
- `src/personal_assistant/schema_generalization.py` - Emergent schema from exemplars
- `tests/test_knowshowgo_v2.py` - Tests for refactored API
- `tests/test_versioning.py` - Versioning tests
- `tests/test_weighting.py` - Weighting system tests
- `tests/test_generalization.py` - Generalization tests

## Key Features

### 1. Hybrid Versioning
- In-place updates for simple changes
- Versioned updates for significant changes
- Auto-versioning with configurable thresholds

### 2. Query-Time Generalization
- Automatically merge similar concepts when search returns multiple matches
- Create generalized prototypes from exemplars
- Top-down hypothesis testing

### 3. Layered Weighting
- Separate `WeightRecord` concepts
- Multiple weight types (use_frequency, votes, confidence, relevance)
- Query-time aggregation

### 4. Schema Generalization
- Background process to detect similar exemplars
- Merge common features into prototype schemas
- LLM-assisted generalization

### 5. Unified Architecture
- Everything is a Topic (concepts, prototypes, properties, values)
- Edges are also nodes (hyperedges)
- Fuzzy DAG structure

## Development Approach

1. **Design first**: All designs documented before implementation
2. **Incremental**: Implement one feature at a time
3. **Feature flags**: Use flags to enable/disable features
4. **Testing**: Test each component in isolation
5. **Backward compatibility**: Maintain compatibility with existing agent

## Status

**Current Status**: Design phase complete, implementation pending

## Relationship to Other Branches

- **Main**: Current stable implementation
- **Cognitive architecture**: Uses KnowShowGo but focuses on cognitive features
- **KnowShowGo update**: Core KnowShowGo improvements that benefit all branches

## Next Steps

1. Implement hybrid versioning (auto-versioning with thresholds)
2. Implement query-time generalization
3. Implement separate weighting system
4. Implement schema generalization
5. Refactor unified architecture
6. Test incrementally
7. Merge to main when stable

## Notes

- This branch focuses on core KnowShowGo improvements
- Changes should be backward compatible where possible
- Use feature flags to isolate changes
- Test thoroughly before merging to main

