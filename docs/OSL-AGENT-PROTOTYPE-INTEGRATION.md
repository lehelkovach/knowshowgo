# OSL Agent Prototype Integration Guide

This repository can act as the **central KnowShowGo (KSG) service** for `lehelkovach/osl-agent-prototype`.

## What the agent expects (high-level)

In `osl-agent-prototype`, the KSG layer seeds a minimal ontology/prototype set for:
- procedural memory: **Procedure / Step / Trigger**
- tasking: **Task / QueueItem / Queue**
- tagging: **Tag**
- plus basic entity prototypes (Person/Place/Thing/etc.)

This repo provides an idempotent seed for those.

## Required steps

1) Start KnowShowGo (locally or deployed):

```bash
npm install
npm start
```

2) Seed the ontology (idempotent):

```bash
curl -sS -X POST http://localhost:3000/api/seed/osl-agent
```

## Endpoints you can rely on

### Health
- `GET /health`

### Seed
- `POST /api/seed/osl-agent`

### Prototypes + Concepts
- `POST /api/prototypes`
- `GET /api/prototypes/:uuid`
- `POST /api/concepts`
- `GET /api/concepts/:uuid`
- `POST /api/concepts/search`

### Associations
- `POST /api/associations`
- `GET /api/associations/:uuid?direction=incoming|outgoing|both`

### Procedures (DAG-ish)
Mirrors the `ProcedureBuilder` pattern used in the agent:
- `POST /api/procedures` (Procedure + Steps + `depends_on` edges; rejects cycles)
- `POST /api/procedures/search`

### Knodes (node+document+tags)
- `POST /api/knodes`
- UI: `GET /ui/`

## Environment variables (service side)

For Arango persistence (recommended for a deployed pillar):

```bash
PORT=3000
KSG_MEMORY_BACKEND=arango
ARANGO_URL=http://localhost:8529
ARANGO_DB=knowshowgo
ARANGO_USER=root
ARANGO_PASS=changeme
```

## What’s next for tighter integration

If you want the agent to talk to this service “as if it were its internal KSG module”, the next step is to add a small **Python REST client** that mirrors the method names in `osl-agent-prototype` (`create_prototype`, `create_concept`, `search_concepts`, procedure create/search).

