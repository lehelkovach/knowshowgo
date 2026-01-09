# KnowShowGo Extraction Guide

This directory contains a standalone JavaScript/Node.js implementation of KnowShowGo that can be extracted into a separate GitHub repository.

## Current Structure

```
knowshowgo-js/
├── src/
│   ├── index.js          # Main entry point
│   ├── knowshowgo.js     # Core KnowShowGo API
│   ├── models.js         # Node, Edge, Provenance models
│   └── memory/
│       └── in-memory.js  # In-memory backend
├── tests/
│   └── knowshowgo.test.js
├── package.json
├── README.md
└── EXTRACTION-GUIDE.md
```

## Extraction Steps

### 1. Create New Repository

```bash
# On GitHub, create a new repository: knowshowgo-js
```

### 2. Initialize Repository

```bash
cd knowshowgo-js
git init
git add .
git commit -m "Initial commit: KnowShowGo JavaScript implementation"
git remote add origin https://github.com/yourusername/knowshowgo-js.git
git push -u origin main
```

### 3. Update Package.json

- Update `repository.url` with the new repo URL
- Update `name` if needed (e.g., `@yourorg/knowshowgo`)

### 4. Add CI/CD

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
```

### 5. Add Documentation

- Update `README.md` with installation instructions
- Add `CONTRIBUTING.md` if needed
- Add `LICENSE` file

### 6. Publish to npm (Optional)

```bash
npm login
npm publish
```

## Features to Add After Extraction

1. **Memory Backends**
   - ArangoDB backend
   - ChromaDB backend
   - PostgreSQL backend

2. **ORM Features**
   - Object hydration from prototypes
   - Recursive concept creation
   - Property inheritance

3. **Advanced Features**
   - Query-time generalization
   - Schema generalization
   - Layered weighting system

4. **TypeScript Support**
   - Add TypeScript definitions
   - Convert to TypeScript (optional)

## Integration with OSL Agent

After extraction, the OSL Agent can use KnowShowGo as a dependency:

```bash
# In osl-agent-prototype
npm install knowshowgo
# or
npm install github:yourusername/knowshowgo-js
```

```javascript
import { KnowShowGo } from 'knowshowgo';
```

## Notes

- This implementation follows the same design as the Python version
- API is compatible (same method names and signatures)
- Memory backend interface is abstracted for easy swapping
- Tests cover core functionality

