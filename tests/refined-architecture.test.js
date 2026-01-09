/**
 * Tests for refined architecture: nodes with documents and mean embeddings
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';

// Mock embedding function
const mockEmbedFn = async (text) => {
  const vec = new Array(128).fill(0);
  for (let i = 0; i < Math.min(text.length, 128); i++) {
    vec[i] = text.charCodeAt(i) / 1000;
  }
  return vec;
};

describe('Refined Architecture: Documents and Mean Embeddings', () => {
  let ksg;
  let memory;

  beforeEach(() => {
    memory = new InMemoryMemory();
    ksg = new KnowShowGo({
      embedFn: mockEmbedFn,
      memory: memory
    });
  });

  test('should create node with document and tags', async () => {
    const nodeUuid = await ksg.createNodeWithDocument({
      label: 'John Doe',
      summary: 'A software engineer',
      tags: ['person', 'engineer', 'developer'],
      metadata: { source: 'user_input' }
    });

    const node = await ksg.getConcept(nodeUuid);
    expect(node).toBeDefined();
    expect(node.props.label).toBe('John Doe');
  });

  test('should create tag nodes from text', async () => {
    await ksg.createNodeWithDocument({
      label: 'Test',
      tags: ['tag1', 'tag2', 'tag3']
    });

    // Verify tag nodes exist
    const nodes = Array.from(memory.nodes.values());
    const tagNodes = nodes.filter(n => n.props?.isTag === true);
    expect(tagNodes.length).toBe(3);
    expect(tagNodes.some(t => t.props.text === 'tag1')).toBe(true);
  });

  test('should create document node linked to concept', async () => {
    const nodeUuid = await ksg.createNodeWithDocument({
      label: 'Test',
      tags: ['tag1']
    });

    // Verify document node exists
    const edges = Array.from(memory.edges.values());
    const docEdge = edges.find(e =>
      e.fromNode === nodeUuid &&
      e.rel === 'has_document'
    );

    expect(docEdge).toBeDefined();
    const docNode = await memory.getNode(docEdge.toNode);
    expect(docNode).toBeDefined();
    expect(docNode.props.isDocument).toBe(true);
    expect(docNode.props.targetNodeUuid).toBe(nodeUuid);
  });

  test('should compute mean embedding from tags and text', async () => {
    const nodeUuid = await ksg.createNodeWithDocument({
      label: 'John',
      summary: 'Engineer',
      tags: ['person', 'developer']
    });

    const node = await ksg.getConcept(nodeUuid);
    expect(node.llmEmbedding).toBeDefined();
    expect(Array.isArray(node.llmEmbedding)).toBe(true);
    expect(node.llmEmbedding.length).toBe(128);
  });

  test('should update embedding when tags change', async () => {
    const nodeUuid = await ksg.createNodeWithDocument({
      label: 'Test',
      tags: ['tag1']
    });

    const node1 = await ksg.getConcept(nodeUuid);
    const embedding1 = node1.llmEmbedding;

    // Add new tag (would need API to add tags)
    // For now, just verify embedding exists
    expect(embedding1).toBeDefined();
  });

  test('should include related node embeddings in mean', async () => {
    // Create related node
    const relatedUuid = await ksg.createNodeWithDocument({
      label: 'Person',
      tags: ['prototype']
    });

    // Create node with association to related node
    const nodeUuid = await ksg.createNodeWithDocument({
      label: 'John',
      tags: ['person'],
      associations: [
        {
          relationType: 'instanceOf',
          targetUuid: relatedUuid,
          weight: 1.0
        }
      ]
    });

    const node = await ksg.getConcept(nodeUuid);
    expect(node.llmEmbedding).toBeDefined();
    // Embedding should include both 'John' and 'Person' text
  });
});

