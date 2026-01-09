# Architecture Patterns to Borrow from OSL Agent

This document outlines the key architectural patterns from `osl-agent-prototype` that should be incorporated into the KnowShowGo JavaScript implementation.

## 1. Swappable Backend Pattern (Interface/Abstract Classes)

### Pattern
**Abstract interface with multiple implementations** - Allows swapping backends (Mock, ArangoDB, ChromaDB) without changing client code.

### OSL Agent Implementation
```python
# tools.py - Abstract interface
class MemoryTools(ABC):
    @abstractmethod
    def search(self, query_text: str, top_k: int, ...) -> List[Dict]:
        pass
    
    @abstractmethod
    def upsert(self, item: Union[Node, Edge], ...) -> Dict:
        pass

# Multiple implementations
- MockMemoryTools (in-memory dicts)
- ArangoMemoryTools (ArangoDB)
- ChromaMemoryTools (ChromaDB)
- NetworkXMemoryTools (in-memory graph)
```

### KnowShowGo JavaScript Implementation
```javascript
// src/memory/memory-interface.js
export class MemoryInterface {
  async search({ query, topK, filters, queryEmbedding }) {
    throw new Error('Not implemented');
  }
  
  async upsert(item, provenance, options) {
    throw new Error('Not implemented');
  }
  
  async getNode(uuid) {
    throw new Error('Not implemented');
  }
}

// Multiple implementations
- InMemoryMemory (already exists)
- ArangoMemory (to be added)
- ChromaMemory (to be added)
- NetworkXMemory (to be added)
```

**Status**: ✅ Partially implemented (InMemoryMemory exists, needs interface)

---

## 2. ORM Pattern (Object Hydration)

### Pattern
**Prototype-based object hydration** - Automatically populate objects with prototype properties + concept values (JavaScript-style inheritance).

### OSL Agent Implementation
```python
# ksg_orm.py
class KSGORM:
    def get_concept(self, concept_uuid: str, hydrate: bool = True):
        # 1. Load concept
        # 2. Find prototype via instanceOf
        # 3. Load prototype property definitions
        # 4. Merge prototype properties + concept values
        # 5. Return hydrated object
```

### KnowShowGo JavaScript Implementation
```javascript
// src/orm/ksg-orm.js
export class KSGORM {
  async getConcept(conceptUuid, hydrate = true) {
    // 1. Load concept
    // 2. Find prototype via instanceOf
    // 3. Load prototype property definitions
    // 4. Merge prototype properties + concept values
    // 5. Return hydrated object
  }
  
  async createObject(prototypeName, properties) {
    // Create concept with automatic prototype lookup
  }
  
  async saveObject(hydratedObj) {
    // Save hydrated object back to graph
  }
}
```

**Status**: ❌ Not implemented (design doc exists, needs implementation)

---

## 3. Dependency Injection Pattern

### Pattern
**Constructor-based dependency injection** - Dependencies passed via constructor, not hardcoded.

### OSL Agent Implementation
```python
class KnowShowGoAPI:
    def __init__(self, memory: MemoryTools, embed_fn: Optional[EmbedFn] = None):
        self.memory = memory
        self.embed_fn = embed_fn
        self.orm = KSGORM(memory)  # ORM also gets memory injected
```

### KnowShowGo JavaScript Implementation
```javascript
// Already follows this pattern ✅
export class KnowShowGo {
  constructor({ embedFn, memory }) {
    this.embedFn = embedFn;
    this.memory = memory;
    // this.orm = new KSGORM(memory);  // When ORM is added
  }
}
```

**Status**: ✅ Already implemented correctly

---

## 4. Provenance Tracking

### Pattern
**Every operation tracks provenance** - Source, timestamp, confidence, trace_id.

### OSL Agent Implementation
```python
class Provenance:
    source: Literal["user", "tool", "doc"]
    ts: str
    confidence: float
    trace_id: str

# Used in all operations
def create_concept(..., provenance: Optional[Provenance] = None):
    prov = provenance or Provenance(
        source="user",
        ts=datetime.now(timezone.utc).isoformat(),
        confidence=1.0,
        trace_id="knowshowgo",
    )
```

### KnowShowGo JavaScript Implementation
```javascript
// Already has Provenance model ✅
export class Provenance {
  constructor({ source, ts, confidence, traceId }) {
    this.source = source; // 'user' | 'tool' | 'doc'
    this.ts = ts || new Date().toISOString();
    this.confidence = confidence ?? 1.0;
    this.traceId = traceId || 'knowshowgo';
  }
}

// Already used in operations ✅
async createConcept({ ..., provenance = null }) {
  const prov = provenance || new Provenance({...});
  // ...
}
```

**Status**: ✅ Already implemented

---

## 5. Embedding Function Injection

### Pattern
**Embedding function passed as dependency** - Allows swapping embedding providers (OpenAI, local, etc.).

### OSL Agent Implementation
```python
EmbedFn = Callable[[str], List[float]]

class KnowShowGoAPI:
    def __init__(self, memory: MemoryTools, embed_fn: Optional[EmbedFn] = None):
        self.embed_fn = embed_fn
```

