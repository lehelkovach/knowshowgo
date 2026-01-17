/**
 * KnowShowGo REST API Server
 * 
 * Provides HTTP endpoints for KnowShowGo operations.
 * Can be used by any client (Python, JavaScript, etc.)
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { KnowShowGo } from '../knowshowgo.js';
import { InMemoryMemory } from '../memory/in-memory.js';
import { ArangoMemory } from '../memory/arango-memory.js';
import { seedOslAgentPrototype } from '../seed/osl_agent.js';

// Initialize KnowShowGo with embedding function
// In production, this should use a real embedding service
const getEmbedFn = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';

  // If OPENAI_API_KEY is set, use OpenAI embeddings; otherwise fall back to a mock embedder.
  if (apiKey) {
    return async (text) => {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model,
          input: text
        })
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`OpenAI embeddings failed (${res.status}): ${body.slice(0, 400)}`);
      }

      const json = await res.json();
      const embedding = json?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) {
        throw new Error('OpenAI embeddings response missing embedding array');
      }
      return embedding;
    };
  }

  // Default: simple mock embedding (stable, fast, deterministic)
  return async (text) => {
    const vec = new Array(384).fill(0);
    for (let i = 0; i < Math.min(text.length, 384); i++) {
      vec[i] = text.charCodeAt(i) / 1000;
    }
    return vec;
  };
};

// Initialize memory backend
// Can be InMemory, ArangoDB, ChromaDB, etc.
const getMemory = () => {
  const backend = process.env.KSG_MEMORY_BACKEND || 'in-memory';
  
  if (backend === 'arango') {
    const config = {
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      database: process.env.ARANGO_DB || 'knowshowgo',
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASS || ''
    };
    return new ArangoMemory(config);
  }
  
  // Default: in-memory
  return new InMemoryMemory();
};

export function createKnowShowGoFromEnv() {
  return new KnowShowGo({
    embedFn: getEmbedFn(),
    memory: getMemory()
  });
}

export function createApp({ ksg }) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Static UI
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const webDir = path.resolve(__dirname, '../../web');
  app.use('/ui', express.static(webDir));

// Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'knowshowgo-api' });
  });

  // Seed endpoints (idempotent)
  app.post('/api/seed/osl-agent', async (_req, res) => {
    try {
      const report = await seedOslAgentPrototype(ksg);
      res.json({ ok: true, report });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

// ===== Prototype Endpoints =====

/**
 * POST /api/prototypes
 * Create a new prototype
 */
