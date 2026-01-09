/**
 * End-to-end REST API tests (Express server + HTTP).
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';
import { createApp } from '../src/server/rest-api.js';

const mockEmbedFn = async (text) => {
  const vec = new Array(128).fill(0);
  for (let i = 0; i < Math.min(text.length, 128); i++) {
    vec[i] = text.charCodeAt(i) / 1000;
  }
  return vec;
};

async function startServer() {
  const memory = new InMemoryMemory();
  const ksg = new KnowShowGo({ embedFn: mockEmbedFn, memory });
  const app = createApp({ ksg });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const addr = server.address();
  const baseUrl = `http://${addr.address}:${addr.port}`;

  return { server, baseUrl };
}

describe('REST API', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    baseUrl = started.baseUrl;
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  test('health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('knowshowgo-api');
  });

  test('prototypes + concepts + search', async () => {
    // create prototype
    const protoRes = await fetch(`${baseUrl}/api/prototypes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Person', description: 'A person', context: 'identity' })
    });
    expect(protoRes.status).toBe(200);
    const proto = await protoRes.json();
    expect(proto.uuid).toBeDefined();

    // get prototype
    const getProtoRes = await fetch(`${baseUrl}/api/prototypes/${proto.uuid}`);
    expect(getProtoRes.status).toBe(200);
    const protoNode = await getProtoRes.json();
    expect(protoNode.props.isPrototype).toBe(true);

    // create concept
    const cRes = await fetch(`${baseUrl}/api/concepts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prototypeUuid: proto.uuid,
        jsonObj: { name: 'John Doe', email: 'john@example.com' }
      })
    });
    expect(cRes.status).toBe(200);
    const concept = await cRes.json();
    expect(concept.uuid).toBeDefined();

    // get concept
    const getCRes = await fetch(`${baseUrl}/api/concepts/${concept.uuid}`);
    expect(getCRes.status).toBe(200);
    const conceptNode = await getCRes.json();
    expect(conceptNode.props.name).toBe('John Doe');

    // search concepts
    const searchRes = await fetch(`${baseUrl}/api/concepts/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'John Doe', topK: 5 })
    });
    expect(searchRes.status).toBe(200);
    const searchBody = await searchRes.json();
    expect(Array.isArray(searchBody.results)).toBe(true);
    expect(searchBody.results.length).toBeGreaterThan(0);
  });

  test('associations', async () => {
    const proto = await (await fetch(`${baseUrl}/api/prototypes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Person', context: 'test' })
    })).json();

    const a = await (await fetch(`${baseUrl}/api/concepts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prototypeUuid: proto.uuid, jsonObj: { name: 'Alice' } })
    })).json();

    const b = await (await fetch(`${baseUrl}/api/concepts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prototypeUuid: proto.uuid, jsonObj: { name: 'Bob' } })
    })).json();

    const assocRes = await fetch(`${baseUrl}/api/associations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fromConceptUuid: a.uuid,
        toConceptUuid: b.uuid,
        relationType: 'knows',
        strength: 0.8
      })
    });
    expect(assocRes.status).toBe(200);

    const listRes = await fetch(`${baseUrl}/api/associations/${a.uuid}?direction=outgoing`);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.associations.some(e => e.rel === 'knows')).toBe(true);
  });

  test('node with document + embedding update', async () => {
    const nodeRes = await fetch(`${baseUrl}/api/nodes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        label: 'DocNode',
        summary: 'a summary',
        tags: ['tag one', 'tag two'],
        metadata: { source: 'test' }
      })
    });
    expect(nodeRes.status).toBe(200);
    const node = await nodeRes.json();
    expect(node.uuid).toBeDefined();

    const embRes = await fetch(`${baseUrl}/api/nodes/${node.uuid}/embedding`, { method: 'POST' });
    expect(embRes.status).toBe(200);
    const embBody = await embRes.json();
    expect(embBody.success).toBe(true);
  });

  test('orm register + create + get', async () => {
    const regRes = await fetch(`${baseUrl}/api/orm/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prototypeName: 'Person',
        options: { properties: { name: { type: 'string' }, email: { type: 'string' } } }
      })
    });
    expect(regRes.status).toBe(200);

    const createRes = await fetch(`${baseUrl}/api/orm/Person/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ properties: { name: 'John Doe', email: 'john@example.com' } })
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.uuid).toBeDefined();
    expect(created.email).toBe('john@example.com');

    const getRes = await fetch(`${baseUrl}/api/orm/Person/${created.uuid}`);
    expect(getRes.status).toBe(200);
    const got = await getRes.json();
    expect(got.uuid).toBe(created.uuid);
    expect(got.email).toBe('john@example.com');
  });
});

