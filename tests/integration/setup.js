/**
 * Integration Test Setup
 * 
 * Provides test fixtures that work with both mock and live backends.
 * 
 * Usage:
 *   npm test -- tests/integration/           # Mock mode (default)
 *   TEST_LIVE=true npm test -- tests/integration/  # Live mode (requires ArangoDB)
 */

import { KnowShowGo } from '../../src/knowshowgo.js';
import { InMemoryMemory } from '../../src/memory/in-memory.js';
import { createApp } from '../../src/server/rest-api.js';

// Check if live mode is enabled
export const IS_LIVE = process.env.TEST_LIVE === 'true';

// Mock embedding function (deterministic for tests)
export const mockEmbedFn = async (text) => {
  const vec = new Array(128).fill(0);
  for (let i = 0; i < Math.min(text.length, 128); i++) {
    vec[i] = text.charCodeAt(i) / 1000;
  }
  return vec;
};

/**
 * Create a KnowShowGo instance for testing.
 * Uses in-memory backend for mock mode, ArangoDB for live mode.
 */
export async function createTestKSG(options = {}) {
  const embedFn = options.embedFn || mockEmbedFn;
  
  if (IS_LIVE) {
    // Live mode - use ArangoDB
    const { ArangoMemory } = await import('../../src/memory/arango-memory.js');
    
    const memory = new ArangoMemory({
      url: process.env.ARANGO_URL || 'http://localhost:8529',
      database: process.env.ARANGO_DB || 'knowshowgo_test',
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASS || 'changeme'
    });
    
    await memory.connect();
    
    return new KnowShowGo({ embedFn, memory });
  } else {
    // Mock mode - use in-memory
    const memory = new InMemoryMemory();
    return new KnowShowGo({ embedFn, memory });
  }
}

/**
 * Clean up test data.
 */
export async function cleanupTestKSG(ksg) {
  if (IS_LIVE && ksg.memory && ksg.memory.cleanup) {
    await ksg.memory.cleanup();
  }
}

/**
 * Create test server for API integration tests.
 * Returns server, baseUrl, and ksg instance.
 */
export async function createTestServer() {
  const ksg = await createTestKSG();
  const app = createApp({ ksg });
  
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  
  const addr = server.address();
  const baseUrl = `http://${addr.address}:${addr.port}`;
  
  return { server, baseUrl, ksg };
}

/**
 * Close test server.
 */
export async function closeTestServer(server) {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Skip test if in live mode but no connection available.
 */
export function skipIfNoLiveConnection(fn) {
  if (IS_LIVE) {
    return async () => {
      try {
        const ksg = await createTestKSG();
        await cleanupTestKSG(ksg);
        return fn();
      } catch (error) {
        console.warn('Skipping live test - no ArangoDB connection:', error.message);
        return;
      }
    };
  }
  return fn;
}

/**
 * Test fixture: Create a standard prototype.
 */
export async function createTestPrototype(ksg, name = 'TestPrototype') {
  return await ksg.createPrototype({
    name,
    description: `Test prototype: ${name}`,
    context: 'test',
    labels: [name.toLowerCase()],
    embedding: await mockEmbedFn(name)
  });
}

/**
 * Test fixture: Create a standard concept.
 */
export async function createTestConcept(ksg, prototypeUuid, data = {}) {
  const defaultData = {
    name: 'Test Concept',
    value: 42,
    ...data
  };
  
  return await ksg.createConcept({
    prototypeUuid,
    jsonObj: defaultData,
    embedding: await mockEmbedFn(JSON.stringify(defaultData))
  });
}

export default {
  IS_LIVE,
  mockEmbedFn,
  createTestKSG,
  cleanupTestKSG,
  createTestServer,
  closeTestServer,
  skipIfNoLiveConnection,
  createTestPrototype,
  createTestConcept
};
