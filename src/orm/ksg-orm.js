/**
 * KnowShowGo ORM: Prototype-based object mapping
 * 
 * Provides JavaScript prototype-based object mapping for KnowShowGo concepts:
 * - Prototype-based objects (JavaScript-style inheritance)
 * - Lazy property loading from associated nodes
 * - Cached JSON documents linked to concept nodes
 * - Query by prototype (e.g., Person.find(), Person.create())
 */

import { Node, Edge, Provenance } from '../models.js';

export class KSGORM {
  constructor(ksg) {
    this.ksg = ksg;
    this.memory = ksg.memory;
    this.registeredPrototypes = new Map(); // prototypeName -> { prototypeUuid, class }
  }

  /**
   * Register a prototype and create JavaScript class.
   * 
   * @param {string} prototypeName - Prototype name (e.g., 'Person')
   * @param {Object} options
   * @param {Object} options.properties - Property definitions { name: { type, required, ... } }
   * @param {string[]} [options.parentPrototypes] - Parent prototype names
   * @param {string} [options.description] - Prototype description
   * @returns {Promise<Function>} JavaScript class constructor
   */
  async registerPrototype(prototypeName, options = {}) {
    const { properties = {}, parentPrototypes = [], description = null } = options;

    // Find or create prototype in KnowShowGo
    let prototypeUuid = await this._findPrototypeByName(prototypeName);
    
    if (!prototypeUuid) {
      // Create prototype with parent prototypes
      const parentUuids = await Promise.all(
        parentPrototypes.map(name => this._findPrototypeByName(name))
      );
      const validParents = parentUuids.filter(uuid => uuid !== null);

      const embedding = await this.ksg.embedFn(`${prototypeName} ${description || ''}`);
      prototypeUuid = await this.ksg.createPrototype({
        name: prototypeName,
        description: description || `${prototypeName} prototype`,
        context: 'orm',
        labels: [prototypeName.toLowerCase()],
        embedding: embedding,
        parentPrototypeUuids: validParents.length > 0 ? validParents : null
      });
    }

    // Create JavaScript class
    const PrototypeClass = this._createPrototypeClass(prototypeName, prototypeUuid, properties);
    
    // Register
    this.registeredPrototypes.set(prototypeName, {
      prototypeUuid,
      class: PrototypeClass,
      properties
    });

    return PrototypeClass;
  }

