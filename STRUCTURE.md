# KnowShowGo JavaScript Repository Structure

## Directory Structure

```
knowshowgo-js/
├── src/                          # JavaScript source code
│   ├── index.js                 # Main entry point
│   ├── knowshowgo.js            # Core KnowShowGo API
│   ├── models.js                # Node, Edge, Provenance models
│   └── memory/
│       └── in-memory.js         # In-memory backend for testing
│
├── tests/                        # JavaScript tests
│   └── knowshowgo.test.js       # Core API tests
│
├── docs/                         # Documentation
│   ├── API.md                   # API reference
│   ├── Knowshowgo_SYSTEM_DESIGN_v0.1.md  # Original system design
│   ├── knowshowgo-design-alignment.md     # Design alignment
│   ├── knowshowgo-fuzzy-ontology.md       # Fuzzy ontology design
│   ├── knowshowgo-ontology-architecture.md # Architecture details
│   ├── knowshowgo-versioning-strategy.md   # Versioning approach
│   ├── ksg-orm-design.md        # ORM design
│   ├── TEST-COVERAGE.md         # Test migration guide
│   └── KNOWSHOWGO-UPDATE-BRANCH.md        # Branch notes
│
├── reference/                    # Reference implementations
│   └── python/                  # Python reference code
│       ├── knowshowgo.py        # Core API (Python)
│       ├── ksg_orm.py           # ORM implementation (Python)
│       ├── models.py            # Data models (Python)
│       └── tests/               # Python test suite
│           ├── test_knowshowgo.py
│           ├── test_knowshowgo_associations.py
│           ├── test_knowshowgo_recursive.py
│           ├── test_knowshowgo_generalization.py
│           ├── test_knowshowgo_dag_and_recall.py
│           ├── test_ksg_orm.py
│           ├── test_ksg_orm_write.py
│           └── test_ksg_seed.py
│
├── .github/
│   └── workflows/
│       └── ci.yml               # CI/CD workflow
│
├── package.json                 # Node.js package config
├── jest.config.js              # Jest test configuration
├── LICENSE                      # MIT License
├── README.md                    # Main documentation
├── REPOSITORY-SETUP.md         # Repository setup guide
├── EXTRACTION-GUIDE.md         # Extraction guide
├── SETUP-REPO.ps1              # PowerShell setup script
├── SETUP-REPO.sh               # Bash setup script
└── .gitignore                  # Git ignore rules

```

## What's Included

### ✅ JavaScript Implementation
- Core KnowShowGo API
- Data models (Node, Edge, Provenance)
- In-memory backend for testing
- Basic tests

### ✅ Documentation
- API reference
- System design documents
- Architecture details
- Versioning strategy
- Test coverage guide

### ✅ Reference Implementation
- Python source code (for API compatibility)
- Python test suite (for test migration)
- ORM implementation reference

### ✅ Setup Tools
- Repository setup scripts (PowerShell & Bash)
- CI/CD configuration
- Package configuration

### ⏳ To Be Added
- [ ] Memory backends (ArangoDB, ChromaDB)
- [ ] ORM features (object hydration)
- [ ] Advanced features (generalization, schema merging)
- [ ] Additional tests (migrated from Python)

## File Organization

### Source Code (`src/`)
- `index.js` - Main entry point, exports all public APIs
- `knowshowgo.js` - Core KnowShowGo API implementation
- `models.js` - Data model classes (Node, Edge, Provenance)
- `memory/in-memory.js` - In-memory backend for development/testing

### Tests (`tests/`)
- `knowshowgo.test.js` - Core API tests
- Additional test files to be added as features are implemented

### Documentation (`docs/`)
- All design and API documentation
- Reference for understanding the system

### Reference (`reference/python/`)
- Python implementation for API compatibility reference
- Python tests for test migration guidance
- Helps ensure JavaScript API matches Python API

### Setup Scripts
- `SETUP-REPO.ps1` - PowerShell script for Windows
- `SETUP-REPO.sh` - Bash script for Linux/Mac
- Both scripts automate repository initialization

## Branch Status

This code is on the `knowshowgo-update` branch and is ready for extraction to a separate repository.

### Cognitive Architecture Branch
- Contains cognitive architecture design documents (attention, learning, self-concept)
- **No overlap** with KnowShowGo core implementation
- Focuses on higher-level cognitive features

### Main Branch
- Contains the full OSL Agent prototype
- Uses KnowShowGo as a dependency
- Will eventually use the extracted KnowShowGo package

## Next Steps

1. **Extract to Repository**: Use setup scripts to create separate GitHub repo
2. **Add Memory Backends**: Implement ArangoDB and ChromaDB backends
3. **Implement ORM**: Add object hydration features
4. **Migrate Tests**: Convert Python tests to JavaScript
5. **Publish to npm**: Make available as npm package

