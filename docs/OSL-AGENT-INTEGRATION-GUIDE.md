# OSL-Agent-Prototype Integration Guide

**Purpose:** Guide for refactoring osl-agent-prototype to use KnowShowGo as an external service.

**Status:** osl-agent-prototype has working implementations of cognitive primitives that are AHEAD of the JS knowshowgo service. This document outlines the migration strategy.

---

## 0. IMPORTANT: Existing Work in osl-agent-prototype Branches

**The integration work is already partially complete** in osl-agent-prototype branches:

### Branch: `archived/knowshowgo-service` ✅ READY TO USE

This branch contains **production-ready** integration code:

| File | Description | Status |
|------|-------------|--------|
| `services/knowshowgo/service.py` | FastAPI KnowShowGo service | ✅ Complete |
| `services/knowshowgo/client.py` | Python HTTP client + MockClient | ✅ Complete |
| `services/knowshowgo/models.py` | Pydantic request/response models | ✅ Complete |
| `src/personal_assistant/knowshowgo_adapter.py` | Embedded vs Remote adapter | ✅ Complete |

**Key Features Already Implemented:**
- Health check endpoint
- Create/get concepts
- Search with embeddings
- Upsert nodes/edges
- Store/match form patterns
- List prototypes
- Mock client for testing
- Auto-fallback from remote to embedded

**To use this existing work:**
```bash
cd osl-agent-prototype
git checkout archived/knowshowgo-service
# Or cherry-pick the relevant files to main
```

### Branch: `cursor/knowshowgo-repo-push-c83c`

Contains:
- `HANDOFF-KNOWSHOWGO-SERVICE.txt` - Detailed guide for creating standalone service
- `docs/queue-knowshowgo-integration.md` - Queue items as KnowShowGo concepts

**Recommendation:** The `archived/knowshowgo-service` branch has all the Python client/adapter code you need. Merge or cherry-pick that first before building new integrations.

---

## 1. Current State Analysis

### osl-agent-prototype Has (Python) ✅

| Component | File | Status |
|-----------|------|--------|
| `WorkingMemoryGraph` | `working_memory.py` | ✅ Full implementation |
| `AsyncReplicator` | `async_replicator.py` | ✅ Full implementation |
| `DeterministicParser` | `deterministic_parser.py` | ✅ Full implementation |
| `DAGExecutor` | `dag_executor.py` | ✅ Full implementation |
| `KnowShowGoAPI` | `knowshowgo.py` | ✅ Full implementation |
| `KSGORM` | `ksg_orm.py` | ✅ Full implementation |
| Memory backends | `arango_memory.py`, `networkx_memory.py` | ✅ Working |

### knowshowgo-js Has (JavaScript) ✅

| Component | File | Status |
|-----------|------|--------|
| `KnowShowGo` | `src/knowshowgo.js` | ✅ Working |
| `KSGORM` | `src/orm/ksg-orm.js` | ✅ Working |
| Memory backends | `src/memory/in-memory.js`, `arango-memory.js` | ✅ Working |
| REST API | `src/server/rest-api.js` | ✅ Working |
| **Assertion model** | planned | ❌ Not yet |
| **WTAResolver** | planned | ❌ Not yet |
| **WorkingMemoryGraph** | planned | ❌ Not yet |

### Gap Analysis

**osl-agent-prototype is AHEAD** in cognitive primitives:
- Has WorkingMemoryGraph, AsyncReplicator, DAGExecutor
- Has deterministic parsing (no LLM needed)

**knowshowgo-js is AHEAD** in:
- REST API service
- Docker deployment
- Planning docs (WTA, NeuroDAG, GraphRAG)

---

## 2. Recommended Architecture