  /**
   * Create a JavaScript class for a prototype.
   * 
   * @private
   */
  _createPrototypeClass(prototypeName, prototypeUuid, properties) {
    const self = this;
    
    class KSGObject {
      constructor(conceptUuid, hydrated = false) {
        this._conceptUuid = conceptUuid;
        this._ksg = self.ksg;
        this._orm = self;
        this._cache = {};  // Property cache
        this._loaded = hydrated;  // Whether properties loaded
        this._documentCache = null;  // Cached JSON document
        this._documentDirty = false; // Whether document needs persisting
      }

      /**
       * Lazy load property value from associated nodes.
       * 
       * @private
       */
      async _getProperty(propName) {
        // Check cache
        if (this._cache[propName] !== undefined) {
          return this._cache[propName];
        }

        // Try cached document first
        if (!this._documentCache) {
          this._documentCache = await this._loadCachedDocument();
        }

        if (this._documentCache && this._documentCache[propName] !== undefined) {
          this._cache[propName] = this._documentCache[propName];
          return this._documentCache[propName];
        }

        // Lazy load from associations
        const value = await self._getPropertyValue(this._conceptUuid, propName);
        this._cache[propName] = value;
        
        // Update cached document in-memory only (avoid side-effectful writes on reads)
        if (value !== undefined) {
          this._updateCachedDocumentProperty(propName, value);
        }
        
        return value;
      }

      /**
       * Set property value (updates nodes and document).
       * 
       * @private
       */
      async _setProperty(propName, value) {
        // Update cache
        this._cache[propName] = value;

        // Update value node or create new one
        await self._setPropertyValue(this._conceptUuid, propName, value);

        // Update cached document (defer persistence until save)
        this._updateCachedDocumentProperty(propName, value);
      }

      /**
       * Load cached JSON document.
       * 
       * @private
       */
      async _loadCachedDocument() {
        const docNode = await self._getDocumentNode(this._conceptUuid);
        if (docNode && docNode.props.data) {
          return docNode.props.data;
        }
        return null;
      }

      /**
       * Update cached document property.
       * 
       * @private
       */
      async _updateCachedDocumentProperty(propName, value) {
        if (!this._documentCache) {
          this._documentCache = {};
        }
        this._documentCache[propName] = value;
        this._documentDirty = true;
      }

      /**
       * Save object (updates all nodes and document).
       */
      async save() {
        // Update all properties
        for (const [propName, value] of Object.entries(this._cache)) {
          await this._setProperty(propName, value);
        }

        // Persist cached document once per save
        if (this._documentDirty) {
          await self._updateCachedDocument(this._conceptUuid, this._documentCache || this._cache);
          this._documentDirty = false;
        }
      }

      /**
       * Get all properties as plain object.
       */
      async toJSON() {
        // Load all properties
        const props = {};
        for (const propName of Object.keys(properties)) {
          props[propName] = await this._getProperty(propName);
        }
        return {
          uuid: this._conceptUuid,
          ...props
        };
      }
    }

    // Add property getters/setters
    for (const propName of Object.keys(properties)) {
      Object.defineProperty(KSGObject.prototype, propName, {
        get: function() {
          // Return cached value if available, otherwise return undefined
          // (actual loading happens async via _getProperty)
          return this._cache[propName];
        },
        set: async function(value) {
          await this._setProperty(propName, value);
        },
        enumerable: true,
        configurable: true
      });
    }

    // Add static methods
    KSGObject.prototypeName = prototypeName;
    KSGObject.prototypeUuid = prototypeUuid;

    /**
     * Create a new instance.
     */
    KSGObject.create = async function(data) {
      const embedding = await self.ksg.embedFn(
        `${prototypeName} ${Object.values(data).join(' ')}`
      );

      // Create concept with properties
      const conceptUuid = await self.ksg.createConceptWithProperties({
        prototypeUuid: prototypeUuid,
        properties: data,
        embedding: embedding
      });

      // Create cached document
      await self._updateCachedDocument(conceptUuid, data);

      // Return instance
      const instance = new KSGObject(conceptUuid, true);
      instance._cache = { ...data };
      instance._documentCache = { ...data };
      return instance;
    };

    /**
     * Find all instances of this prototype.
     */
    KSGObject.find = async function() {
      const results = await self.ksg.searchConcepts({
        query: prototypeName,
        topK: 100,
        prototypeFilter: prototypeName
      });

      return results
        .filter(r => {
          // Verify instanceOf association to this prototype
          return true; // Simplified - would need to check instanceOf edges
        })
        .map(r => new KSGObject(r.uuid, false));
    };

    /**
     * Find one instance by properties.
     */
    KSGObject.findOne = async function(query) {
      const all = await KSGObject.find();
      
      for (const instance of all) {
        const props = await instance.toJSON();
        let match = true;
        for (const [key, value] of Object.entries(query)) {
          if (props[key] !== value) {
            match = false;
            break;
          }
        }
        if (match) {
          return instance;
        }
      }
      return null;
    };

    return KSGObject;
  }

  /**
   * Get property value from associated nodes.
   * 
   * @private
   */
  async _getPropertyValue(conceptUuid, propName) {
    // Find has_value associations with propertyName
    const edges = Array.from(this.memory.edges?.values() || []);
    const hasValueEdges = edges.filter(e =>
      e.fromNode === conceptUuid &&
      e.rel === 'has_value' &&
      e.props?.propertyName === propName
    );

    if (hasValueEdges.length === 0) {
      return undefined;
    }

    // Load value node
    const valueNode = await this.memory.getNode(hasValueEdges[0].toNode);
    if (valueNode && valueNode.props.isValue) {
      return valueNode.props.literalValue;
    }

    return undefined;
  }

