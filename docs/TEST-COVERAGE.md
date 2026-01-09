# Test Coverage and Migration Guide

## Python Test Files Reference

The following Python test files exist in the main repository and should be considered when implementing JavaScript tests:

### Core Tests

1. **`test_knowshowgo.py`**
   - Prototype and concept creation
   - Concept linking to prototypes
   - Versioned concepts

2. **`test_knowshowgo_associations.py`**
   - Association creation
   - Association strength/weight
   - Multiple relationship types

3. **`test_knowshowgo_recursive.py`**
   - Recursive concept creation
   - Nested structures (DAGs, procedures)
   - Parent-child relationships

4. **`test_knowshowgo_generalization.py`**
   - Concept generalization
   - Exemplar merging
   - Taxonomy hierarchy creation

5. **`test_knowshowgo_dag_and_recall.py`**
   - DAG execution
   - Procedure recall
   - Similarity-based retrieval

### ORM Tests

6. **`test_ksg_orm.py`**
   - Object hydration
   - Prototype property inheritance
   - Object creation and saving

7. **`test_ksg_orm_write.py`**
   - Property updates
   - Object persistence
   - Write operations

8. **`test_ksg_seed.py`**
   - Prototype seeding
   - Initial ontology setup
   - Seed data validation

### Integration Tests

9. **`test_agent_ksg_prototype_concept.py`**
   - Agent integration with KSG
   - Prototype/concept usage in agent context

10. **`test_agent_arango_ksg_integration.py`**
    - ArangoDB backend integration
    - End-to-end agent workflows

## JavaScript Test Status

### ✅ Implemented

- Basic prototype creation
- Basic concept creation
- Versioned concepts
- Associations
- Concept search

### ⏳ To Be Implemented

- [ ] Recursive concept creation
- [ ] Concept generalization
- [ ] ORM-style object hydration
- [ ] Property inheritance
- [ ] DAG execution
- [ ] Memory backend implementations (ArangoDB, ChromaDB)

## Test Migration Priority

1. **High Priority** (Core functionality)
   - ✅ Prototype/concept creation
   - ✅ Associations
   - ✅ Versioning
   - [ ] Recursive creation
   - [ ] Search and recall

2. **Medium Priority** (Advanced features)
   - [ ] Generalization
   - [ ] ORM hydration
   - [ ] Property inheritance

3. **Low Priority** (Integration)
   - [ ] Memory backend tests
   - [ ] End-to-end workflows

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Structure

```
tests/
├── knowshowgo.test.js           # Core API tests
├── associations.test.js          # Association tests (to be added)
├── recursive.test.js             # Recursive creation tests (to be added)
├── generalization.test.js        # Generalization tests (to be added)
├── orm.test.js                   # ORM tests (to be added)
└── memory/
    ├── in-memory.test.js         # In-memory backend tests (to be added)
    ├── arango.test.js            # ArangoDB backend tests (to be added)
    └── chroma.test.js            # ChromaDB backend tests (to be added)
```