### KnowShowGo JavaScript Implementation
```javascript
// Already follows this pattern ✅
export class KnowShowGo {
  constructor({ embedFn, memory }) {
    if (!embedFn) {
      throw new Error('embedFn is required');
    }
    this.embedFn = embedFn; // Async function(text: string) => Promise<number[]>
  }
}
```

**Status**: ✅ Already implemented correctly

---

## 6. Mock/Test Implementation Pattern

### Pattern
**Mock implementations for testing** - In-memory implementations that match the interface.

### OSL Agent Implementation
```python
# mock_tools.py
class MockMemoryTools(MemoryTools):
    def __init__(self):
        self.nodes: Dict[str, Node] = {}
        self.edges: Dict[str, Edge] = {}
    
    def search(...):
        # In-memory search implementation
```

### KnowShowGo JavaScript Implementation
```javascript
// Already has InMemoryMemory ✅
export class InMemoryMemory {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
  }
  
  async search({ query, topK, filters, queryEmbedding }) {
    // In-memory search implementation
  }
}
```

**Status**: ✅ Already implemented

---

## 7. Recursive Concept Creation

### Pattern
**Nested concept creation** - Create concepts with nested child concepts (e.g., Procedure DAGs).

### OSL Agent Implementation
```python
# knowshowgo.py
def create_concept_recursive(
    self,
    prototype_uuid: str,
    json_obj: Dict[str, Any],
    embedding: List[float],
    ...
) -> str:
    # Create main concept
    # Recursively create nested concepts (steps, children, etc.)
    # Link parent -> child edges
```

### KnowShowGo JavaScript Implementation
```javascript
// To be implemented
async createConceptRecursive({
  prototypeUuid,
  jsonObj,
  embedding,
  ...
}) {
  // Create main concept
  // Recursively create nested concepts
  // Link parent -> child edges
}
```

**Status**: ❌ Not implemented (design doc exists)

---

## 8. Versioned Updates Pattern

### Pattern
**Immutable versioning** - Create new versions with `previous_version_uuid` instead of in-place updates.

### OSL Agent Implementation
```python
def create_concept(
    ...,
    previous_version_uuid: Optional[str] = None,
) -> str:
    # Create new concept
    if previous_version_uuid:
        # Create next_version edge
        version_edge = Edge(
            from_node=previous_version_uuid,
            to_node=concept.uuid,
            rel="next_version",
            ...
        )
```

### KnowShowGo JavaScript Implementation
```javascript
// Already implemented ✅
async createConcept({
  ...,
  previousVersionUuid = null
}) {
  // Create new concept
  if (previousVersionUuid) {
    const versionEdge = new Edge({
      fromNode: previousVersionUuid,
      toNode: concept.uuid,
      rel: 'next_version',
      ...
    });
  }
}
```

**Status**: ✅ Already implemented

---

## 9. Structured Logging Pattern

### Pattern
**Structured logging with event emission** - Log operations with structured data.

### OSL Agent Implementation
```python
# logging_setup.py
from src.personal_assistant.logging_setup import get_logger

log = get_logger("knowshowgo")
log.info("concept_created", uuid=concept_uuid, prototype=prototype_uuid)
```

### KnowShowGo JavaScript Implementation
```javascript
// To be added
import { getLogger } from './logging.js';

const log = getLogger('knowshowgo');
log.info('concept_created', { uuid: conceptUuid, prototype: prototypeUuid });
```

**Status**: ❌ Not implemented (should be added)

---

## 10. Service Layer Pattern (Optional - for Web Service)

### Pattern
**REST API service layer** - FastAPI service exposing HTTP endpoints.

### OSL Agent Implementation
```python
# service.py
from fastapi import FastAPI

app = FastAPI()

@app.post("/chat")
async def chat(request: ChatRequest):
    # Handle chat request
    return {"response": ...}
```

### KnowShowGo JavaScript Implementation (if making web service)
```javascript
// src/service/server.js (optional)
import express from 'express';

const app = express();

app.post('/concepts', async (req, res) => {
  // Create concept via API
});

app.get('/concepts/search', async (req, res) => {
  // Search concepts via API
});
```

**Status**: ❌ Not implemented (optional - only if making web service)

---

## Summary: What to Implement

### ✅ Already Implemented
1. Dependency injection pattern
2. Provenance tracking
3. Embedding function injection
4. Mock/test implementation (InMemoryMemory)
5. Versioned updates

### ⏳ Should Be Added
1. **Memory Interface** - Abstract interface for all memory backends
2. **ORM (Object Hydration)** - KSGORM for prototype-based object hydration
3. **Recursive Concept Creation** - Nested concept creation
4. **Structured Logging** - Logging setup with structured events
5. **Additional Memory Backends** - ArangoDB, ChromaDB implementations

### ❓ Optional (Only if Making Web Service)
1. **REST API Service Layer** - Express/Fastify service wrapper

---

## Implementation Priority

1. **High Priority** (Core functionality):
   - Memory Interface abstraction
   - ORM (object hydration)
   - Recursive concept creation

2. **Medium Priority** (Quality of life):
   - Structured logging
   - Additional memory backends

3. **Low Priority** (Optional):
   - REST API service layer (only if making web service)

