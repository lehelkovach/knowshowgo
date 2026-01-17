/**
 * REST API tests for Assertions (v0.2.0)
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';
import { createApp } from '../src/server/rest-api.js';

describe('Assertions REST API (v0.2.0)', () => {
  let server;
  let baseUrl;
  let ksg;

  beforeAll(async () => {
    ksg = new KnowShowGo({
      embedFn: async (text) => {
        const vec = new Array(384).fill(0);
        for (let i = 0; i < Math.min(text.length, 384); i++) {
          vec[i] = text.charCodeAt(i) / 1000;
        }
        return vec;
      },
      memory: new InMemoryMemory()
    });

    const app = createApp({ ksg });
    server = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const addr = server.address();
    baseUrl = `http://${addr.address}:${addr.port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('POST /api/assertions creates assertion', async () => {
    const res = await fetch(`${baseUrl}/api/assertions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'entity-api-1',
        predicate: 'name',
        object: 'Test'
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uuid).toBeDefined();
    expect(data.subject).toBe('entity-api-1');
    expect(data.predicate).toBe('name');
    expect(data.object).toBe('Test');
    expect(data.truth).toBe(1.0);
  });

  test('GET /api/assertions returns all assertions', async () => {
    // Create a couple assertions
    await ksg.createAssertion({ subject: 'e-get-1', predicate: 'a', object: 'v1' });
    await ksg.createAssertion({ subject: 'e-get-2', predicate: 'b', object: 'v2' });

    const res = await fetch(`${baseUrl}/api/assertions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.assertions.length).toBeGreaterThanOrEqual(2);
  });

  test('GET /api/assertions with filters', async () => {
    await ksg.createAssertion({ subject: 'e-filter-1', predicate: 'name', object: 'Alice' });

    const res = await fetch(`${baseUrl}/api/assertions?subject=e-filter-1`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.assertions.some(a => a.subject === 'e-filter-1')).toBe(true);
  });

  test('GET /api/entities/:id/snapshot returns resolved values', async () => {
    const entityId = 'entity-snapshot-test';
    await ksg.createAssertion({ subject: entityId, predicate: 'name', object: 'Low', truth: 0.3 });
    await ksg.createAssertion({ subject: entityId, predicate: 'name', object: 'High', truth: 0.9 });

    const res = await fetch(`${baseUrl}/api/entities/${entityId}/snapshot`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.snapshot.name).toBe('High'); // Higher truth wins
  });

  test('GET /api/entities/:id/evidence returns all assertions', async () => {
    const entityId = 'entity-evidence-test';
    await ksg.createAssertion({ subject: entityId, predicate: 'color', object: 'red', truth: 0.8 });
    await ksg.createAssertion({ subject: entityId, predicate: 'color', object: 'blue', truth: 0.6 });

    const res = await fetch(`${baseUrl}/api/entities/${entityId}/evidence`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.evidence.length).toBe(2);
    expect(data.evidence[0].object).toBe('red'); // Sorted by truth desc
  });

  test('POST /api/assertions validates required fields', async () => {
    const res = await fetch(`${baseUrl}/api/assertions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predicate: 'name', object: 'Test' }) // Missing subject
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('subject is required');
  });
});
