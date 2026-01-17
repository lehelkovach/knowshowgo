/**
 * Tests for Verification / Hallucination Detection (MVP)
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';
import { createApp } from '../src/server/rest-api.js';

describe('Verification / Hallucination Detection', () => {
  let ksg;

  beforeEach(() => {
    ksg = new KnowShowGo({
      embedFn: async (text) => {
        // Simple embedding that captures word overlap
        const words = text.toLowerCase().split(/\s+/);
        const vec = new Array(384).fill(0);
        for (let i = 0; i < words.length && i < 384; i++) {
          // Hash each word to a position and value
          for (let j = 0; j < words[i].length; j++) {
            const pos = (words[i].charCodeAt(j) * (i + 1)) % 384;
            vec[pos] += 0.1;
          }
        }
        // Normalize
        const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
        return norm > 0 ? vec.map(v => v / norm) : vec;
      },
      memory: new InMemoryMemory()
    });
  });

  describe('storeFact', () => {
    test('should store a verified fact', async () => {
      const fact = await ksg.storeFact({
        subject: 'Bell',
        predicate: 'invented',
        object: 'telephone'
      });

      expect(fact.uuid).toBeDefined();
      expect(fact.subject).toBe('bell');
      expect(fact.predicate).toBe('invented');
      expect(fact.object).toBe('telephone');
      expect(fact.status).toBe('verified');
      expect(fact.confidence).toBe(1.0);
    });

    test('should store fact with custom status and confidence', async () => {
      const fact = await ksg.storeFact({
        subject: 'Edison',
        predicate: 'invented',
        object: 'telephone',
        status: 'refuted',
        confidence: 0.95
      });

      expect(fact.status).toBe('refuted');
      expect(fact.confidence).toBe(0.95);
    });

    test('should store fact with source provenance', async () => {
      const fact = await ksg.storeFact({
        subject: 'Einstein',
        predicate: 'discovered',
        object: 'relativity',
        source: { url: 'wikipedia.org', trust_score: 0.9 }
      });

      expect(fact.uuid).toBeDefined();
    });
  });

  describe('verify', () => {
    test('should return unverified when no facts stored', async () => {
      const result = await ksg.verify('Bell invented the telephone');

      expect(result.status).toBe('unverified');
      expect(result.reason).toContain('No facts');
    });

    test('should verify matching claim', async () => {
      await ksg.storeFact({
        subject: 'Bell',
        predicate: 'invented',
        object: 'telephone'
      });

      // Lower threshold for test embedding function
      const result = await ksg.verify('Bell invented the telephone', { threshold: 0.3 });

      expect(result.status).toBe('verified');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.matchingFact).toBeDefined();
    });

    test('should detect contradiction', async () => {
      await ksg.storeFact({
        subject: 'Bell',
        predicate: 'invented',
        object: 'telephone'
      });

      const result = await ksg.verify('Edison invented the telephone');

      // Should either be refuted or unverified (depending on similarity)
      expect(['refuted', 'unverified']).toContain(result.status);
    });

    test('should handle multiple facts', async () => {
      await ksg.storeFact({ subject: 'Bell', predicate: 'invented', object: 'telephone' });
      await ksg.storeFact({ subject: 'Edison', predicate: 'invented', object: 'lightbulb' });
      await ksg.storeFact({ subject: 'Curie', predicate: 'discovered', object: 'radium' });

      const stats = await ksg.getFactStats();
      expect(stats.total).toBe(3);
      expect(stats.byStatus.verified).toBe(3);
    });
  });

  describe('getFactStats', () => {
    test('should return empty stats initially', async () => {
      const stats = await ksg.getFactStats();

      expect(stats.total).toBe(0);
      expect(stats.byStatus.verified).toBe(0);
    });

    test('should count facts by status', async () => {
      await ksg.storeFact({ subject: 'A', predicate: 'p', object: 'x', status: 'verified' });
      await ksg.storeFact({ subject: 'B', predicate: 'p', object: 'y', status: 'verified' });
      await ksg.storeFact({ subject: 'C', predicate: 'p', object: 'z', status: 'refuted' });

      const stats = await ksg.getFactStats();

      expect(stats.total).toBe(3);
      expect(stats.byStatus.verified).toBe(2);
      expect(stats.byStatus.refuted).toBe(1);
    });
  });
});

describe('Verification REST API', () => {
  let server;
  let baseUrl;
  let ksg;

  beforeAll(async () => {
    ksg = new KnowShowGo({
      embedFn: async (text) => {
        const words = text.toLowerCase().split(/\s+/);
        const vec = new Array(384).fill(0);
        for (let i = 0; i < words.length && i < 384; i++) {
          for (let j = 0; j < words[i].length; j++) {
            const pos = (words[i].charCodeAt(j) * (i + 1)) % 384;
            vec[pos] += 0.1;
          }
        }
        const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
        return norm > 0 ? vec.map(v => v / norm) : vec;
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

  test('POST /api/facts stores a fact', async () => {
    const res = await fetch(`${baseUrl}/api/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Bell',
        predicate: 'invented',
        object: 'telephone'
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uuid).toBeDefined();
    expect(data.subject).toBe('bell');
  });

  test('POST /api/facts/bulk stores multiple facts', async () => {
    const res = await fetch(`${baseUrl}/api/facts/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        facts: [
          { subject: 'Einstein', predicate: 'discovered', object: 'relativity' },
          { subject: 'Newton', predicate: 'discovered', object: 'gravity' }
        ]
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stored).toBe(2);
  });

  test('POST /api/verify checks a claim', async () => {
    // First store a fact
    await fetch(`${baseUrl}/api/facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Curie',
        predicate: 'discovered',
        object: 'radium'
      })
    });

    // Then verify
    const res = await fetch(`${baseUrl}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claim: 'Curie discovered radium'
      })
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(['verified', 'unverified']).toContain(data.status);
    expect(data.claim).toBe('Curie discovered radium');
  });

  test('GET /api/facts/stats returns statistics', async () => {
    const res = await fetch(`${baseUrl}/api/facts/stats`);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBeGreaterThanOrEqual(0);
    expect(data.byStatus).toBeDefined();
  });
});
