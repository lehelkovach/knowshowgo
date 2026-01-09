# Repository Setup Guide

This guide will help you set up either `knowshowgo` or `knowshowgo-service` as a separate GitHub repository.

## Option 1: Using the Setup Script (Recommended)

### For `knowshowgo` repository:

**On Windows (PowerShell):**
```powershell
cd knowshowgo-js
.\SETUP-REPO.ps1 -RepoName "knowshowgo" -GitHubUser "lehelkovach"
```

**On Linux/Mac (Bash):**
```bash
cd knowshowgo-js
chmod +x SETUP-REPO.sh
./SETUP-REPO.sh knowshowgo lehelkovach
```

### For `knowshowgo-service` repository:

**On Windows (PowerShell):**
```powershell
cd knowshowgo-js
.\SETUP-REPO.ps1 -RepoName "knowshowgo-service" -GitHubUser "lehelkovach"
```

**On Linux/Mac (Bash):**
```bash
cd knowshowgo-js
chmod +x SETUP-REPO.sh
./SETUP-REPO.sh knowshowgo-service lehelkovach
```

## Option 2: Manual Setup

### Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `knowshowgo` or `knowshowgo-service`
3. Description: "A fuzzy ontology knowledge graph for semantic memory"
4. Visibility: Public or Private (your choice)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Step 2: Update package.json

Edit `knowshowgo-js/package.json` and update:
```json
{
  "name": "knowshowgo",  // or "knowshowgo-service"
  "repository": {
    "type": "git",
    "url": "https://github.com/lehelkovach/knowshowgo.git"  // Update to match repo name
  }
}
```

### Step 3: Initialize and Push

```bash
cd knowshowgo-js

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: KnowShowGo JavaScript implementation"

# Add remote
git remote add origin https://github.com/lehelkovach/knowshowgo.git
# OR for knowshowgo-service:
# git remote add origin https://github.com/lehelkovach/knowshowgo-service.git

# Create main branch and push
git branch -M main
git push -u origin main
```

## After Repository is Created

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Tests

```bash
npm test
```

### 3. (Optional) Set up GitHub Actions

The CI/CD workflow is already included in `.github/workflows/ci.yml`. It will run automatically on push.

### 4. (Optional) Publish to npm

If you want to publish to npm:

```bash
# Update version in package.json
npm version patch  # or minor, major

# Login to npm
npm login

# Publish
npm publish
```

## Repository Names: `knowshowgo` vs `knowshowgo-service`

### `knowshowgo` (Recommended)
- **Use case**: Core library/package
- **Purpose**: Standalone npm package that can be imported by other projects
- **Best for**: General-purpose semantic memory for any JavaScript/Node.js application
- **npm name**: `knowshowgo`

### `knowshowgo-service`
- **Use case**: Standalone microservice
- **Purpose**: REST API service wrapping the KnowShowGo library
- **Best for**: When you want a separate service that other applications can call via HTTP
- **npm name**: `knowshowgo-service` (would need additional service layer)

**Recommendation**: Start with `knowshowgo` as the core library. You can later create `knowshowgo-service` that uses `knowshowgo` as a dependency if you need a service layer.

## What's Included

✅ Core KnowShowGo API (`src/knowshowgo.js`)
✅ Data models (`src/models.js`)
✅ In-memory backend (`src/memory/in-memory.js`)
✅ Comprehensive tests (`tests/knowshowgo.test.js`)
✅ GitHub Actions CI/CD (`.github/workflows/ci.yml`)
✅ License (MIT)
✅ README with usage examples
✅ Jest configuration
✅ Package.json with proper dependencies

## Next Steps After Setup

1. **Add memory backends** (ArangoDB, ChromaDB, PostgreSQL)
2. **Add ORM features** (object hydration, recursive creation)
3. **Add advanced features** (query-time generalization, schema generalization)
4. **Add TypeScript support** (optional)
5. **Create documentation** (API docs with JSDoc)

## Troubleshooting

### If remote already exists:
```bash
git remote remove origin
git remote add origin https://github.com/lehelkovach/knowshowgo.git
```

### If you need to change the branch name:
```bash
git branch -M main
git push -u origin main
```

### If tests fail:
```bash
# Make sure dependencies are installed
npm install

# Run tests with verbose output
npm test -- --verbose
```