### Option A: KnowShowGo as Microservice (Recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│                     osl-agent-prototype                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Agent.py   │  │ DAGExecutor  │  │ LearningEngine│          │
│  │  (main loop) │  │              │  │               │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                  │                   │
│         └─────────────────┼──────────────────┘                   │
│                           │                                      │
│                           ▼                                      │
│              ┌────────────────────────┐                         │
│              │  KnowShowGoClient      │  ← Python REST client   │
│              │  (api/python/client.py)│                         │
│              └────────────────────────┘                         │
│                           │                                      │
└───────────────────────────┼──────────────────────────────────────┘
                            │ HTTP/REST
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      knowshowgo-js                               │
│                    (this repository)                             │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  REST API    │  │  KnowShowGo  │  │   Memory     │          │
│  │  :3000       │  │    Core      │  │  (Arango)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

### Option B: Hybrid (Keep WorkingMemory Local)

```
osl-agent-prototype
├── WorkingMemoryGraph (local, session-scoped) ← Keep in Python
├── AsyncReplicator (local) ← Syncs to knowshowgo
└── KnowShowGoClient (remote) ← For semantic memory
```

**Rationale:** WorkingMemory is session-scoped and latency-sensitive. Keep it local, sync deltas to knowshowgo in background.

---

## 3. Migration Steps

### Step 1: Add KnowShowGo Python Client

Copy or install the Python client:

```bash
# In osl-agent-prototype
cp /path/to/knowshowgo/api/python/client.py src/personal_assistant/knowshowgo_client.py
```

Or create a minimal client:

```python
# src/personal_assistant/knowshowgo_client.py

import httpx
from typing import Dict, Any, List, Optional

class KnowShowGoClient:
    """REST client for KnowShowGo service."""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(base_url=self.base_url)
    
    async def create_prototype(
        self,
        name: str,
        description: str,
        labels: List[str] = None,
        **kwargs
    ) -> str:
        resp = await self.client.post("/api/prototypes", json={
            "name": name,
            "description": description,
            "labels": labels or [],
            **kwargs
        })
        resp.raise_for_status()
        return resp.json()["uuid"]
    
    async def create_concept(
        self,
        prototype_uuid: str,
        json_obj: Dict[str, Any],
        **kwargs
    ) -> str:
        resp = await self.client.post("/api/concepts", json={
            "prototypeUuid": prototype_uuid,
            "jsonObj": json_obj,
            **kwargs
        })
        resp.raise_for_status()
        return resp.json()["uuid"]
    
    async def search_concepts(
        self,
        query: str,
        top_k: int = 10,
        **kwargs
    ) -> List[Dict]:
        resp = await self.client.post("/api/concepts/search", json={
            "query": query,
            "topK": top_k,
            **kwargs
        })
        resp.raise_for_status()
        return resp.json()["results"]
    
    async def create_assertion(
        self,
        subject: str,
        predicate: str,
        object: Any,
        truth: float = 1.0,
        strength: float = 1.0,
        **kwargs
    ) -> str:
        """Create assertion (when knowshowgo implements this)."""
        resp = await self.client.post("/api/assertions", json={
            "subject": subject,
            "predicate": predicate,
            "object": object,
            "truth": truth,
            "strength": strength,
            **kwargs
        })
        resp.raise_for_status()
        return resp.json()["uuid"]
    
    async def get_snapshot(self, entity_uuid: str) -> Dict:
        """Get WTA-resolved snapshot (when knowshowgo implements this)."""
        resp = await self.client.get(f"/api/entities/{entity_uuid}/snapshot")
        resp.raise_for_status()
        return resp.json()
    
    async def get_evidence(self, entity_uuid: str) -> List[Dict]:
        """Get all assertions for entity (when knowshowgo implements this)."""
        resp = await self.client.get(f"/api/entities/{entity_uuid}/evidence")
        resp.raise_for_status()
        return resp.json()["assertions"]
    
    async def close(self):
        await self.client.aclose()
```

### Step 2: Use Existing Adapter (from `archived/knowshowgo-service` branch)

**IMPORTANT:** An adapter already exists! Get it from the branch:

```bash
git show archived/knowshowgo-service:src/personal_assistant/knowshowgo_adapter.py > src/personal_assistant/knowshowgo_adapter.py
```

