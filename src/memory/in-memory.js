/**
 * In-memory memory backend for testing and development
 */

import { Node, Edge, Provenance } from '../models.js';

export class InMemoryMemory {
  constructor() {
    this.nodes = new Map(); // uuid -> Node
    this.edges = new Map(); // uuid -> Edge
  }

  /**
   * Upsert a node or edge
   * 
   * @param {Node|Edge} item - Node or Edge to upsert
   * @param {Provenance} provenance - Provenance info
   * @param {Object} options - Options (embeddingRequest, etc.)
   */
  async upsert(item, provenance, options = {}) {
    if (item instanceof Node) {
      this.nodes.set(item.uuid, item);
    } else if (item instanceof Edge) {
      this.edges.set(item.uuid, item);
    }
  }

  /**
   * Search for nodes by query
   * 
   * @param {Object} params
   * @param {string} params.query - Search query
   * @param {number} params.topK - Maximum results
   * @param {Object} params.filters - Filter criteria
   * @param {number[]} [params.queryEmbedding] - Query embedding vector
   * @returns {Promise<Array>} Search results
   */
  async search({ query, topK, filters = {}, queryEmbedding = null }) {
    let results = Array.from(this.nodes.values());

    // Apply filters
    if (filters.kind) {
      results = results.filter(n => n.kind === filters.kind);
    }

    // Simple similarity if embedding provided
    if (queryEmbedding && results.length > 0) {
      results = results
        .map(node => {
          if (!node.llmEmbedding) {
            return { node, similarity: 0 };
          }
          const similarity = this._cosineSimilarity(queryEmbedding, node.llmEmbedding);
          return { node, similarity };
        })
        .filter(r => r.similarity >= 0) // Filter out nodes without embeddings
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .map(r => ({
          uuid: r.node.uuid,
          name: r.node.props.label || r.node.props.name,
          props: r.node.props,
          similarity: r.similarity
        }));
    } else {
      // Simple text matching
      results = results
        .filter(n => {
          const label = n.props.label || n.props.name || '';
          return label.toLowerCase().includes(query.toLowerCase());
        })
        .slice(0, topK)
        .map(n => ({
          uuid: n.uuid,
          name: n.props.label || n.props.name,
          props: n.props,
          similarity: 0.5 // Default similarity for text match
        }));
    }

    return results;
  }

  /**
   * Get a node by UUID
   * 
   * @param {string} uuid - Node UUID
   * @returns {Promise<Node|null>} Node or null
   */
  async getNode(uuid) {
    return this.nodes.get(uuid) || null;
  }

  /**
   * Calculate cosine similarity between two vectors
   * 
   * @private
   */
  _cosineSimilarity(a, b) {
    if (a.length !== b.length) {
      return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

