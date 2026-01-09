/**
 * Core data models for KnowShowGo
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Provenance - tracks the origin of information
 */
export class Provenance {
  constructor({ source, ts, confidence, traceId }) {
    this.source = source; // 'user' | 'tool' | 'doc'
    this.ts = ts || new Date().toISOString();
    this.confidence = confidence ?? 1.0; // 0.0-1.0
    this.traceId = traceId || 'knowshowgo';
  }
}

/**
 * Node - represents a topic/concept/prototype in the knowledge graph
 * 
 * Aligned with Knowshowgo v0.1 Topic schema:
 * - All nodes are Topics (including Prototypes where isPrototype=true)
 * - Concepts are Topics with isPrototype=false
 * - Prototypes are Topics with isPrototype=true
 */
export class Node {
  constructor({
    kind = 'topic',
    labels = [],
    props = {},
    uuid = uuidv4(),
    llmEmbedding = null,
    status = 'active'
  }) {
    this.kind = kind; // 'topic' | 'Concept' | 'Prototype' (backward compat)
    this.labels = labels; // Primary label + aliases
    this.props = {
      label: props.label || labels[0] || 'concept',
      aliases: props.aliases || labels.slice(1),
      summary: props.summary || '',
      isPrototype: props.isPrototype ?? false,
      status: props.status || status,
      namespace: props.namespace || 'public',
      ...props
    };
    this.uuid = uuid;
    this.llmEmbedding = llmEmbedding;
    this.status = status;
  }
}

/**
 * Edge - represents an association between two nodes
 * 
 * Aligned with Knowshowgo v0.1 Association model:
 * - Properties-as-edges with PropertyDef reference (p)
 * - Weight (w) for fuzzy association strength (0.0-1.0)
 * - Confidence, provenance, votes, status
 */
export class Edge {
  constructor({
    fromNode,
    toNode,
    rel,
    props = {},
    uuid = uuidv4(),
    kind = 'edge'
  }) {
    this.fromNode = fromNode; // UUID of source Topic/Concept
    this.toNode = toNode; // UUID of destination Topic/Concept or Value
    this.rel = rel; // Relationship type (backward compat; prefer p for PropertyDef reference)
    this.props = {
      w: props.w ?? 1.0, // Weight/strength 0.0-1.0
      confidence: props.confidence ?? 1.0,
      status: props.status || 'accepted',
      ...props
    };
    this.uuid = uuid;
    this.kind = kind;
  }
}