  /**
   * Set property value (creates/updates value node and associations).
   * 
   * @private
   */
  async _setPropertyValue(conceptUuid, propName, value) {
    // Get or create property node
    const propUuid = await this._getOrCreateProperty(propName, typeof value);

    // Find existing value association
    const edges = Array.from(this.memory.edges?.values() || []);
    const existingEdge = edges.find(e =>
      e.fromNode === conceptUuid &&
      e.rel === 'has_value' &&
      e.props?.propertyName === propName
    );

    if (existingEdge) {
      // Update existing value node
      const valueNode = await this.memory.getNode(existingEdge.toNode);
      if (valueNode) {
        valueNode.props.literalValue = value;
        valueNode.props.label = String(value);
        await this.memory.upsert(valueNode, new Provenance({
          source: 'user',
          ts: new Date().toISOString(),
          confidence: 1.0,
          traceId: 'orm'
        }), { embeddingRequest: true });
      }
    } else {
      // Create new value node and associations
      const valueUuid = await this.ksg.createValueNode({
        value: value,
        valueType: typeof value,
        embedding: await this.ksg.embedFn(String(value))
      });

      // Concept --[has_prop]--> Property
      await this.ksg.addAssociation({
        fromConceptUuid: conceptUuid,
        toConceptUuid: propUuid,
        relationType: 'has_prop',
        strength: 1.0
      });

      // Concept --[has_value]--> Value
      await this.ksg.addAssociation({
        fromConceptUuid: conceptUuid,
        toConceptUuid: valueUuid,
        relationType: 'has_value',
        strength: 1.0,
        props: {
          propertyName: propName
        }
      });
    }
  }

  /**
   * Get or create property node.
   * 
   * @private
   */
  async _getOrCreateProperty(propName, valueType) {
    // Search for existing property
    const results = await this.ksg.searchConcepts({
      query: `property ${propName}`,
      topK: 1
    });

    if (results.length > 0 && results[0].props?.isProperty) {
      return results[0].uuid;
    }

    // Create new property
    return await this.ksg.createProperty({
      name: propName,
      valueType: valueType,
      embedding: await this.ksg.embedFn(`property ${propName} ${valueType}`)
    });
  }

  /**
   * Get or create document node for cached JSON.
   * 
   * @private
   */
  async _getDocumentNode(conceptUuid) {
    // Find has_document association
    const edges = Array.from(this.memory.edges?.values() || []);
    const docEdge = edges.find(e =>
      e.fromNode === conceptUuid &&
      e.rel === 'has_document'
    );

    if (docEdge) {
      return await this.memory.getNode(docEdge.toNode);
    }

    return null;
  }

  /**
   * Update cached JSON document.
   * 
   * @private
   */
  async _updateCachedDocument(conceptUuid, data) {
    let docNode = await this._getDocumentNode(conceptUuid);

    const prov = new Provenance({
      source: 'user',
      ts: new Date().toISOString(),
      confidence: 1.0,
      traceId: 'orm'
    });

    if (!docNode) {
      // Create new document node
      docNode = new Node({
        kind: 'topic',
        labels: ['document', `doc:${conceptUuid}`],
        props: {
          label: `Document for ${conceptUuid}`,
          isDocument: true,
          conceptUuid: conceptUuid,
          data: data,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'active',
          namespace: 'public'
        },
        llmEmbedding: await this.ksg.embedFn(JSON.stringify(data))
      });

      await this.memory.upsert(docNode, prov, { embeddingRequest: true });

      // Link concept to document
      await this.ksg.addAssociation({
        fromConceptUuid: conceptUuid,
        toConceptUuid: docNode.uuid,
        relationType: 'has_document',
        strength: 1.0,
        provenance: prov
      });
    } else {
      // Update existing document
      docNode.props.data = data;
      docNode.props.version = (docNode.props.version || 0) + 1;
      docNode.props.updatedAt = new Date().toISOString();
      docNode.llmEmbedding = await this.ksg.embedFn(JSON.stringify(data));

      await this.memory.upsert(docNode, prov, { embeddingRequest: true });
    }

    return docNode.uuid;
  }

  /**
   * Find prototype by name.
   * 
   * @private
   */
  async _findPrototypeByName(prototypeName) {
    const results = await this.ksg.searchConcepts({
      query: prototypeName,
      topK: 5
    });

    for (const result of results) {
      if (result.props?.isPrototype && 
          (result.props.label === prototypeName || 
           result.props.name === prototypeName)) {
        return result.uuid;
      }
    }

    return null;
  }
}

