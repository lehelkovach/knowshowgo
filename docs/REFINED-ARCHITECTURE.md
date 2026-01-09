# Refined Architecture: Nodes with Document Metadata and Mean Embeddings

## Core Principle

**All representational units** (percepts, objects, concepts, topics, subjects, entities, symbols) are nodes with:
1. **UUID** - Unique identifier
2. **Document** - Metadata and associations to tag nodes (text)
3. **Vector Embedding** - Mean of all edge-linked tag node vector embeddings

**Key Rule**: Tags all have vector embeddings, and the mean vector embedding of all associated (edge) linked tag node vector embedding attribute values represents the concept.

## Node Structure

### Every Node Has

```javascript
Node {
  uuid: string,                    // Unique identifier
  kind: 'topic',                   // Always 'topic'
  labels: string[],                // Primary label + aliases
  
  props: {
    label: string,                 // Primary label
    aliases: string[],             // Additional labels
    summary: string,                // Description
    // Type markers
    isPrototype: boolean,
    isConcept: boolean,
    isProperty: boolean,
    isValue: boolean,
    isTag: boolean,                // Text tag node
    isDocument: boolean,            // Metadata document
    // ... other metadata
  },
  
  llmEmbedding: number[],          // Mean of all related text embeddings
  status: 'active'
}
```

## Document Structure

### Every Node Has a Document

```javascript
DocumentNode {
  uuid: string,
  kind: 'topic',
  props: {
    isDocument: true,
    targetNodeUuid: string,       // Node this document describes
    metadata: {
      // Structured metadata
      created: string,
      updated: string,
      version: number,
      // ... other metadata
    },
    tags: string[],                // References to tag node UUIDs
    associations: [                // Associations to other nodes
      {
        relationType: string,
        targetUuid: string,
        weight: number
      }
    ]
  },
  llmEmbedding: number[]           // Mean of tag embeddings
}
```

## Tag Nodes (Text)

### Tags are Nodes Too

```javascript
TagNode {
  uuid: string,
  kind: 'topic',
  props: {
    isTag: true,
    text: string,                  // The actual text
    language: string,              // 'en', 'es', etc.
    context: string,               // Where this tag appears
  },
  llmEmbedding: number[]           // Embedding of the text
}
```

## Embedding Computation

### Mean Embedding from Edge-Linked Tag Nodes

**Core Principle**: Tags all have vector embeddings, and the mean vector embedding of all associated (edge) linked tag node vector embedding attribute values represents the concept.

```javascript
async computeNodeEmbedding(nodeUuid) {
  const tagEmbeddings = [];

  // 1. Get all edges connected to this node (incoming and outgoing)
  const edges = getAllEdges(nodeUuid);
  
  // 2. Find all tag nodes linked via edges
  const connectedNodes = new Set();
  
  // Outgoing edges: concept -> tag
  for (const edge of edges) {
    if (edge.fromNode === nodeUuid) {
      connectedNodes.add(edge.toNode);
    }
  }
  
  // Incoming edges: tag -> concept
  for (const edge of edges) {
    if (edge.toNode === nodeUuid) {
      connectedNodes.add(edge.fromNode);
    }
  }
  
  // 3. Also check document node if it exists
  const docNode = await getDocumentNode(nodeUuid);
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
    const connectedNode = await getNode(connectedUuid);
    if (connectedNode && connectedNode.props.isTag === true) {
      // This is a tag node - use its embedding attribute value
      if (connectedNode.llmEmbedding) {
        tagEmbeddings.push(connectedNode.llmEmbedding);
      }
    }
  }

  // 5. Compute mean of all tag node embeddings
  if (tagEmbeddings.length === 0) {
    return null;
  }
  
  const meanEmbedding = _meanEmbedding(tagEmbeddings);
  
  // 6. Update node embedding
  node.llmEmbedding = meanEmbedding;
  await memory.upsert(node, prov);
  
  return meanEmbedding;
}

_meanEmbedding(embeddings) {
  if (embeddings.length === 0) return null;
  if (embeddings.length === 1) return embeddings[0];
  
  const dim = embeddings[0].length;
  const mean = new Array(dim).fill(0);
  
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      mean[i] += emb[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    mean[i] /= embeddings.length;
  }
  
  return mean;
}
```

## Node Creation Flow

### Creating a Node with Document and Tags

