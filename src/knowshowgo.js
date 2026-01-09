/**
 * KnowShowGo API - A fuzzy ontology knowledge graph
 * 
 * KnowShowGo functions as a fuzzy ontology knowledge graph where:
 * - Concepts have embeddings for similarity-based matching (fuzzy, not exact)
 * - Relationships have confidence/strength scores (degrees of membership)
 * - Embedding-based similarity provides the "fuzziness" (partial matches)
 * - Supports uncertainty handling via provenance confidence scores
 */

import { Node, Edge, Provenance } from './models.js';

export class KnowShowGo {
  /**
   * @param {Object} options
   * @param {Function} options.embedFn - Async function(text: string) => Promise<number[]>
   * @param {Object} options.memory - Memory backend (must implement MemoryTools interface)
   */
  constructor({ embedFn, memory }) {
    if (!embedFn) {
      throw new Error('embedFn is required');
    }
    if (!memory) {
      throw new Error('memory is required');
    }
    this.embedFn = embedFn;
    this.memory = memory;
  }

  /**
   * Create a Prototype (Topic with isPrototype=true).
   * 
   * Prototypes define schemas/templates. They are immutable but versioned.
   * 
   * @param {Object} params
   * @param {string} params.name - Prototype name
   * @param {string} params.description - Prototype description
   * @param {string} params.context - Additional context
   * @param {string[]} [params.labels] - Labels/aliases
   * @param {number[]} params.embedding - Vector embedding
   * @param {Provenance} [params.provenance] - Provenance info
   * @param {string} [params.basePrototypeUuid] - Parent prototype UUID (inheritance)
   * @returns {Promise<string>} Prototype UUID
   */
  async createPrototype({
    name,
    description,
    context,
    labels = [],
    embedding,
    provenance = null,
    basePrototypeUuid = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    const aliases = labels.length > 0 ? labels : [name];
    if (!aliases.includes(name)) {
      aliases.unshift(name);
    }

    const proto = new Node({
      kind: 'topic',
      labels: aliases,
      props: {
        label: name,
        aliases: aliases.slice(1),
        summary: description,
        isPrototype: true,
        status: 'active',
        namespace: 'public',
        context: context,
        name: name,
        description: description
      },
      llmEmbedding: embedding
    });

    await this.memory.upsert(proto, prov, { embeddingRequest: true });

    if (basePrototypeUuid) {
      // Use inherits edge (Knowshowgo design)
      const edge = new Edge({
        fromNode: proto.uuid,
        toNode: basePrototypeUuid,
        rel: 'inherits',
        props: {
          child: name,
          parentUuid: basePrototypeUuid,
          w: 1.0,
          status: 'accepted'
        }
      });
      await this.memory.upsert(edge, prov, { embeddingRequest: false });
    }

    return proto.uuid;
  }

  /**
   * Create a Concept (Topic with isPrototype=false).
   * 
   * Concepts are instances following prototype schemas.
   * 
   * @param {Object} params
   * @param {string} params.prototypeUuid - Prototype UUID
   * @param {Object} params.jsonObj - Concept data
   * @param {number[]} params.embedding - Vector embedding
   * @param {Provenance} [params.provenance] - Provenance info
   * @param {string} [params.previousVersionUuid] - Previous version UUID (for versioning)
   * @returns {Promise<string>} Concept UUID
   */
  async createConcept({
    prototypeUuid,
    jsonObj,
    embedding,
    provenance = null,
    previousVersionUuid = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    const label = jsonObj.name || jsonObj.label || 'concept';
    const aliases = jsonObj.aliases || [];
    if (!aliases.includes(label)) {
      aliases.unshift(label);
    }

    const concept = new Node({
      kind: 'topic',
      labels: aliases,
      props: {
        label: label,
        aliases: aliases.slice(1),
        summary: jsonObj.description || jsonObj.summary || '',
        isPrototype: false,
        status: 'active',
        namespace: 'public',
        prototypeUuid: prototypeUuid, // Backward compat
        ...Object.fromEntries(
          Object.entries(jsonObj).filter(([k]) => 
            !['name', 'label', 'aliases', 'description', 'summary'].includes(k)
          )
        )
      },
      llmEmbedding: embedding
    });

    await this.memory.upsert(concept, prov, { embeddingRequest: true });

    // Create instanceOf association
    await this.addAssociation({
      fromConceptUuid: concept.uuid,
      toConceptUuid: prototypeUuid,
      relationType: 'instanceOf',
      strength: 1.0,
      provenance: prov
    });

    if (previousVersionUuid) {
      // Version chain edge
      const versionEdge = new Edge({
        fromNode: previousVersionUuid,
        toNode: concept.uuid,
        rel: 'next_version',
        props: {
          prototypeUuid: prototypeUuid,
          w: 1.0,
          status: 'accepted'
        }
      });
      await this.memory.upsert(versionEdge, prov, { embeddingRequest: false });
    }

    return concept.uuid;
  }

  /**
   * Add an association between two concepts.
   * 
   * @param {Object} params
   * @param {string} params.fromConceptUuid - Source concept UUID
   * @param {string} params.toConceptUuid - Target concept UUID
   * @param {string} params.relationType - Relationship type
   * @param {number} [params.strength=1.0] - Association strength (0.0-1.0)
   * @param {Provenance} [params.provenance] - Provenance info
   * @returns {Promise<string>} Edge UUID
   */
  async addAssociation({
    fromConceptUuid,
    toConceptUuid,
    relationType,
    strength = 1.0,
    provenance = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    const edge = new Edge({
      fromNode: fromConceptUuid,
      toNode: toConceptUuid,
      rel: relationType,
      props: {
        w: strength,
        status: 'accepted'
      }
    });

    await this.memory.upsert(edge, prov, { embeddingRequest: false });
    return edge.uuid;
  }

  /**
   * Search for concepts by embedding similarity.
   * 
   * Fuzzy search based on cosine similarity of embeddings.
   * 
   * @param {Object} params
   * @param {string} params.query - Search query text
   * @param {number} [params.topK=5] - Maximum number of results
   * @param {number} [params.similarityThreshold=0.0] - Minimum similarity score
   * @param {string} [params.prototypeFilter] - Filter by prototype name
   * @param {number[]} [params.queryEmbedding] - Pre-computed query embedding
   * @returns {Promise<Array>} List of concept dicts with similarity scores
   */
  async searchConcepts({
    query,
    topK = 5,
    similarityThreshold = 0.0,
    prototypeFilter = null,
    queryEmbedding = null
  }) {
    let embedding = queryEmbedding;
    if (!embedding && this.embedFn) {
      try {
        embedding = await this.embedFn(query);
      } catch (error) {
        console.warn('Failed to generate embedding:', error);
        embedding = null;
      }
    }

    const filters = { kind: 'topic' };
    if (prototypeFilter) {
      // Note: prototype filtering would require edge traversal
      // Simplified here - would need to traverse instanceOf edges
    }

    const results = await this.memory.search({
      query,
      topK,
      filters,
      queryEmbedding: embedding
    });

    return results.map(r => {
      if (typeof r === 'object' && r !== null) {
        return r;
      }
      return r;
    });
  }

  /**
   * Get a concept by UUID.
   * 
   * @param {string} conceptUuid - Concept UUID
   * @returns {Promise<Object|null>} Concept node or null if not found
   */
  async getConcept(conceptUuid) {
    return await this.memory.getNode(conceptUuid);
  }
}

