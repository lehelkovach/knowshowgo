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

// Initialize KnowShowGo with embedding function
// In production, this should use a real embedding service
const getEmbedFn = () => {
  // Default: simple mock embedding
  // Replace with your embedding service (OpenAI, local, etc.)
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

