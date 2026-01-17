/**
 * Integration tests for Assertions (v0.2.0)
 * Tests the actual implementation in KnowShowGo
 */

import { KnowShowGo } from '../src/knowshowgo.js';
import { InMemoryMemory } from '../src/memory/in-memory.js';

describe('Assertions v0.2.0', () => {
  let ksg;

  beforeEach(() => {
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
  });

  describe('createAssertion', () => {
    test('should create assertion with minimal fields', async () => {
      const assertion = await ksg.createAssertion({
        subject: 'entity-123',
        predicate: 'name',
        object: 'John'
      });

      expect(assertion.uuid).toBeDefined();
      expect(assertion.subject).toBe('entity-123');
      expect(assertion.predicate).toBe('name');
      expect(assertion.object).toBe('John');
      expect(assertion.truth).toBe(1.0);
      expect(assertion.source).toBe('user');
      expect(assertion.createdAt).toBeDefined();
    });

    test('should create assertion with custom truth value', async () => {
      const assertion = await ksg.createAssertion({
        subject: 'entity-123',
        predicate: 'age',
        object: 30,
        truth: 0.9
      });

      expect(assertion.truth).toBe(0.9);
    });

    test('should create assertion with custom source', async () => {
      const assertion = await ksg.createAssertion({
        subject: 'entity-123',
        predicate: 'status',
        object: 'active',
        source: 'agent'
      });

      expect(assertion.source).toBe('agent');
    });

    test('should reject invalid truth values', async () => {
      await expect(ksg.createAssertion({
        subject: 'entity-123',
        predicate: 'name',
        object: 'John',
        truth: 1.5
      })).rejects.toThrow('truth must be a number between 0 and 1');

      await expect(ksg.createAssertion({
        subject: 'entity-123',
        predicate: 'name',
        object: 'John',
        truth: -0.1
      })).rejects.toThrow('truth must be a number between 0 and 1');
    });

    test('should require subject, predicate, object', async () => {
      await expect(ksg.createAssertion({
        predicate: 'name',
        object: 'John'
      })).rejects.toThrow('subject is required');

      await expect(ksg.createAssertion({
        subject: 'entity-123',
        object: 'John'
      })).rejects.toThrow('predicate is required');

      await expect(ksg.createAssertion({
        subject: 'entity-123',
        predicate: 'name'
      })).rejects.toThrow('object is required');
    });
  });

  describe('getAssertions', () => {
    test('should get all assertions without filters', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John' });
      await ksg.createAssertion({ subject: 'e2', predicate: 'name', object: 'Jane' });

      const assertions = await ksg.getAssertions();

      expect(assertions).toHaveLength(2);
    });

    test('should filter by subject', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John' });
      await ksg.createAssertion({ subject: 'e2', predicate: 'name', object: 'Jane' });

      const assertions = await ksg.getAssertions({ subject: 'e1' });

      expect(assertions).toHaveLength(1);
      expect(assertions[0].object).toBe('John');
    });

    test('should filter by predicate', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John' });
      await ksg.createAssertion({ subject: 'e1', predicate: 'age', object: 30 });

      const assertions = await ksg.getAssertions({ predicate: 'age' });

      expect(assertions).toHaveLength(1);
      expect(assertions[0].object).toBe(30);
    });

    test('should filter by multiple criteria', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John' });
      await ksg.createAssertion({ subject: 'e1', predicate: 'age', object: 30 });
      await ksg.createAssertion({ subject: 'e2', predicate: 'name', object: 'Jane' });

      const assertions = await ksg.getAssertions({ subject: 'e1', predicate: 'name' });

      expect(assertions).toHaveLength(1);
      expect(assertions[0].object).toBe('John');
    });
  });

  describe('snapshot (Simple Resolver)', () => {
    test('should return empty snapshot for entity with no assertions', async () => {
      const snapshot = await ksg.snapshot('nonexistent');

      expect(snapshot).toEqual({});
    });

    test('should return single value per predicate', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John' });
      await ksg.createAssertion({ subject: 'e1', predicate: 'age', object: 30 });

      const snapshot = await ksg.snapshot('e1');

      expect(snapshot.name).toBe('John');
      expect(snapshot.age).toBe(30);
    });

    test('should pick highest truth value', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John', truth: 0.5 });
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'Johnny', truth: 0.9 });

      const snapshot = await ksg.snapshot('e1');

      expect(snapshot.name).toBe('Johnny');
    });

    test('should tiebreak by most recent', async () => {
      const a1 = await ksg.createAssertion({ subject: 'e1', predicate: 'status', object: 'active', truth: 0.8 });
      // Small delay to ensure different timestamps
      await new Promise(r => setTimeout(r, 10));
      const a2 = await ksg.createAssertion({ subject: 'e1', predicate: 'status', object: 'pending', truth: 0.8 });

      const snapshot = await ksg.snapshot('e1');

      // Most recent should win when truth is equal
      expect(snapshot.status).toBe('pending');
    });
  });

  describe('evidence', () => {
    test('should return all assertions for entity', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John', truth: 0.9 });
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'Johnny', truth: 0.5 });

      const evidence = await ksg.evidence('e1');

      expect(evidence).toHaveLength(2);
    });

    test('should filter by predicate', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John' });
      await ksg.createAssertion({ subject: 'e1', predicate: 'age', object: 30 });

      const evidence = await ksg.evidence('e1', 'name');

      expect(evidence).toHaveLength(1);
      expect(evidence[0].predicate).toBe('name');
    });

    test('should return sorted by score (truth desc, recency desc)', async () => {
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'John', truth: 0.5 });
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'Johnny', truth: 0.9 });
      await ksg.createAssertion({ subject: 'e1', predicate: 'name', object: 'Jon', truth: 0.7 });

      const evidence = await ksg.evidence('e1');

      expect(evidence[0].object).toBe('Johnny'); // Highest truth
      expect(evidence[1].object).toBe('Jon');    // Second highest
      expect(evidence[2].object).toBe('John');   // Lowest
    });
  });
});