The existing `KnowShowGoAdapter` includes:
- Auto-detection of service vs embedded mode via `KNOWSHOWGO_URL` env var
- Fallback from remote to embedded if service unavailable
- Mock client support for testing
- Unified interface for `create_concept`, `search`, `upsert`, etc.

**Key usage pattern:**

```python
from src.personal_assistant.knowshowgo_adapter import KnowShowGoAdapter

# Auto-selects backend based on KNOWSHOWGO_URL env var
adapter = KnowShowGoAdapter.create(memory=memory, embed_fn=embed_fn)

# Works the same whether embedded or remote
uuid = adapter.create_concept(prototype_uuid, json_obj)
results = adapter.search(query, top_k=10)
```

If you need a hybrid adapter with local WorkingMemory, extend the existing one:

```python
# src/personal_assistant/knowshowgo_hybrid_adapter.py

from src.personal_assistant.knowshowgo_adapter import KnowShowGoAdapter
from src.personal_assistant.working_memory import WorkingMemoryGraph
from src.personal_assistant.async_replicator import AsyncReplicator

class KnowShowGoHybridAdapter(KnowShowGoAdapter):
    """
    Extends KnowShowGoAdapter with:
    - Local WorkingMemory (session activation)
    - AsyncReplicator (background sync)
    """
    
    def __init__(self, working_memory=None, replicator=None, **kwargs):
        super().__init__(**kwargs)
        self.wm = working_memory or WorkingMemoryGraph()
        self.replicator = replicator
    
    def search_with_activation(
        self,
        query: str,
        top_k: int = 10,
        activation_boost: float = 0.1
    ) -> list:
        """Search with working memory activation boost."""
        results = self.search(query, top_k=top_k * 2)
        
        # Apply activation boost from working memory
        boosted = []
        for r in results:
            uuid = r.get("uuid")
            boost = self.wm.get_activation(uuid) if hasattr(self.wm, 'get_activation') else 0.0
            score = r.get("score", 0.5) + (boost * activation_boost)
            boosted.append({**r, "score": score, "activation_boost": boost})
        
        # Re-sort by boosted score
        boosted.sort(key=lambda x: x["score"], reverse=True)
        return boosted[:top_k]
    
    def reinforce(self, source_uuid: str, target_uuid: str):
        """Reinforce local working memory link."""
        self.wm.link(source_uuid, target_uuid)
        
        # Optionally sync to remote via replicator
        if self.replicator:
            self.replicator.enqueue({
                "source": source_uuid,
                "target": target_uuid,
                "delta": 1.0,
                "max_weight": 100.0
            })
```

### Step 3: Update Agent to Use Adapter

```python
# In agent.py

from src.personal_assistant.knowshowgo_adapter import KnowShowGoAdapter

class Agent:
    def __init__(self, ksg_url: str = "http://localhost:3000"):
        self.ksg = KnowShowGoAdapter(ksg_url)
        # ... rest of init
    
    async def process_instruction(self, instruction: str):
        # Use remote KnowShowGo for semantic search
        results = await self.ksg.search_with_activation(instruction)
        
        # Local working memory for session state
        if results:
            self.ksg.reinforce(self.current_context_uuid, results[0]["uuid"])
        
        # ... rest of processing
```

---

## 4. What to Keep Local vs Remote

### Keep Local (in osl-agent-prototype)

| Component | Reason |
|-----------|--------|
| `WorkingMemoryGraph` | Session-scoped, latency-sensitive |
| `AsyncReplicator` | Background sync, doesn't block agent |
| `DeterministicParser` | Fast, no network needed |
| `DAGExecutor` | Execution logic, uses local state |
| `Agent` main loop | Orchestration |

### Move to Remote (knowshowgo service)

| Component | Reason |
|-----------|--------|
| Semantic memory (concepts, prototypes) | Shared, persistent |
| Assertions | Shared truth with provenance |
| WTA Resolution | Canonical snapshots |
| Search | Vector search, ArangoDB |

---

## 5. Environment Configuration

