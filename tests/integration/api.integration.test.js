/**
 * API Integration Tests
 * 
 * Tests the REST API endpoints with both mock and live backends.
 * 
 * Run:
 *   npm test -- tests/integration/api.integration.test.js
 *   TEST_LIVE=true npm test -- tests/integration/api.integration.test.js
 */

import {
  IS_LIVE,
  createTestServer,
  closeTestServer,
  cleanupTestKSG
} from './setup.js';

describe(`API Integration Tests (${IS_LIVE ? 'LIVE' : 'MOCK'})`, () => {
  let server;
  let baseUrl;
  let ksg;

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

  describe('Health Endpoint', () => {
    test('GET /health returns status ok', async () => {
      const res = await fetch(`${baseUrl}/health`);
      
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('knowshowgo-api');
    });
  });

  describe('Prototype CRUD', () => {
    let prototypeUuid;

    test('POST /api/prototypes creates prototype', async () => {
      const res = await fetch(`${baseUrl}/api/prototypes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'IntegrationTestPerson',
          description: 'A person for integration testing',
          labels: ['person', 'test']
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('uuid');
      
      prototypeUuid = body.uuid;
    });

    test('GET /api/prototypes/:uuid retrieves prototype', async () => {
      const res = await fetch(`${baseUrl}/api/prototypes/${prototypeUuid}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uuid).toBe(prototypeUuid);
      expect(body.props.name).toBe('IntegrationTestPerson');
    });

    test('GET /api/prototypes/:uuid returns 404 for non-existent', async () => {
      const res = await fetch(`${baseUrl}/api/prototypes/non-existent-uuid`);
      expect(res.status).toBe(404);
    });
  });

  describe('Concept CRUD', () => {
    let prototypeUuid;
    let conceptUuid;

    beforeAll(async () => {
      // Create a prototype first
      const res = await fetch(`${baseUrl}/api/prototypes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'ConceptTestPrototype',
          description: 'Prototype for concept tests'
        })
      });
      const body = await res.json();
      prototypeUuid = body.uuid;
    });

    test('POST /api/concepts creates concept', async () => {
      const res = await fetch(`${baseUrl}/api/concepts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prototypeUuid,
          jsonObj: {
            name: 'John Doe',
            email: 'john@example.com',
            age: 30
          }
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('uuid');
      
      conceptUuid = body.uuid;
    });

    test('GET /api/concepts/:uuid retrieves concept', async () => {
      const res = await fetch(`${baseUrl}/api/concepts/${conceptUuid}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uuid).toBe(conceptUuid);
      expect(body.props.name).toBe('John Doe');
    });

    test('POST /api/concepts/search finds concepts', async () => {
      const res = await fetch(`${baseUrl}/api/concepts/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'John',
          topK: 5
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('results');
      expect(Array.isArray(body.results)).toBe(true);
    });
  });

  describe('Associations', () => {
    let proto1Uuid, proto2Uuid;
    let concept1Uuid, concept2Uuid;

    beforeAll(async () => {
      // Create prototypes
      const p1 = await fetch(`${baseUrl}/api/prototypes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'AssocTestProto1', description: 'First' })
      });
      proto1Uuid = (await p1.json()).uuid;

      const p2 = await fetch(`${baseUrl}/api/prototypes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'AssocTestProto2', description: 'Second' })
      });
      proto2Uuid = (await p2.json()).uuid;

      // Create concepts
      const c1 = await fetch(`${baseUrl}/api/concepts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prototypeUuid: proto1Uuid, jsonObj: { name: 'Concept1' } })
      });
      concept1Uuid = (await c1.json()).uuid;

      const c2 = await fetch(`${baseUrl}/api/concepts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prototypeUuid: proto2Uuid, jsonObj: { name: 'Concept2' } })
      });
      concept2Uuid = (await c2.json()).uuid;
    });

    test('POST /api/associations creates association', async () => {
      const res = await fetch(`${baseUrl}/api/associations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromConceptUuid: concept1Uuid,
          toConceptUuid: concept2Uuid,
          relationType: 'related_to',
          strength: 0.8
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('GET /api/associations/:uuid retrieves associations', async () => {
      // Create another association to retrieve
      await fetch(`${baseUrl}/api/associations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fromConceptUuid: concept2Uuid,
          toConceptUuid: concept1Uuid,
          relationType: 'knows',
          strength: 0.9
        })
      });

      const res = await fetch(`${baseUrl}/api/associations/${concept2Uuid}?direction=outgoing`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('associations');
      expect(body.associations.some(e => e.rel === 'knows')).toBe(true);
    });
  });

  describe('Nodes (with Documents)', () => {
    test('POST /api/nodes creates node', async () => {
      const res = await fetch(`${baseUrl}/api/nodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: 'Test Node',
          summary: 'A test node summary',
          tags: ['test', 'integration'],
          metadata: { source: 'integration-test' }
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('uuid');
    });

    test('POST /api/knodes creates knode', async () => {
      const res = await fetch(`${baseUrl}/api/knodes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: 'Test Knode',
          summary: 'A test knode',
          tags: ['knode', 'test'],
          metadata: { type: 'integration' }
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('uuid');
    });
  });

  describe('OSL Agent Seed', () => {
    test('POST /api/seed/osl-agent seeds ontology', async () => {
      const res = await fetch(`${baseUrl}/api/seed/osl-agent`, {
        method: 'POST'
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.report).toBeDefined();
    });
  });

  describe('ORM Endpoints', () => {
    test('POST /api/orm/register registers prototype', async () => {
      const res = await fetch(`${baseUrl}/api/orm/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prototypeName: 'IntegrationTask',
          options: {
            properties: {
              title: { type: 'string' },
              done: { type: 'boolean' }
            }
          }
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('POST /api/orm/:prototypeName/create creates instance', async () => {
      // First register
      await fetch(`${baseUrl}/api/orm/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prototypeName: 'IntegrationItem',
          options: {
            properties: {
              name: { type: 'string' },
              qty: { type: 'number' }
            }
          }
        })
      });

      const res = await fetch(`${baseUrl}/api/orm/IntegrationItem/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          properties: { name: 'Widget', qty: 10 }
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uuid).toBeDefined();
      expect(body.name).toBe('Widget');
      expect(body.qty).toBe(10);
    });

    test('GET /api/orm/:prototypeName/:uuid retrieves instance', async () => {
      // Register and create
      await fetch(`${baseUrl}/api/orm/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prototypeName: 'IntegrationEntity',
          options: {
            properties: { label: { type: 'string' } }
          }
        })
      });

      const createRes = await fetch(`${baseUrl}/api/orm/IntegrationEntity/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          properties: { label: 'TestEntity' }
        })
      });
      const created = await createRes.json();

      const res = await fetch(`${baseUrl}/api/orm/IntegrationEntity/${created.uuid}`);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uuid).toBe(created.uuid);
      expect(body.label).toBe('TestEntity');
    });
  });

  describe('Procedures (OSL Agent Pattern)', () => {
    test('POST /api/procedures creates procedure with steps', async () => {
      const res = await fetch(`${baseUrl}/api/procedures`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Integration Test Procedure',
          description: 'A procedure for testing',
          steps: [
            { title: 'Step 1', payload: 'init' },
            { title: 'Step 2', payload: 'process' },
            { title: 'Step 3', payload: 'complete' }
          ],
          dependencies: [[0, 1], [1, 2]]
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.procedure_uuid).toBeDefined();
      expect(body.step_uuids).toHaveLength(3);
    });

    test('POST /api/procedures/search finds procedures', async () => {
      const res = await fetch(`${baseUrl}/api/procedures/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: 'Integration Test Procedure',
          topK: 5
        })
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.results)).toBe(true);
    });

    test('POST /api/procedures rejects cyclic dependencies', async () => {
      const res = await fetch(`${baseUrl}/api/procedures`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Cyclic Procedure',
          description: 'Should fail',
          steps: [
            { title: 'A' },
            { title: 'B' },
            { title: 'C' }
          ],
          dependencies: [[0, 1], [1, 2], [2, 0]] // Cycle: A->B->C->A
        })
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('cycle_detected');
    });
  });
});
