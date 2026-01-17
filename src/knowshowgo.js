/**
 * KnowShowGo API - A fuzzy ontology knowledge graph
 * 
 * KnowShowGo functions as a fuzzy ontology knowledge graph where:
 * - Concepts have embeddings for similarity-based matching (fuzzy, not exact)
 * - Relationships have confidence/strength scores (degrees of membership)
 * - Embedding-based similarity provides the "fuzziness" (partial matches)
 * - Supports uncertainty handling via provenance confidence scores
 */

import { v4 as uuidv4 } from 'uuid';
import { Node, Edge, Provenance } from './models.js';
import { KSGORM } from './orm/ksg-orm.js';

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
    this.orm = new KSGORM(this);  // ORM for prototype-based object hydration
  }

  /**
   * Create a Prototype (Topic with isPrototype=true).
   * 
   * Prototypes define schemas/templates. They are immutable but versioned.
   * Supports multiple inheritance via "is_a" associations.
   * 
   * @param {Object} params
   * @param {string} params.name - Prototype name
   * @param {string} params.description - Prototype description
   * @param {string} params.context - Additional context
   * @param {string[]} [params.labels] - Labels/aliases
   * @param {number[]} params.embedding - Vector embedding
   * @param {Provenance} [params.provenance] - Provenance info
   * @param {string} [params.basePrototypeUuid] - Single parent prototype UUID (backward compat)
   * @param {string[]} [params.parentPrototypeUuids] - Multiple parent prototype UUIDs (unified architecture)
   * @returns {Promise<string>} Prototype UUID
   */
  async createPrototype({
    name,
    description,
    context,
    labels = [],
    embedding,
    provenance = null,
    basePrototypeUuid = null,
    parentPrototypeUuids = null
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

    // Unified architecture: Multiple inheritance via "is_a" associations
    const parents = [
      ...(basePrototypeUuid ? [basePrototypeUuid] : []),
      ...(parentPrototypeUuids ?? [])
    ];
    const uniqueParents = [...new Set(parents.filter(Boolean))];
    
    for (const parentUuid of uniqueParents) {
      // Use "is_a" association for multiple inheritance (unified architecture)
      await this.addAssociation({
        fromConceptUuid: proto.uuid,
        toConceptUuid: parentUuid,
        relationType: 'is_a',  // Multiple inheritance via associations
        strength: 1.0,
        provenance: prov
      });
      
      // Also create "inherits" edge for backward compatibility
      const edge = new Edge({
        fromNode: proto.uuid,
        toNode: parentUuid,
        rel: 'inherits',  // Backward compat
        props: {
          child: name,
          parentUuid: parentUuid,
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
        // Preserve commonly expected fields
        name: jsonObj.name ?? label,
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
    provenance = null,
    props = {}
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
        status: 'accepted',
        ...props
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
   * List all edges in the current memory backend.
   *
   * Works for Map-backed in-memory storage and Arango proxy storage.
   *
   * @private
   * @returns {Promise<Array>}
   */
  async _listEdges() {
    const edges = this.memory?.edges;
    if (!edges) return [];

    if (edges instanceof Map) {
      return Array.from(edges.values());
    }

    // ArangoMemory exposes edges.values as an async function returning an array
    if (typeof edges.values === 'function') {
      const out = edges.values();
      return Array.isArray(out) ? out : await out;
    }

    return [];
  }

  _isUuid(v) {
    return typeof v === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  }

  _inferValueType(value) {
    if (value instanceof Date) return 'datetime';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') return 'string';
    if (value === null) return 'null';
    return 'json';
  }

  _normalizeLiteral(value, valueType) {
    switch (valueType) {
      case 'number': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new Error('Invalid number literal');
        }
        return value;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') throw new Error('Invalid boolean literal');
        return value;
      }
      case 'datetime': {
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'string') {
          const d = new Date(value);
          if (Number.isNaN(d.getTime())) throw new Error('Invalid datetime literal');
          return d.toISOString();
        }
        throw new Error('Invalid datetime literal');
      }
      case 'url': {
        if (typeof value !== 'string') throw new Error('Invalid url literal');
        try {
          const u = new URL(value);
          return u.toString();
        } catch {
          throw new Error('Invalid url literal');
        }
      }
      case 'node_ref': {
        if (!this._isUuid(value)) throw new Error('Invalid node_ref literal');
        return value;
      }
      case 'string': {
        if (typeof value !== 'string') throw new Error('Invalid string literal');
        return value;
      }
      case 'null': {
        return null;
      }
      case 'json': {
        // JSON-serializable check (best-effort)
        try {
          JSON.stringify(value);
        } catch {
          throw new Error('Invalid json literal');
        }
        return value;
      }
      default: {
        throw new Error(`Unsupported valueType: ${valueType}`);
      }
    }
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

  /**
   * Get a prototype by UUID.
   *
   * @param {string} prototypeUuid
   * @returns {Promise<Object|null>}
   */
  async getPrototype(prototypeUuid) {
    const node = await this.getConcept(prototypeUuid);
    if (!node) return null;
    if (node.props?.isPrototype !== true) return null;
    return node;
  }

  /**
   * Get associations (edges) for a concept.
   *
   * @param {string} conceptUuid
   * @param {'incoming'|'outgoing'|'both'} [direction='both']
   * @returns {Promise<Array>}
   */
  async getAssociations(conceptUuid, direction = 'both') {
    const edges = await this._listEdges();
    if (direction === 'incoming') {
      return edges.filter(e => e.toNode === conceptUuid);
    }
    if (direction === 'outgoing') {
      return edges.filter(e => e.fromNode === conceptUuid);
    }
    return edges.filter(e => e.fromNode === conceptUuid || e.toNode === conceptUuid);
  }

  /**
   * Create a Property node (for fully unified architecture).
   * 
   * Properties are nodes that define property definitions.
   * 
   * @param {Object} params
   * @param {string} params.name - Property name
   * @param {string} params.valueType - Value type (string, number, boolean, etc.)
   * @param {boolean} [params.required=false] - Whether property is required
   * @param {string} [params.description] - Property description
   * @param {number[]} [params.embedding] - Vector embedding
   * @param {Provenance} [params.provenance] - Provenance info
   * @returns {Promise<string>} Property node UUID
   */
  async createProperty({
    name,
    valueType,
    required = false,
    description = null,
    embedding = null,
    provenance = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    if (!embedding && this.embedFn) {
      embedding = await this.embedFn(`property ${name} ${valueType}`);
    }

    const propNode = new Node({
      kind: 'topic',
      labels: [name, `property:${name}`],
      props: {
        label: name,
        isProperty: true,
        valueType: valueType,
        required: required,
        description: description || `Property: ${name}`,
        status: 'active',
        namespace: 'public'
      },
      llmEmbedding: embedding
    });

    await this.memory.upsert(propNode, prov, { embeddingRequest: true });
    return propNode.uuid;
  }

  /**
   * Create a Value node (for fully unified architecture).
   * 
   * Values are nodes that store literal values.
   * 
   * @param {Object} params
   * @param {*} params.value - Literal value (string, number, boolean, etc.)
   * @param {string} params.valueType - Value type
   * @param {number[]} [params.embedding] - Vector embedding
   * @param {Provenance} [params.provenance] - Provenance info
   * @returns {Promise<string>} Value node UUID
   */
  async createValueNode({
    value,
    valueType,
    embedding = null,
    provenance = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    const normalizedType = valueType || this._inferValueType(value);
    const normalizedValue = this._normalizeLiteral(value, normalizedType);
    const valueStr = normalizedValue === null ? 'null' : String(normalizedValue);
    if (!embedding && this.embedFn) {
      embedding = await this.embedFn(valueStr);
    }

    const valueNode = new Node({
      kind: 'topic',
      labels: [valueStr, `value:${normalizedType}`],
      props: {
        label: valueStr,
        isValue: true,
        valueType: normalizedType,
        literalValue: normalizedValue, // JSON-friendly normalized value
        status: 'active',
        namespace: 'public'
      },
      llmEmbedding: embedding
    });

    await this.memory.upsert(valueNode, prov, { embeddingRequest: true });
    return valueNode.uuid;
  }

  /**
   * Create a concept with properties using fully unified architecture.
   * 
   * Properties and values are nodes connected via "has_prop" and "has_value" associations.
   * 
   * @param {Object} params
   * @param {string} params.prototypeUuid - Prototype UUID
   * @param {Object} params.properties - Property name -> value mapping
   * @param {number[]} params.embedding - Concept embedding
   * @param {Provenance} [params.provenance] - Provenance info
   * @returns {Promise<string>} Concept UUID
   */
  async createConceptWithProperties({
    prototypeUuid,
    properties,
    embedding,
    provenance = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    // Create concept node (minimal props - no embedded properties)
    const label = properties.name || properties.label || 'concept';
    const concept = new Node({
      kind: 'topic',
      labels: [label],
      props: {
        label: label,
        isPrototype: false,
        isConcept: true,
        status: 'active',
        namespace: 'public'
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

    // For each property, create property node, value node, and associations
    for (const [propName, propValue] of Object.entries(properties)) {
      if (propName === 'name' || propName === 'label') {
        continue; // Already used for concept label
      }

      // Get or create property node
      const propNode = await this.getOrCreateProperty(propName, typeof propValue);
      const valueType = propNode.props?.valueType || this._inferValueType(propValue);

      // Create value node
      const valueUuid = await this.createValueNode({
        value: propValue,
        valueType: valueType,
        embedding: await this.embedFn(String(propValue)),
        provenance: prov
      });

      // Concept --[has_prop]--> Property
      await this.addAssociation({
        fromConceptUuid: concept.uuid,
        toConceptUuid: propNode.uuid,
        relationType: 'has_prop',
        strength: 1.0,
        provenance: prov,
        props: {
          propertyName: propName
        }
      });

      // Property --[has_value]--> Value
      await this.addAssociation({
        fromConceptUuid: propNode.uuid,
        toConceptUuid: valueUuid,
        relationType: 'has_value',
        strength: 1.0,
        provenance: prov
      });

      // Concept --[has_value]--> Value (for quick access, with property name in props)
      await this.addAssociation({
        fromConceptUuid: concept.uuid,
        toConceptUuid: valueUuid,
        relationType: 'has_value',
        strength: 1.0,
        provenance: prov,
        props: {
          propertyName: propName
        }
      });
    }

    return concept.uuid;
  }

  /**
   * Get or create a property node.
   * 
   * @private
   */
  async getOrCreateProperty(propName, valueType = 'string') {
    // Search for existing property
    const results = await this.searchConcepts({
      query: `property ${propName}`,
      topK: 1,
      prototypeFilter: null
    });

    if (results.length > 0 && results[0].props?.isProperty) {
      const existing = await this.getConcept(results[0].uuid);
      if (existing) return existing;
    }

    // Create new property node
    const createdUuid = await this.createProperty({
      name: propName,
      valueType: valueType,
      embedding: await this.embedFn(`property ${propName} ${valueType}`)
    });
    const created = await this.getConcept(createdUuid);
    if (!created) {
      throw new Error(`Failed to load created property node: ${createdUuid}`);
    }
    return created;
  }

  /**
   * Get properties of a concept (fully unified architecture).
   * 
   * @param {string} conceptUuid - Concept UUID
   * @returns {Promise<Object>} Property name -> value mapping
   */
  async getProperties(conceptUuid) {
    // Find all "has_prop" associations from concept
    // Note: This requires memory backend to support association queries
    // For now, simplified implementation
    
    const concept = await this.getConcept(conceptUuid);
    if (!concept) {
      return {};
    }

    // Find direct "has_value" associations with propertyName in props
    const edges = await this._listEdges();
    const hasValueEdges = edges.filter(e => 
      e.fromNode === conceptUuid && 
      e.rel === 'has_value' &&
      e.props?.propertyName
    );

    const properties = {};
    for (const edge of hasValueEdges) {
      const valueNode = await this.getConcept(edge.toNode);
      if (valueNode && valueNode.props?.isValue) {
        properties[edge.props.propertyName] = valueNode.props.literalValue;
      }
    }

    return properties;
  }

  /**
   * Create a node with document metadata and tag nodes.
   * 
   * All representational units (percepts, objects, concepts, topics, etc.) have:
   * - UUID
   * - Document containing metadata and associations to tag nodes (text)
   * - Vector embedding (mean of all related text vector embeddings)
   * 
   * @param {Object} params
   * @param {string} params.label - Node label
   * @param {string} [params.summary] - Node summary/description
   * @param {string[]} [params.tags] - Array of text strings (will become tag nodes)
   * @param {Object} [params.metadata] - Additional metadata
   * @param {Array} [params.associations] - Associations to other nodes
   * @param {string} [params.prototypeUuid] - Prototype UUID (if creating concept)
   * @param {Provenance} [params.provenance] - Provenance info
   * @returns {Promise<string>} Node UUID
   */
  async createNodeWithDocument({
    label,
    summary = null,
    tags = [],
    metadata = {},
    associations = [],
    prototypeUuid = null,
    provenance = null
  }) {
    const prov = provenance || new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'knowshowgo'
    });

    // 1. Create tag nodes from text
    const tagNodes = [];
    for (const tagText of tags) {
      const tagEmbedding = await this.embedFn(tagText);
      const tagNode = new Node({
        kind: 'topic',
        labels: [tagText],
        props: {
          label: tagText,
          isTag: true,
          text: tagText,
          status: 'active',
          namespace: 'public'
        },
        llmEmbedding: tagEmbedding
      });
      await this.memory.upsert(tagNode, prov, { embeddingRequest: true });
      tagNodes.push(tagNode);
    }

    // 2. Create main node (embedding will be computed)
    const node = new Node({
      kind: 'topic',
      labels: [label],
      props: {
        label: label,
        summary: summary || '',
        isConcept: prototypeUuid !== null,
        isPrototype: prototypeUuid === null && metadata.isPrototype === true,
        status: 'active',
        namespace: 'public',
        ...metadata
      },
      llmEmbedding: null  // Will be computed as mean of related text
    });
    await this.memory.upsert(node, prov, { embeddingRequest: false });

    // 3. Create instanceOf association if prototype provided
    if (prototypeUuid) {
      await this.addAssociation({
        fromConceptUuid: node.uuid,
        toConceptUuid: prototypeUuid,
        relationType: 'instanceOf',
        strength: 1.0,
        provenance: prov
      });
    }

    // 4. Create document node
    const docNode = new Node({
      kind: 'topic',
      labels: [`doc:${node.uuid}`, 'document'],
      props: {
        isDocument: true,
        targetNodeUuid: node.uuid,
        metadata: {
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: 1,
          ...metadata
        },
        tags: tagNodes.map(t => t.uuid),
        associations: associations.map(a => ({
          relationType: a.relationType || a.rel,
          targetUuid: a.targetUuid || a.toNode,
          weight: a.weight || a.w || 1.0
        })),
        status: 'active',
        namespace: 'public'
      },
      llmEmbedding: null  // Will be computed from tags
    });
    await this.memory.upsert(docNode, prov, { embeddingRequest: false });

    // 5. Link node to document
    await this.addAssociation({
      fromConceptUuid: node.uuid,
      toConceptUuid: docNode.uuid,
      relationType: 'has_document',
      strength: 1.0,
      provenance: prov
    });

    // 6. Link document to tags
    for (const tagNode of tagNodes) {
      await this.addAssociation({
        fromConceptUuid: docNode.uuid,
        toConceptUuid: tagNode.uuid,
        relationType: 'has_tag',
        strength: 1.0,
        provenance: prov
      });
    }

    // 7. Create associations specified in params
    for (const assoc of associations) {
      await this.addAssociation({
        fromConceptUuid: node.uuid,
        toConceptUuid: assoc.targetUuid || assoc.toNode,
        relationType: assoc.relationType || assoc.rel,
        strength: assoc.weight || assoc.w || 1.0,
        provenance: prov
      });
    }

    // 8. Compute mean embedding for node (from all related text)
    const meanEmbedding = await this.computeNodeEmbedding(node.uuid);
    if (meanEmbedding) {
      node.llmEmbedding = meanEmbedding;
      await this.memory.upsert(node, prov, { embeddingRequest: false });
    }

    // 9. Compute mean embedding for document (from tags)
    if (tagNodes.length > 0) {
      const tagEmbeddings = tagNodes
        .map(t => t.llmEmbedding)
        .filter(e => e !== null && e !== undefined);
      
      if (tagEmbeddings.length > 0) {
        const docMeanEmbedding = this._meanEmbedding(tagEmbeddings);
        docNode.llmEmbedding = docMeanEmbedding;
        await this.memory.upsert(docNode, prov, { embeddingRequest: false });
      }
    }

    return node.uuid;
  }

  /**
   * Compute node embedding as mean of all associated tag node embeddings.
   * 
   * The concept's embedding is the mean vector embedding of all tag nodes
   * that are linked via edges to the concept (or its document).
   * 
   * Tags all have vector embeddings, and the mean of all edge-linked tag
   * node vector embedding attribute values represents the concept.
   * 
   * @param {string} nodeUuid - Node UUID
   * @returns {Promise<number[]|null>} Mean embedding vector
   */
  async computeNodeEmbedding(nodeUuid) {
    const tagEmbeddings = [];

    // 1. Get all edges connected to this node
    const edges = await this._listEdges();
    
    // 2. Find all tag nodes linked via edges (both incoming and outgoing)
    const connectedNodes = new Set();
    
    // Outgoing edges: node -> tag
    for (const edge of edges) {
      if (edge.fromNode === nodeUuid) {
        connectedNodes.add(edge.toNode);
      }
    }
    
    // Incoming edges: tag -> node
    for (const edge of edges) {
      if (edge.toNode === nodeUuid) {
        connectedNodes.add(edge.fromNode);
      }
    }
    
    // 3. Also check document node if it exists
    const docNode = await this._getDocumentNode(nodeUuid);
    if (docNode) {
      // Get edges from document to tags
      for (const edge of edges) {
        if (edge.fromNode === docNode.uuid) {
          connectedNodes.add(edge.toNode);
        }
      }
    }

    // 4. Collect embeddings from all connected tag nodes
    for (const connectedUuid of connectedNodes) {
      const connectedNode = await this.getConcept(connectedUuid);
      if (connectedNode && connectedNode.props?.isTag === true) {
        // This is a tag node - use its embedding
        if (connectedNode.llmEmbedding) {
          tagEmbeddings.push(connectedNode.llmEmbedding);
        }
      }
    }

    // 5. If no tag embeddings found, fall back to node's own text
    if (tagEmbeddings.length === 0) {
      const node = await this.getConcept(nodeUuid);
      if (!node) {
        return null;
      }
      
      // Use node's label/summary as fallback
      if (node.props?.label) {
        const labelEmbedding = await this.embedFn(node.props.label);
        tagEmbeddings.push(labelEmbedding);
      }
      if (node.props?.summary) {
        const summaryEmbedding = await this.embedFn(node.props.summary);
        tagEmbeddings.push(summaryEmbedding);
      }
    }

    // 6. Compute mean of all tag embeddings
    if (tagEmbeddings.length === 0) {
      return null;
    }

    return this._meanEmbedding(tagEmbeddings);
  }

  /**
   * Compute mean of embeddings.
   * 
   * @private
   */
  _meanEmbedding(embeddings) {
    if (embeddings.length === 0) return null;
    if (embeddings.length === 1) return embeddings[0];

    const dim = embeddings[0].length;
    const mean = new Array(dim).fill(0);

    for (const emb of embeddings) {
      if (!emb || emb.length !== dim) continue;
      for (let i = 0; i < dim; i++) {
        mean[i] += emb[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      mean[i] /= embeddings.length;
    }

    return mean;
  }

  /**
   * Get document node for a concept.
   * 
   * @private
   */
  async _getDocumentNode(conceptUuid) {
    const edges = await this._listEdges();
    const docEdge = edges.find(e =>
      e.fromNode === conceptUuid &&
      e.rel === 'has_document'
    );

    if (docEdge) {
      return await this.getConcept(docEdge.toNode);
    }

    return null;
  }

  /**
   * Update node embedding when tags or associations change.
   * 
   * @param {string} nodeUuid - Node UUID
   */
  async updateNodeEmbedding(nodeUuid) {
    const newEmbedding = await this.computeNodeEmbedding(nodeUuid);
    
    if (newEmbedding) {
      const node = await this.getConcept(nodeUuid);
      if (node) {
        node.llmEmbedding = newEmbedding;
        const prov = new Provenance({
          source: 'system',
          ts: new Date().toISOString(),
          confidence: 1.0,
          traceId: 'knowshowgo'
        });
        await this.memory.upsert(node, prov, { embeddingRequest: false });
      }
    }
  }

  // ============================================================================
  // ASSERTIONS (v0.2.0) - The Spine
  // ============================================================================

  /**
   * Create an assertion (truth-bearing claim).
   * 
   * KISS: Minimal fields only. Add complexity when needed.
   * 
   * @param {Object} params
   * @param {string} params.subject - Entity UUID this assertion is about
   * @param {string} params.predicate - Property name (string, not UUID)
   * @param {*} params.object - Value (string, number, or JSON)
   * @param {number} [params.truth=1.0] - How true is this? [0,1]
   * @param {string} [params.source='user'] - Where this came from
   * @returns {Promise<Object>} Created assertion
   */
  async createAssertion({ subject, predicate, object, truth = 1.0, source = 'user' }) {
    if (!subject) throw new Error('subject is required');
    if (!predicate) throw new Error('predicate is required');
    if (object === undefined) throw new Error('object is required');
    if (typeof truth !== 'number' || truth < 0 || truth > 1) {
      throw new Error('truth must be a number between 0 and 1');
    }

    const assertion = {
      uuid: uuidv4(),
      subject,
      predicate,
      object,
      truth,
      source,
      createdAt: new Date().toISOString()
    };

    // Store in memory as a special node type
    const node = new Node({
      kind: 'assertion',
      labels: [`assertion:${subject}:${predicate}`],
      props: assertion,
      llmEmbedding: null
    });

    const prov = new Provenance({
      source: source,
      ts: assertion.createdAt,
      confidence: truth,
      traceId: 'assertion'
    });

    await this.memory.upsert(node, prov, { embeddingRequest: false });
    return assertion;
  }

  /**
   * Get assertions matching filters.
   * 
   * @param {Object} [filters={}]
   * @param {string} [filters.subject] - Filter by subject UUID
   * @param {string} [filters.predicate] - Filter by predicate name
   * @param {*} [filters.object] - Filter by object value
   * @returns {Promise<Array>} Matching assertions
   */
  async getAssertions(filters = {}) {
    const allNodes = await this._getAllNodes();
    
    return allNodes
      .filter(n => n.kind === 'assertion')
      .map(n => n.props)
      .filter(a => {
        if (filters.subject && a.subject !== filters.subject) return false;
        if (filters.predicate && a.predicate !== filters.predicate) return false;
        if (filters.object !== undefined && a.object !== filters.object) return false;
        return true;
      });
  }

  /**
   * Get all nodes from memory (helper).
   * @private
   */
  async _getAllNodes() {
    const nodes = this.memory?.nodes;
    if (!nodes) return [];

    if (nodes instanceof Map) {
      return Array.from(nodes.values());
    }

    if (typeof nodes.values === 'function') {
      const out = nodes.values();
      return Array.isArray(out) ? out : await out;
    }

    return [];
  }

  /**
   * Get snapshot (resolved values) for an entity.
   * 
   * KISS: Highest truth wins. Ties: most recent.
   * 
   * @param {string} entityUuid - Entity UUID
   * @returns {Promise<Object>} Resolved property values
   */
  async snapshot(entityUuid) {
    const assertions = await this.getAssertions({ subject: entityUuid });
    
    // Group by predicate
    const byPredicate = {};
    for (const a of assertions) {
      if (!byPredicate[a.predicate]) {
        byPredicate[a.predicate] = [];
      }
      byPredicate[a.predicate].push(a);
    }

    // Resolve each predicate (highest truth wins, tiebreak by most recent)
    const snapshot = {};
    for (const [predicate, predicateAssertions] of Object.entries(byPredicate)) {
      const winner = this._resolve(predicateAssertions);
      if (winner) {
        snapshot[predicate] = winner.object;
      }
    }

    return snapshot;
  }

  /**
   * Get all evidence (competing assertions) for an entity.
   * 
   * @param {string} entityUuid - Entity UUID
   * @param {string} [predicate] - Optional filter by predicate
   * @returns {Promise<Array>} All assertions with scores
   */
  async evidence(entityUuid, predicate = null) {
    const filters = { subject: entityUuid };
    if (predicate) {
      filters.predicate = predicate;
    }
    
    const assertions = await this.getAssertions(filters);
    
    // Sort by score (truth, then recency)
    return assertions.sort((a, b) => {
      if (b.truth !== a.truth) return b.truth - a.truth;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * Simple resolver: highest truth wins, tiebreak by most recent.
   * @private
   */
  _resolve(assertions) {
    if (!assertions || assertions.length === 0) return null;
    
    return assertions.sort((a, b) => {
      if (b.truth !== a.truth) return b.truth - a.truth;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })[0];
  }

  // ============================================================================
  // VERIFICATION / HALLUCINATION DETECTION (MVP)
  // ============================================================================

  /**
   * Store a verified fact (triple with provenance).
   * 
   * @param {Object} params
   * @param {string} params.subject - Subject entity (e.g., "Bell")
   * @param {string} params.predicate - Relation (e.g., "invented")
   * @param {string} params.object - Object entity (e.g., "telephone")
   * @param {string} [params.status='verified'] - verified|refuted|unverified
   * @param {number} [params.confidence=1.0] - Confidence [0,1]
   * @param {Object} [params.source] - Provenance source
   * @returns {Promise<Object>} Stored fact
   */
  async storeFact({ subject, predicate, object, status = 'verified', confidence = 1.0, source = null }) {
    // Normalize to lowercase for matching
    const normSubject = subject.toLowerCase().trim();
    const normPredicate = predicate.toLowerCase().trim();
    const normObject = object.toLowerCase().trim();
    
    // Create a fact ID for deduplication
    const factKey = `${normSubject}|${normPredicate}|${normObject}`;
    
    // Store as assertion with verification metadata
    const assertion = await this.createAssertion({
      subject: factKey,
      predicate: 'is_fact',
      object: JSON.stringify({
        subject: normSubject,
        predicate: normPredicate,
        object: normObject,
        status,
        source: source || { type: 'user' }
      }),
      truth: confidence,
      source: 'verification'
    });
    
    // Also create searchable embedding for semantic matching
    const factText = `${subject} ${predicate} ${object}`;
    const embedding = await this.embedFn(factText);
    
    const factNode = new Node({
      kind: 'fact',
      labels: [factKey, 'verified_fact'],
      props: {
        subject: normSubject,
        predicate: normPredicate,
        object: normObject,
        status,
        confidence,
        source: source || { type: 'user' },
        assertionId: assertion.uuid,
        rawText: factText
      },
      llmEmbedding: embedding
    });
    
    const prov = new Provenance({
      source: 'verification',
      ts: new Date().toISOString(),
      confidence,
      traceId: 'fact-store'
    });
    
    await this.memory.upsert(factNode, prov, { embeddingRequest: false });
    
    return {
      uuid: factNode.uuid,
      assertionId: assertion.uuid,
      subject: normSubject,
      predicate: normPredicate,
      object: normObject,
      status,
      confidence
    };
  }

  /**
   * Verify a claim against stored facts.
   * 
   * @param {string} claim - Natural language claim to verify
   * @param {Object} [options]
   * @param {number} [options.threshold=0.7] - Similarity threshold
   * @returns {Promise<Object>} Verification result
   */
  async verify(claim, { threshold = 0.7 } = {}) {
    const claimLower = claim.toLowerCase().trim();
    const claimEmbedding = await this.embedFn(claim);
    
    // Get all fact nodes
    const allNodes = await this._getAllNodes();
    const factNodes = allNodes.filter(n => n.kind === 'fact');
    
    if (factNodes.length === 0) {
      return {
        status: 'unverified',
        confidence: 0,
        reason: 'No facts in knowledge base',
        claim,
        matchingFact: null,
        contradictingFact: null
      };
    }
    
    // Find best matching fact by embedding similarity
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const fact of factNodes) {
      if (!fact.llmEmbedding) continue;
      
      const similarity = this._cosineSimilarity(claimEmbedding, fact.llmEmbedding);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = fact;
      }
    }
    
    // No good match
    if (!bestMatch || bestSimilarity < threshold) {
      return {
        status: 'unverified',
        confidence: bestSimilarity,
        reason: `No matching fact found (best similarity: ${(bestSimilarity * 100).toFixed(1)}%)`,
        claim,
        matchingFact: null,
        contradictingFact: null
      };
    }
    
    const matchedFact = bestMatch.props;
    
    // Check for contradiction (same subject+predicate, different object)
    const possibleContradiction = await this._findContradiction(claimLower, matchedFact, factNodes);
    
    if (possibleContradiction) {
      return {
        status: 'refuted',
        confidence: bestSimilarity,
        reason: `Contradicts known fact: "${possibleContradiction.subject} ${possibleContradiction.predicate} ${possibleContradiction.object}"`,
        claim,
        matchingFact: null,
        contradictingFact: possibleContradiction
      };
    }
    
    // Verified - matches a known fact
    if (matchedFact.status === 'verified') {
      return {
        status: 'verified',
        confidence: bestSimilarity * matchedFact.confidence,
        reason: `Matches verified fact: "${matchedFact.subject} ${matchedFact.predicate} ${matchedFact.object}"`,
        claim,
        matchingFact: matchedFact,
        contradictingFact: null
      };
    }
    
    // Known to be false
    if (matchedFact.status === 'refuted') {
      return {
        status: 'refuted',
        confidence: bestSimilarity,
        reason: `Claim matches known false fact`,
        claim,
        matchingFact: null,
        contradictingFact: matchedFact
      };
    }
    
    return {
      status: 'unverified',
      confidence: bestSimilarity,
      reason: 'Fact status unclear',
      claim,
      matchingFact: matchedFact,
      contradictingFact: null
    };
  }

  /**
   * Find if claim contradicts a known fact.
   * @private
   */
  async _findContradiction(claimLower, matchedFact, factNodes) {
    // Simple heuristic: if claim contains subject+predicate but different object
    const { subject, predicate, object } = matchedFact;
    
    // Check if claim mentions subject and predicate
    if (claimLower.includes(subject) && claimLower.includes(predicate)) {
      // But does NOT match the object - might be contradiction
      if (!claimLower.includes(object)) {
        // Find what the claim says
        for (const otherFact of factNodes) {
          if (otherFact.props.subject === subject && 
              otherFact.props.predicate === predicate &&
              otherFact.props.object !== object) {
            // Different object for same subject+predicate
            if (claimLower.includes(otherFact.props.object)) {
              // Claim mentions this other object - it's a contradiction
              return matchedFact; // Return the correct fact
            }
          }
        }
        // Claim mentions subject+predicate but wrong object
        return matchedFact;
      }
    }
    
    return null;
  }

  /**
   * Cosine similarity between two vectors.
   * @private
   */
  _cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }

  /**
   * Get stats about stored facts.
   * @returns {Promise<Object>}
   */
  async getFactStats() {
    const allNodes = await this._getAllNodes();
    const facts = allNodes.filter(n => n.kind === 'fact');
    
    const byStatus = { verified: 0, refuted: 0, unverified: 0 };
    for (const f of facts) {
      const status = f.props?.status || 'unverified';
      byStatus[status] = (byStatus[status] || 0) + 1;
    }
    
    return {
      total: facts.length,
      byStatus
    };
  }
}