```javascript
async createNodeWithDocument({
  label,
  summary,
  tags = [],           // Array of text strings
  metadata = {},
  associations = []
}) {
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
        text: tagText
      },
      llmEmbedding: tagEmbedding
    });
    await this.memory.upsert(tagNode, prov);
    tagNodes.push(tagNode);
  }
  
  // 2. Create main node
  const node = new Node({
    kind: 'topic',
    labels: [label],
    props: {
      label: label,
      summary: summary,
      isConcept: true  // or isPrototype, etc.
    },
    llmEmbedding: null  // Will be computed
  });
  await this.memory.upsert(node, prov);
  
  // 3. Create document node
  const docNode = new Node({
    kind: 'topic',
    labels: [`doc:${node.uuid}`],
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
      associations: associations
    },
    llmEmbedding: null  // Will be computed from tags
  });
  await this.memory.upsert(docNode, prov);
  
  // 4. Link node to document
  await this.addAssociation({
    fromConceptUuid: node.uuid,
    toConceptUuid: docNode.uuid,
    relationType: 'has_document',
    strength: 1.0
  });
  
  // 5. Link document to tags
  for (const tagNode of tagNodes) {
    await this.addAssociation({
      fromConceptUuid: docNode.uuid,
      toConceptUuid: tagNode.uuid,
      relationType: 'has_tag',
      strength: 1.0
    });
  }
  
  // 6. Compute mean embedding for node
  const meanEmbedding = await this.computeNodeEmbedding(node.uuid);
  node.llmEmbedding = meanEmbedding;
  await this.memory.upsert(node, prov);
  
  // 7. Compute mean embedding for document
  const docMeanEmbedding = await this._meanEmbedding(
    tagNodes.map(t => t.llmEmbedding)
  );
  docNode.llmEmbedding = docMeanEmbedding;
  await this.memory.upsert(docNode, prov);
  
  return node.uuid;
}
```

## Embedding Update Strategy

### When to Recompute Embeddings

1. **Tag Added**: Recompute document and node embeddings
2. **Tag Removed**: Recompute document and node embeddings
3. **Association Added**: Recompute node embedding (includes related nodes)
4. **Association Removed**: Recompute node embedding
5. **Node Label/Summary Changed**: Recompute node embedding

### Incremental Updates

```javascript
async updateNodeEmbedding(nodeUuid) {
  // Recompute mean embedding
  const newEmbedding = await this.computeNodeEmbedding(nodeUuid);
  
  // Update node
  const node = await this.getNode(nodeUuid);
  node.llmEmbedding = newEmbedding;
  await this.memory.upsert(node, prov);
  
  // Optionally: Update related nodes if they include this node in their mean
  // (For efficiency, can be done lazily or in background)
}
```

## Benefits

1. **Text as First-Class Citizens**: Tags are nodes, can be queried, versioned, shared
2. **Rich Metadata**: Document nodes contain structured metadata
3. **Semantic Embeddings**: Mean embedding captures semantic meaning from all related text
4. **Associations Tracked**: Document tracks associations to other nodes
5. **Queryable Tags**: Can query by tag text, tag embedding, or tag associations
6. **Versioning**: Documents can be versioned independently
7. **Context Preservation**: Tags can have context (where they appear)

## Example

```javascript
// Create a concept with tags
const personUuid = await ksg.createNodeWithDocument({
  label: 'John Doe',
  summary: 'A software engineer',
  tags: [
    'person',
    'engineer',
    'software developer',
    'John',
    'Doe'
  ],
  metadata: {
    source: 'user_input',
    confidence: 0.9
  },
  associations: [
    { relationType: 'instanceOf', targetUuid: personProtoUuid, weight: 1.0 }
  ]
});

// Node embedding = mean of:
// - 'John Doe' (label)
// - 'A software engineer' (summary)
// - 'person', 'engineer', 'software developer', 'John', 'Doe' (tags)
// - Related node labels (via associations)
```

## Architecture

```
Node (Concept/Prototype/etc.)
  ├─ UUID
  ├─ Labels, Summary
  ├─ Embedding (mean of all related text)
  └─[has_document]─> Document
      ├─ Metadata
      ├─ Tags (references to tag nodes)
      ├─ Associations (to other nodes)
      └─[has_tag]─> Tag Nodes (text)
          ├─ Text content
          └─ Text embedding
```