```bash
# .env in osl-agent-prototype

# KnowShowGo Service
KNOWSHOWGO_URL=http://localhost:3000
# Or for production:
# KNOWSHOWGO_URL=https://knowshowgo.example.com

# Local options (for hybrid mode)
USE_LOCAL_WORKING_MEMORY=true
WORKING_MEMORY_DECAY_RATE=0.9
REPLICATOR_QUEUE_SIZE=1000
```

---

## 6. Docker Compose (Full Stack)

```yaml
# docker-compose.yml for running both services

version: '3.8'

services:
  arangodb:
    image: arangodb:3.11
    environment:
      ARANGO_ROOT_PASSWORD: changeme
    ports:
      - "8529:8529"
    volumes:
      - arango_data:/var/lib/arangodb3

  knowshowgo:
    build: ./knowshowgo
    ports:
      - "3000:3000"
    environment:
      KSG_MEMORY_BACKEND: arango
      ARANGO_URL: http://arangodb:8529
      ARANGO_DB: knowshowgo
      ARANGO_USER: root
      ARANGO_PASS: changeme
    depends_on:
      - arangodb

  osl-agent:
    build: ./osl-agent-prototype
    environment:
      KNOWSHOWGO_URL: http://knowshowgo:3000
      USE_LOCAL_WORKING_MEMORY: "true"
    depends_on:
      - knowshowgo

volumes:
  arango_data:
```

---

## 7. Feature Parity Checklist

Before full migration, ensure knowshowgo-js implements:

### Required for MVP ❌

| Feature | osl-agent-prototype | knowshowgo-js |
|---------|--------------------|--------------| 
| Create prototype | ✅ | ✅ |
| Create concept | ✅ | ✅ |
| Search concepts | ✅ | ✅ |
| Associations | ✅ | ✅ |
| **Assertions** | ❌ | ❌ Planned |
| **Snapshot/Evidence** | ❌ | ❌ Planned |
| **WTA Resolution** | ❌ | ❌ Planned |

### Keep in osl-agent-prototype ✅

| Feature | Status |
|---------|--------|
| WorkingMemoryGraph | ✅ Keep local |
| AsyncReplicator | ✅ Keep local |
| DeterministicParser | ✅ Keep local |
| DAGExecutor | ✅ Keep local |
| LearningEngine | ✅ Keep local |

---

## 8. Migration Timeline

### Phase 1: Use Existing Work (NOW - Start Here)
- **Merge `archived/knowshowgo-service` branch** to main in osl-agent-prototype
- This gives you: FastAPI service, Python client, adapter layer
- Test with `USE_KNOWSHOWGO_SERVICE=false` (embedded mode)

### Phase 2: Deploy knowshowgo-js Service
- Run knowshowgo-js via Docker or standalone
- Set `KNOWSHOWGO_URL=http://localhost:3000` in osl-agent-prototype
- Adapter auto-switches to remote mode

### Phase 3: Hybrid Mode with WorkingMemory
- Extend adapter with `KnowShowGoHybridAdapter` (see Step 2)
- Keep WorkingMemory local for session state
- Sync deltas via AsyncReplicator

### Phase 4: Full Integration
- knowshowgo-js implements Assertions, WTA, NeuroDAG
- osl-agent uses snapshot/evidence APIs
- Shared truth across multiple agents

---

## 9. Code to Port from osl-agent-prototype to knowshowgo-js

These Python files should be ported to JavaScript:

| Python File | Target JS File | Priority |
|-------------|----------------|----------|
| `working_memory.py` | `src/memory/working-memory.js` | 🔴 High |
| `async_replicator.py` | `src/memory/async-replicator.js` | 🟡 Medium |
| `deterministic_parser.py` | `src/inference/deterministic-parser.js` | 🟢 Low |

**Note:** The Python implementations are production-ready and can serve as reference for the JS ports.

---

*Document created: 2026-01-14*
*For: osl-agent-prototype developer agents*
*Integration target: knowshowgo-js service*