app.post('/api/prototypes', async (req, res) => {
  try {
    const { name, description, context, labels, embedding, parentPrototypeUuids } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const prototypeUuid = await ksg.createPrototype({
      name,
      description,
      context,
      labels: labels || [],
      embedding: embedding || await ksg.embedFn(name),
      parentPrototypeUuids: parentPrototypeUuids || null
    });

    res.json({ uuid: prototypeUuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/prototypes/:uuid
 * Get a prototype by UUID
 */
app.get('/api/prototypes/:uuid', async (req, res) => {
  try {
    const prototype = await ksg.getPrototype(req.params.uuid);
    if (!prototype) {
      return res.status(404).json({ error: 'Prototype not found' });
    }
    res.json(prototype);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Concept Endpoints =====

/**
 * POST /api/concepts
 * Create a new concept
 */
app.post('/api/concepts', async (req, res) => {
  try {
    const { prototypeUuid, jsonObj, embedding, previousVersionUuid } = req.body;
    
    if (!prototypeUuid) {
      return res.status(400).json({ error: 'prototypeUuid is required' });
    }
    if (!jsonObj) {
      return res.status(400).json({ error: 'jsonObj is required' });
    }

    const conceptUuid = await ksg.createConcept({
      prototypeUuid,
      jsonObj,
      embedding: embedding || await ksg.embedFn(jsonObj.name || JSON.stringify(jsonObj)),
      previousVersionUuid: previousVersionUuid || null
    });

    res.json({ uuid: conceptUuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/concepts/:uuid
 * Get a concept by UUID
 */
app.get('/api/concepts/:uuid', async (req, res) => {
  try {
    const concept = await ksg.getConcept(req.params.uuid);
    if (!concept) {
      return res.status(404).json({ error: 'Concept not found' });
    }
    res.json(concept);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/concepts/search
 * Search for concepts by semantic similarity
 */
app.post('/api/concepts/search', async (req, res) => {
  try {
    const { query, topK, similarityThreshold, prototypeFilter } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }

    const results = await ksg.searchConcepts({
      query,
      topK: topK || 10,
      similarityThreshold: similarityThreshold || 0.7,
      prototypeFilter: prototypeFilter || null
    });

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Association Endpoints =====

/**
 * POST /api/associations
 * Create an association between concepts
 */
app.post('/api/associations', async (req, res) => {
  try {
    const { fromConceptUuid, toConceptUuid, relationType, strength } = req.body;
    
    if (!fromConceptUuid || !toConceptUuid || !relationType) {
      return res.status(400).json({ error: 'fromConceptUuid, toConceptUuid, and relationType are required' });
    }

    await ksg.addAssociation({
      fromConceptUuid,
      toConceptUuid,
      relationType,
      strength: strength || 1.0
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/associations/:uuid
 * Get associations for a concept
 */
app.get('/api/associations/:uuid', async (req, res) => {
  try {
    const { direction } = req.query; // 'incoming', 'outgoing', or 'both' (default)
    const associations = await ksg.getAssociations(req.params.uuid, direction || 'both');
    res.json({ associations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Node with Document Endpoints =====

/**
 * POST /api/nodes
 * Create a node with document metadata and tags
 */
app.post('/api/nodes', async (req, res) => {
  try {
    const { label, summary, tags, metadata, associations, prototypeUuid } = req.body;
    
    if (!label) {
      return res.status(400).json({ error: 'label is required' });
    }

    const nodeUuid = await ksg.createNodeWithDocument({
      label,
      summary: summary || null,
      tags: tags || [],
      metadata: metadata || {},
      associations: associations || [],
      prototypeUuid: prototypeUuid || null
    });

    res.json({ uuid: nodeUuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Knode (Knowde/Knode) Endpoints =====
/**
 * POST /api/knodes
 * Create a "Knode" (a node with document metadata and tags).
 *
 * Body:
 * - label (string, required)
 * - summary (string, optional)
 * - tags (string[], optional)
 * - metadata (object, optional)
 * - associations (array, optional)
 * - prototypeUuid (string, optional)
 */
app.post('/api/knodes', async (req, res) => {
  try {
    const { label, summary, tags, metadata, associations, prototypeUuid } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'label is required' });
    }

    const uuid = await ksg.createNodeWithDocument({
      label,
      summary: summary || null,
      tags: tags || [],
      metadata: metadata || {},
      associations: associations || [],
      prototypeUuid: prototypeUuid || null
    });

    res.json({ uuid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Procedures (OSL-agent-prototype compatibility) =====
function hasCycle(edges, from, to) {
  // check if adding from->to creates a cycle by seeing if there's a path to 'from' from 'to'
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.fromNode)) adj.set(e.fromNode, []);
    adj.get(e.fromNode).push(e.toNode);
  }
  // include the new edge
  if (!adj.has(from)) adj.set(from, []);
  adj.get(from).push(to);

  const stack = [to];
  const seen = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const next = adj.get(cur) || [];
    for (const n of next) stack.push(n);
  }
  return false;
}

/**
 * POST /api/procedures
 * Create a Procedure + Step nodes with DAG dependencies.
 *
 * Body:
 * - title (string)
 * - description (string)
 * - steps (array of { title, payload?, tool?, order?, guard_text?, guard?, on_fail? })
 * - dependencies (array of [prereq_index, step_index]) // 0-based indices into steps
 */
app.post('/api/procedures', async (req, res) => {
  try {
    const { title, description, steps, dependencies, guards, extraProps } = req.body || {};
    if (!title || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'title and steps are required' });
    }
    const deps = Array.isArray(dependencies) ? dependencies : [];
    const g = guards || {};

    // Create procedure as a topic node (store logical kind in props for compatibility)
    const procUuid = await ksg.createNodeWithDocument({
      label: title,
      summary: description || '',
      tags: [`procedure:${title}`],
      metadata: { kind: 'Procedure', title, description, ...(extraProps || {}) }
    });

    // Create steps
    const stepUuids = [];
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i] || {};
      const stepTitle = s.title || `Step ${i + 1}`;
      const stepUuid = await ksg.createNodeWithDocument({
        label: stepTitle,
        summary: '',
        tags: [`step:${stepTitle}`],
        metadata: {
          kind: 'Step',
          title: stepTitle,
          payload: s.payload,
          tool: s.tool,
          order: s.order ?? i,
          guard_text: s.guard_text ?? g[i],
          guard: s.guard,
          on_fail: s.on_fail,
          procedure_uuid: procUuid
        }
      });
      stepUuids.push(stepUuid);
      await ksg.addAssociation({
        fromConceptUuid: procUuid,
        toConceptUuid: stepUuid,
        relationType: 'has_step',
        strength: 1.0,
        props: { order: i }
      });
    }

    // Dependency edges: step -> prereq (matches osl-agent-prototype ProcedureBuilder semantics)
    const existing = (await ksg.getAssociations(procUuid, 'both'))
      .filter(e => e.rel === 'depends_on' || e.rel === 'has_step');
    const depEdges = [];
    for (const [prereqIdx, stepIdx] of deps) {
      if (typeof prereqIdx !== 'number' || typeof stepIdx !== 'number') {
        return res.status(400).json({ error: 'dependencies must be [prereq_index, step_index] pairs' });
      }
      if (prereqIdx < 0 || prereqIdx >= stepUuids.length || stepIdx < 0 || stepIdx >= stepUuids.length) {
        return res.status(400).json({ error: 'dependency index out of range' });
      }
      const prereq = stepUuids[prereqIdx];
      const step = stepUuids[stepIdx];
      depEdges.push({ fromNode: step, toNode: prereq });
    }
    // cycle check on step dependency graph
    for (const e of depEdges) {
      const graphEdges = [
        ...existing.filter(x => x.rel === 'depends_on').map(x => ({ fromNode: x.fromNode, toNode: x.toNode })),
        ...depEdges
      ];
      if (hasCycle(graphEdges, e.fromNode, e.toNode)) {
        return res.status(400).json({ error: 'cycle_detected' });
      }
    }

    for (const e of depEdges) {
      await ksg.addAssociation({
        fromConceptUuid: e.fromNode,
        toConceptUuid: e.toNode,
        relationType: 'depends_on',
        strength: 1.0
      });
    }

    res.json({ procedure_uuid: procUuid, step_uuids: stepUuids });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/procedures/search
 * Body: { query, topK? }
 */
app.post('/api/procedures/search', async (req, res) => {
  try {
    const { query, topK } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });
    const results = await ksg.searchConcepts({ query, topK: topK || 5 });
    const filtered = results.filter(r => r?.props?.kind === 'Procedure' || r?.props?.isProcedure === true);
    res.json({ results: filtered });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/nodes/:uuid/embedding
 * Update/recompute node embedding
 */
app.post('/api/nodes/:uuid/embedding', async (req, res) => {
  try {
    await ksg.updateNodeEmbedding(req.params.uuid);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ORM Endpoints =====

/**
 * POST /api/orm/register
 * Register a prototype for ORM use
 */
app.post('/api/orm/register', async (req, res) => {
  try {
    const { prototypeName, options } = req.body;
    
    if (!prototypeName) {
      return res.status(400).json({ error: 'prototypeName is required' });
    }

    await ksg.orm.registerPrototype(prototypeName, options || {});
    res.json({ success: true, prototypeName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/orm/:prototypeName/create
 * Create a concept instance via ORM
 */
app.post('/api/orm/:prototypeName/create', async (req, res) => {
  try {
    const { prototypeName } = req.params;
    const { properties } = req.body;
    
    if (!properties) {
      return res.status(400).json({ error: 'properties are required' });
    }

    const Model = await ksg.orm.getModel(prototypeName);
    if (!Model) {
      return res.status(404).json({ error: `Prototype ${prototypeName} not registered` });
    }

    const instance = await Model.create(properties);
    res.json(await instance.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/orm/:prototypeName/:uuid
 * Get a concept instance via ORM
 */
app.get('/api/orm/:prototypeName/:uuid', async (req, res) => {
  try {
    const { prototypeName, uuid } = req.params;
    
    const Model = await ksg.orm.getModel(prototypeName);
    if (!Model) {
      return res.status(404).json({ error: `Prototype ${prototypeName} not registered` });
    }

    const instance = await Model.get(uuid);
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    res.json(await instance.toJSON());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Assertion Endpoints (v0.2.0) =====

/**
 * POST /api/assertions
 * Create a new assertion
 */
app.post('/api/assertions', async (req, res) => {
  try {
    const { subject, predicate, object, truth, source } = req.body;
    
    if (!subject) {
      return res.status(400).json({ error: 'subject is required' });
    }
    if (!predicate) {
      return res.status(400).json({ error: 'predicate is required' });
    }
    if (object === undefined) {
      return res.status(400).json({ error: 'object is required' });
    }

    const assertion = await ksg.createAssertion({
      subject,
      predicate,
      object,
      truth: truth ?? 1.0,
      source: source || 'user'
    });

    res.json(assertion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/assertions
 * Query assertions with optional filters
 * Query params: subject, predicate, object
 */
app.get('/api/assertions', async (req, res) => {
  try {
    const { subject, predicate, object } = req.query;
    const filters = {};
    
    if (subject) filters.subject = subject;
    if (predicate) filters.predicate = predicate;
    if (object !== undefined) filters.object = object;

    const assertions = await ksg.getAssertions(filters);
    res.json({ assertions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/entities/:id/snapshot
 * Get resolved values for an entity (highest truth wins)
 */
app.get('/api/entities/:id/snapshot', async (req, res) => {
  try {
    const snapshot = await ksg.snapshot(req.params.id);
    res.json({ snapshot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/entities/:id/evidence
 * Get all competing assertions for an entity
 * Query params: predicate (optional)
 */
app.get('/api/entities/:id/evidence', async (req, res) => {
  try {
    const { predicate } = req.query;
    const evidence = await ksg.evidence(req.params.id, predicate || null);
    res.json({ evidence });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== Verification / Hallucination Detection Endpoints =====

/**
 * POST /api/facts
 * Store a verified fact (for hallucination detection ground truth)
 */
app.post('/api/facts', async (req, res) => {
  try {
    const { subject, predicate, object, status, confidence, source } = req.body;
    
    if (!subject || !predicate || !object) {
      return res.status(400).json({ error: 'subject, predicate, and object are required' });
    }
    
    const fact = await ksg.storeFact({
      subject,
      predicate,
      object,
      status: status || 'verified',
      confidence: confidence ?? 1.0,
      source: source || null
    });
    
    res.json(fact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/facts/bulk
 * Store multiple verified facts at once
 */
app.post('/api/facts/bulk', async (req, res) => {
  try {
    const { facts } = req.body;
    
    if (!Array.isArray(facts)) {
      return res.status(400).json({ error: 'facts array is required' });
    }
    
    const results = [];
    for (const f of facts) {
      if (!f.subject || !f.predicate || !f.object) continue;
      
      const fact = await ksg.storeFact({
        subject: f.subject,
        predicate: f.predicate,
        object: f.object,
        status: f.status || 'verified',
        confidence: f.confidence ?? 1.0,
        source: f.source || null
      });
      results.push(fact);
    }
    
    res.json({ stored: results.length, facts: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/verify
 * Verify a claim against stored facts (hallucination detection)
 */
app.post('/api/verify', async (req, res) => {
  try {
    const { claim, threshold } = req.body;
    
    if (!claim) {
      return res.status(400).json({ error: 'claim is required' });
    }
    
    const result = await ksg.verify(claim, { threshold: threshold ?? 0.7 });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/facts/stats
 * Get statistics about stored facts
 */
app.get('/api/facts/stats', async (req, res) => {
  try {
    const stats = await ksg.getFactStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

  return app;
}

// Default runtime instance
const ksg = createKnowShowGoFromEnv();
const app = createApp({ ksg });

const PORT = process.env.PORT || 3000;

if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log(`KnowShowGo REST API server running on port ${PORT}`);
    console.log(`Memory backend: ${process.env.KSG_MEMORY_BACKEND || 'in-memory'}`);
  });
}

export { app, ksg };

