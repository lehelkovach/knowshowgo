/**
 * End-to-End Workflow Integration Tests
 * 
 * Tests complete workflows that span multiple components:
 * - API -> KSG Core -> Memory Backend
 * - ORM -> KSG Core -> Memory Backend
 * - Full agent interaction patterns
 * 
 * Run:
 *   npm test -- tests/integration/e2e-workflow.integration.test.js
 *   TEST_LIVE=true npm test -- tests/integration/e2e-workflow.integration.test.js
 */

import {
  IS_LIVE,
  createTestKSG,
  createTestServer,
  closeTestServer,
  cleanupTestKSG,
  mockEmbedFn
} from './setup.js';

describe(`E2E Workflow Tests (${IS_LIVE ? 'LIVE' : 'MOCK'})`, () => {
  
  describe('Knowledge Base Population Workflow', () => {
    let server, baseUrl, ksg;

    beforeAll(async () => {
      const started = await createTestServer();
      server = started.server;
      baseUrl = started.baseUrl;
      ksg = started.ksg;
    });

    afterAll(async () => {
      await closeTestServer(server);
      await cleanupTestKSG(ksg);
    });

    test('complete knowledge base population flow', async () => {
      // Step 1: Create domain prototype via API
      const protoRes = await fetch(`${baseUrl}/api/prototypes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'ProgrammingLanguage',
          description: 'A programming language',
          labels: ['programming', 'language', 'tech']
        })
      });

      expect(protoRes.status).toBe(200);
      const protoUuid = (await protoRes.json()).uuid;

      // Step 2: Create multiple concepts
      const languages = [
        { name: 'JavaScript', paradigm: 'multi-paradigm', year: 1995 },
        { name: 'Python', paradigm: 'multi-paradigm', year: 1991 },
        { name: 'Rust', paradigm: 'systems', year: 2010 }
      ];

      const conceptUuids = [];
      for (const lang of languages) {
        const res = await fetch(`${baseUrl}/api/concepts`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prototypeUuid: protoUuid,
            jsonObj: lang
          })
        });
        expect(res.status).toBe(200);
        conceptUuids.push((await res.json()).uuid);
      }

      // Step 3: Create associations between concepts
      await fetch(`${baseUrl}/api/associations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromConceptUuid: conceptUuids[0], // JS
          toConceptUuid: conceptUuids[1],    // Python
          relationType: 'similar_to',
          strength: 0.7
        })
      });

      // Step 4: Search for concepts
      const searchRes = await fetch(`${baseUrl}/api/concepts/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'programming language',
          topK: 10
        })
      });

      expect(searchRes.status).toBe(200);
      const searchBody = await searchRes.json();
      expect(searchBody.results.length).toBeGreaterThan(0);

      // Step 5: Retrieve concept and verify
      const getRes = await fetch(`${baseUrl}/api/concepts/${conceptUuids[0]}`);

      expect(getRes.status).toBe(200);
      const concept = await getRes.json();
      expect(concept.props.name).toBe('JavaScript');
    });
  });

  describe('ORM-Based Agent Workflow', () => {
    let ksg;

    beforeAll(async () => {
      ksg = await createTestKSG();
    });

    afterAll(async () => {
      await cleanupTestKSG(ksg);
    });

    test('agent-like memory storage and retrieval', async () => {
      // Step 1: Register prototypes for agent memory
      const Memory = await ksg.orm.registerPrototype('AgentMemory', {
        properties: {
          content: { type: 'string', required: true },
          memoryType: { type: 'string', default: 'observation' },
          importance: { type: 'string', default: '0.5' },
          timestamp: { type: 'string' }
        }
      });

      const Action = await ksg.orm.registerPrototype('AgentAction', {
        properties: {
          name: { type: 'string', required: true },
          params: { type: 'string' },
          result: { type: 'string' },
          successful: { type: 'string' }
        }
      });

      // Step 2: Store memories
      const memories = [
        await Memory.create({
          content: 'User asked about weather',
          memoryType: 'observation',
          importance: '0.6',
          timestamp: new Date().toISOString()
        }),
        await Memory.create({
          content: 'Weather API returned sunny conditions',
          memoryType: 'fact',
          importance: '0.8',
          timestamp: new Date().toISOString()
        }),
        await Memory.create({
          content: 'User seems interested in outdoor activities',
          memoryType: 'inference',
          importance: '0.7',
          timestamp: new Date().toISOString()
        })
      ];

      // Step 3: Store action
      const action = await Action.create({
        name: 'query_weather_api',
        params: JSON.stringify({ location: 'San Francisco' }),
        result: 'sunny, 72°F',
        successful: 'true'
      });

      // Step 4: Create associations (memory -> action relationship)
      await ksg.addAssociation({
        fromConceptUuid: memories[1].uuid,
        toConceptUuid: action.uuid,
        relationType: 'resulted_from',
        strength: 1.0
      });

      // Step 5: Retrieve and verify
      const allMemories = await Memory.find();
      expect(allMemories.length).toBeGreaterThanOrEqual(3);

      const retrievedMemory = await Memory.get(memories[0].uuid);
      const content = await retrievedMemory._getProperty('content');
      expect(content).toBe('User asked about weather');
    });
  });

  describe('Procedure Workflow (OSL Agent Pattern)', () => {
    let server, baseUrl, ksg;

    beforeAll(async () => {
      const started = await createTestServer();
      server = started.server;
      baseUrl = started.baseUrl;
      ksg = started.ksg;
    });

    afterAll(async () => {
      await closeTestServer(server);
      await cleanupTestKSG(ksg);
    });

    test('seed and use OSL agent ontology', async () => {
      // Step 1: Seed OSL agent ontology
      const seedRes = await fetch(`${baseUrl}/api/seed/osl-agent`, { method: 'POST' });
      expect(seedRes.status).toBe(200);
      const seedBody = await seedRes.json();
      expect(seedBody.ok).toBe(true);

      // Step 2: Create a procedure using the seeded prototypes
      const procRes = await fetch(`${baseUrl}/api/procedures`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'E2E Test Procedure',
          description: 'A test procedure for E2E testing',
          steps: [
            { title: 'Initialize', action: 'init' },
            { title: 'Process', action: 'process' },
            { title: 'Finalize', action: 'finalize' }
          ],
          dependencies: [[0, 1], [1, 2]]
        })
      });

      expect(procRes.status).toBe(200);
      const proc = await procRes.json();
      expect(proc.procedure_uuid).toBeDefined();
      expect(proc.step_uuids.length).toBe(3);

      // Step 3: Search for procedures
      const searchRes = await fetch(`${baseUrl}/api/procedures/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'E2E Test', topK: 5 })
      });

      expect(searchRes.status).toBe(200);
      const searchBody = await searchRes.json();
      expect(Array.isArray(searchBody.results)).toBe(true);
    });
  });

  describe('Multi-Prototype Relationship Workflow', () => {
    let ksg;

    beforeAll(async () => {
      ksg = await createTestKSG();
    });

    afterAll(async () => {
      await cleanupTestKSG(ksg);
    });

    test('creating and traversing multi-prototype relationships', async () => {
      // Create prototypes
      const Company = await ksg.orm.registerPrototype('E2ECompany', {
        properties: {
          name: { type: 'string', required: true },
          industry: { type: 'string' }
        }
      });

      const Employee = await ksg.orm.registerPrototype('E2EEmployee', {
        properties: {
          name: { type: 'string', required: true },
          role: { type: 'string' },
          salary: { type: 'string' }
        }
      });

      const Project = await ksg.orm.registerPrototype('E2EProject', {
        properties: {
          name: { type: 'string', required: true },
          status: { type: 'string', default: 'active' },
          budget: { type: 'string' }
        }
      });

      // Create instances
      const techCorp = await Company.create({
        name: 'TechCorp',
        industry: 'Technology'
      });

      const alice = await Employee.create({
        name: 'Alice',
        role: 'Engineer',
        salary: '100000'
      });

      const bob = await Employee.create({
        name: 'Bob',
        role: 'Manager',
        salary: '120000'
      });

      const projectX = await Project.create({
        name: 'Project X',
        status: 'active',
        budget: '500000'
      });

      // Create relationships
      await ksg.addAssociation({
        fromConceptUuid: alice.uuid,
        toConceptUuid: techCorp.uuid,
        relationType: 'works_at',
        strength: 1.0
      });

      await ksg.addAssociation({
        fromConceptUuid: bob.uuid,
        toConceptUuid: techCorp.uuid,
        relationType: 'works_at',
        strength: 1.0
      });

      await ksg.addAssociation({
        fromConceptUuid: alice.uuid,
        toConceptUuid: projectX.uuid,
        relationType: 'assigned_to',
        strength: 0.8
      });

      await ksg.addAssociation({
        fromConceptUuid: bob.uuid,
        toConceptUuid: alice.uuid,
        relationType: 'manages',
        strength: 1.0
      });

      // Verify relationships
      const aliceAssocs = await ksg.getAssociations(alice.uuid, 'both');

      expect(aliceAssocs.length).toBeGreaterThanOrEqual(3);
      
      const managedBy = aliceAssocs.find(a => 
        a.rel === 'manages' && 
        a.toNode === alice.uuid
      );
      expect(managedBy).toBeDefined();
    });
  });

  describe('Search and Similarity Workflow', () => {
    let ksg;

    beforeAll(async () => {
      ksg = await createTestKSG();
    });

    afterAll(async () => {
      await cleanupTestKSG(ksg);
    });

    test('semantic search across multiple concepts', async () => {
      // Create prototype
      const articleProtoUuid = await ksg.createPrototype({
        name: 'E2EArticle',
        description: 'An article',
        embedding: await mockEmbedFn('Article document')
      });

      // Create articles with different topics
      const articles = [
        { title: 'Introduction to Machine Learning', content: 'ML basics', category: 'AI' },
        { title: 'Deep Learning Neural Networks', content: 'Neural network architectures', category: 'AI' },
        { title: 'Cooking Italian Pasta', content: 'Pasta recipes', category: 'Food' },
        { title: 'Web Development with JavaScript', content: 'JS web apps', category: 'Programming' }
      ];

      for (const article of articles) {
        await ksg.createConcept({
          prototypeUuid: articleProtoUuid,
          jsonObj: article,
          embedding: await mockEmbedFn(article.title + ' ' + article.content)
        });
      }

      // Search for AI-related articles
      const searchResults = await ksg.searchConcepts({
        query: 'artificial intelligence machine learning',
        topK: 5,
        similarityThreshold: 0.1
      });

      expect(searchResults.length).toBeGreaterThan(0);
    });
  });
});

describe('Error Recovery and Edge Cases', () => {
  let ksg;

  beforeAll(async () => {
    ksg = await createTestKSG();
  });

  afterAll(async () => {
    await cleanupTestKSG(ksg);
  });

  test('handles concurrent operations gracefully', async () => {
    const TestClass = await ksg.orm.registerPrototype('ConcurrentTest', {
      properties: {
        value: { type: 'number' }
      }
    });

    // Create multiple instances concurrently
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(TestClass.create({ value: i }));
    }

    const results = await Promise.all(promises);
    
    expect(results.length).toBe(10);
    results.forEach((r, i) => {
      expect(r.uuid).toBeDefined();
      expect(r.value).toBe(i);
    });
  });

  test('handles empty search gracefully', async () => {
    const results = await ksg.searchConcepts({
      query: 'xyz-nonexistent-term-12345',
      topK: 5
    });

    expect(Array.isArray(results)).toBe(true);
    // May return results with low similarity or empty array
  });

  test('handles invalid UUID lookups gracefully', async () => {
    const concept = await ksg.getConcept('invalid-uuid-12345');
    expect(concept).toBeNull();
  });
});
