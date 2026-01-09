/**
 * ArangoDB Memory Backend for KnowShowGo
 * 
 * Stores nodes and edges in ArangoDB graph database.
 */

import { aql, Database } from 'arangojs';

export class ArangoMemory {
  constructor(config) {
    this.config = {
      url: config.url || 'http://localhost:8529',
      database: config.database || 'knowshowgo',
      username: config.username || 'root',
      password: config.password || ''
    };
    this.db = null;
    this.nodesCollection = null;
    this.edgesCollection = null;
  }

  async connect() {
    if (this.db) {
      return;
    }

    this.db = new Database({
      url: this.config.url,
      auth: {
        username: this.config.username,
        password: this.config.password
      }
    });

    // Use database
    this.db.useDatabase(this.config.database);

    // Get or create collections
    this.nodesCollection = this.db.collection('nodes');
    this.edgesCollection = this.db.collection('edges');

    // Ensure collections exist
    try {
      await this.nodesCollection.get();
    } catch (err) {
      await this.db.createCollection('nodes');
      this.nodesCollection = this.db.collection('nodes');
    }

    try {
      await this.edgesCollection.get();
    } catch (err) {
      await this.db.createCollection('edges');
      this.edgesCollection = this.db.collection('edges');
    }

    // Create indexes
    await this.nodesCollection.ensureIndex({
      type: 'persistent',
      fields: ['uuid'],
      unique: true
    });
    await this.nodesCollection.ensureIndex({
      type: 'persistent',
      fields: ['kind']
    });
    await this.edgesCollection.ensureIndex({
      type: 'persistent',
      fields: ['fromNode']
    });
    await this.edgesCollection.ensureIndex({
      type: 'persistent',
      fields: ['toNode']
    });
  }

  async upsert(nodeOrEdge, provenance, options = {}) {
    await this.connect();

    const doc = {
      ...nodeOrEdge,
      _key: nodeOrEdge.uuid.replace(/-/g, ''),
      provenance: provenance || null,
      updatedAt: new Date().toISOString()
    };

    if (nodeOrEdge.kind === 'topic' && !nodeOrEdge.fromNode) {
      // It's a node
      await this.nodesCollection.save(doc, { overwrite: true });
    } else {
      // It's an edge
      doc._from = `nodes/${doc.fromNode.replace(/-/g, '')}`;
      doc._to = `nodes/${doc.toNode.replace(/-/g, '')}`;
      await this.edgesCollection.save(doc, { overwrite: true });
    }
  }

  async getNode(uuid) {
    await this.connect();
    try {
      const doc = await this.nodesCollection.document(uuid.replace(/-/g, ''));
      const { _key, _id, _rev, _from, _to, ...node } = doc;
      return node;
    } catch (err) {
      return null;
    }
  }

  async getEdge(fromNode, toNode, rel) {
    await this.connect();
    const cursor = await this.db.query(aql`
      FOR edge IN edges
        FILTER edge.fromNode == ${fromNode}
        FILTER edge.toNode == ${toNode}
        FILTER edge.rel == ${rel}
        RETURN edge
    `);
    const edges = await cursor.all();
    return edges.length > 0 ? edges[0] : null;
  }

  async searchNodes(queryEmbedding, topK, filters = {}) {
    await this.connect();
    
    // Simple vector search (in production, use ArangoDB vector search or external service)
    // For now, return all nodes and let caller filter
    const cursor = await this.db.query(aql`
      FOR node IN nodes
        RETURN node
    `);
    const nodes = await cursor.all();
    
    // Remove ArangoDB metadata
    return nodes.map(n => {
      const { _key, _id, _rev, ...node } = n;
      return node;
    });
  }

  get nodes() {
    // Return a proxy that queries ArangoDB on access
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'values') {
          return async () => {
            await this.connect();
            const cursor = await this.db.query(aql`FOR node IN nodes RETURN node`);
            const nodes = await cursor.all();
            return nodes.map(n => {
              const { _key, _id, _rev, ...node } = n;
              return node;
            });
          };
        }
        return undefined;
      }
    });
  }

  get edges() {
    // Return a proxy that queries ArangoDB on access
    return new Proxy({}, {
      get: (target, prop) => {
        if (prop === 'values') {
          return async () => {
            await this.connect();
            const cursor = await this.db.query(aql`FOR edge IN edges RETURN edge`);
            const edges = await cursor.all();
            return edges.map(e => {
              const { _key, _id, _rev, _from, _to, ...edge } = e;
              return edge;
            });
          };
        }
        return undefined;
      }
    });
  }
}

