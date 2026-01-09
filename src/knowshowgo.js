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
    const parents = parentPrototypeUuids || (basePrototypeUuid ? [basePrototypeUuid] : []);
    
    for (const parentUuid of parents) {
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

    const valueStr = String(value);
    if (!embedding && this.embedFn) {
      embedding = await this.embedFn(valueStr);
    }

    const valueNode = new Node({
      kind: 'topic',
      labels: [valueStr, `value:${valueType}`],
      props: {
        label: valueStr,
        isValue: true,
        valueType: valueType,
        literalValue: value,  // For quick access
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

      // Create value node
      const valueNode = await this.createValueNode({
        value: propValue,
        valueType: typeof propValue,
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
        toConceptUuid: valueNode.uuid,
        relationType: 'has_value',
        strength: 1.0,
        provenance: prov
      });

      // Concept --[has_value]--> Value (for quick access, with property name in props)
      await this.addAssociation({
        fromConceptUuid: concept.uuid,
        toConceptUuid: valueNode.uuid,
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
      return results[0].uuid;
    }

    // Create new property node
    return await this.createProperty({
      name: propName,
      valueType: valueType,
      embedding: await this.embedFn(`property ${propName} ${valueType}`)
    });
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
    const edges = Array.from(this.memory.edges?.values() || []);
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
}

