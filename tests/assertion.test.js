/**
 * Tests for the Assertion model and WTA resolution
 * These tests validate the architecture from opus-plans.md
 */

import { v4 as uuidv4 } from 'uuid';

// Mock Assertion class (to be implemented in src/models.js)
class Assertion {
  constructor({
    subject,
    predicate,
    object,
    truth = 1.0,
    strength = 1.0,
    voteScore = 0,
    sourceRel = 1.0,
    provenance = null,
    status = 'accepted',
    uuid = uuidv4(),
    prevAssertionId = null
  }) {
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.truth = truth;
    this.strength = strength;
    this.voteScore = voteScore;
    this.sourceRel = sourceRel;
    this.provenance = provenance;
    this.status = status;
    this.uuid = uuid;
    this.prevAssertionId = prevAssertionId;
    this.createdAt = new Date().toISOString();
  }
}

// Mock WTA Resolver (to be implemented in src/resolution/wta-resolver.js)
const DEFAULT_POLICY = {
  weights: {
    truth: 0.45,
    voteScore: 0.20,
    sourceRel: 0.15,
    recency: 0.10,
    strength: 0.10
  },
  recencyHalfLife: 7 * 24 * 60 * 60 * 1000,
  minTruthThreshold: 0.0,
  tieBreaker: 'mostRecent'
};

class WTAResolver {
  constructor(policy = DEFAULT_POLICY) {
    this.policy = policy;
  }

  scoreAssertion(assertion, now = Date.now()) {
    const w = this.policy.weights;
    const age = now - new Date(assertion.createdAt).getTime();
    const recencyScore = Math.exp(-age / this.policy.recencyHalfLife);
    const normVote = 1 / (1 + Math.exp(-assertion.voteScore / 10));

    return (
      w.truth * assertion.truth +
      w.voteScore * normVote +
      w.sourceRel * assertion.sourceRel +
      w.recency * recencyScore +
      w.strength * assertion.strength
    );
  }

  resolve(assertions) {
    const byPredicate = {};
    for (const a of assertions) {
      const key = a.predicate;
      if (!byPredicate[key]) byPredicate[key] = [];
      byPredicate[key].push(a);
    }

    const snapshot = {};
    const evidence = {};

    for (const [predKey, candidates] of Object.entries(byPredicate)) {
      const scored = candidates
        .map(a => ({ assertion: a, score: this.scoreAssertion(a) }))
        .sort((x, y) => y.score - x.score);

      const winner = scored[0];
      snapshot[predKey] = {
        value: winner.assertion.object,
        assertionId: winner.assertion.uuid,
        truth: winner.assertion.truth,
        score: winner.score
      };

      evidence[predKey] = scored.map(s => ({
        assertionId: s.assertion.uuid,
        value: s.assertion.object,
        score: s.score,
        truth: s.assertion.truth
      }));
    }

    return { snapshot, evidence };
  }
}

describe('Assertion Model', () => {
  test('should create assertion with required fields', () => {
    const assertion = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40
    });

    expect(assertion.subject).toBe('entity-123');
    expect(assertion.predicate).toBe('hasAge');
    expect(assertion.object).toBe(40);
    expect(assertion.truth).toBe(1.0);
    expect(assertion.strength).toBe(1.0);
    expect(assertion.voteScore).toBe(0);
    expect(assertion.status).toBe('accepted');
    expect(assertion.uuid).toBeDefined();
    expect(assertion.createdAt).toBeDefined();
  });

  test('should create assertion with custom truth/strength', () => {
    const assertion = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40,
      truth: 0.8,
      strength: 0.9,
      voteScore: 5
    });

    expect(assertion.truth).toBe(0.8);
    expect(assertion.strength).toBe(0.9);
    expect(assertion.voteScore).toBe(5);
  });

  test('should support provenance tracking', () => {
    const assertion = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40,
      provenance: {
        source: 'user-input',
        userId: 'user-456',
        timestamp: '2026-01-14'
      }
    });

    expect(assertion.provenance).toEqual({
      source: 'user-input',
      userId: 'user-456',
      timestamp: '2026-01-14'
    });
  });

  test('should support version chaining', () => {
    const original = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 39
    });

    const updated = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40,
      prevAssertionId: original.uuid
    });

    expect(updated.prevAssertionId).toBe(original.uuid);
  });
});

describe('WTA Resolution', () => {
  test('should score assertion based on policy weights', () => {
    const resolver = new WTAResolver();
    const assertion = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40,
      truth: 1.0,
      strength: 1.0,
      voteScore: 0,
      sourceRel: 1.0
    });

    const score = resolver.scoreAssertion(assertion);
    
    // Score should be between 0 and 1 (sum of weighted components)
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  test('should pick higher truth assertion as winner', () => {
    const resolver = new WTAResolver();
    
    const lowTruth = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 39,
      truth: 0.5
    });

    const highTruth = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40,
      truth: 0.95
    });

    const { snapshot, evidence } = resolver.resolve([lowTruth, highTruth]);

    expect(snapshot.hasAge.value).toBe(40);
    expect(snapshot.hasAge.truth).toBe(0.95);
    expect(evidence.hasAge).toHaveLength(2);
    expect(evidence.hasAge[0].value).toBe(40); // Winner first
  });

  test('should resolve multiple predicates independently', () => {
    const resolver = new WTAResolver();

    const assertions = [
      new Assertion({ subject: 'bob', predicate: 'hasAge', object: 40, truth: 0.9 }),
      new Assertion({ subject: 'bob', predicate: 'hasAge', object: 39, truth: 0.5 }),
      new Assertion({ subject: 'bob', predicate: 'worksFor', object: 'acme', truth: 1.0 }),
      new Assertion({ subject: 'bob', predicate: 'worksFor', object: 'globex', truth: 0.3 })
    ];

    const { snapshot } = resolver.resolve(assertions);

    expect(snapshot.hasAge.value).toBe(40);
    expect(snapshot.worksFor.value).toBe('acme');
  });

  test('should consider voteScore in resolution', () => {
    const resolver = new WTAResolver();

    // Same truth, but different votes
    const lowVotes = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 39,
      truth: 0.8,
      voteScore: -5
    });

    const highVotes = new Assertion({
      subject: 'entity-123',
      predicate: 'hasAge',
      object: 40,
      truth: 0.8,
      voteScore: 10
    });

    const { snapshot } = resolver.resolve([lowVotes, highVotes]);

    expect(snapshot.hasAge.value).toBe(40); // Higher votes wins
  });

  test('should return evidence with all candidates', () => {
    const resolver = new WTAResolver();

    const assertions = [
      new Assertion({ subject: 'bob', predicate: 'hasAge', object: 40, truth: 0.9 }),
      new Assertion({ subject: 'bob', predicate: 'hasAge', object: 39, truth: 0.7 }),
      new Assertion({ subject: 'bob', predicate: 'hasAge', object: 38, truth: 0.5 })
    ];

    const { evidence } = resolver.resolve(assertions);

    expect(evidence.hasAge).toHaveLength(3);
    // Should be sorted by score (descending)
    expect(evidence.hasAge[0].truth).toBe(0.9);
    expect(evidence.hasAge[1].truth).toBe(0.7);
    expect(evidence.hasAge[2].truth).toBe(0.5);
  });
});

describe('Working Memory (Conceptual)', () => {
  // Mock WorkingMemoryGraph
  class WorkingMemoryGraph {
    constructor({ reinforceDelta = 1.0, maxWeight = 100.0, decayRate = 0.1 } = {}) {
      this.weights = new Map();
      this.reinforceDelta = reinforceDelta;
      this.maxWeight = maxWeight;
      this.decayRate = decayRate;
    }

    link(from, to, initialWeight = 1.0) {
      const key = `${from}:${to}`;
      if (!this.weights.has(key)) {
        this.weights.set(key, initialWeight);
      }
      return this.weights.get(key);
    }

    access(from, to) {
      const key = `${from}:${to}`;
      const current = this.weights.get(key) || 0;
      const newWeight = Math.min(current + this.reinforceDelta, this.maxWeight);
      this.weights.set(key, newWeight);
      return newWeight;
    }

    decayAll() {
      for (const [key, weight] of this.weights.entries()) {
        const decayed = weight * (1 - this.decayRate);
        if (decayed < 0.01) {
          this.weights.delete(key);
        } else {
          this.weights.set(key, decayed);
        }
      }
    }

    getWeight(from, to) {
      return this.weights.get(`${from}:${to}`) || 0;
    }
  }

  test('should create link between entities', () => {
    const wm = new WorkingMemoryGraph();
    const weight = wm.link('entity-1', 'entity-2');
    
    expect(weight).toBe(1.0);
    expect(wm.getWeight('entity-1', 'entity-2')).toBe(1.0);
  });

  test('should reinforce link on access (Hebbian)', () => {
    const wm = new WorkingMemoryGraph({ reinforceDelta: 1.0 });
    
    wm.link('entity-1', 'entity-2', 1.0);
    
    const weight1 = wm.access('entity-1', 'entity-2');
    expect(weight1).toBe(2.0);
    
    const weight2 = wm.access('entity-1', 'entity-2');
    expect(weight2).toBe(3.0);
  });

  test('should respect max weight cap', () => {
    const wm = new WorkingMemoryGraph({ reinforceDelta: 50.0, maxWeight: 100.0 });
    
    wm.link('entity-1', 'entity-2', 80.0);
    const weight = wm.access('entity-1', 'entity-2');
    
    expect(weight).toBe(100.0); // Capped at max
  });

  test('should decay all weights', () => {
    const wm = new WorkingMemoryGraph({ decayRate: 0.5 });
    
    wm.link('entity-1', 'entity-2', 10.0);
    wm.link('entity-3', 'entity-4', 5.0);
    
    wm.decayAll();
    
    expect(wm.getWeight('entity-1', 'entity-2')).toBe(5.0);
    expect(wm.getWeight('entity-3', 'entity-4')).toBe(2.5);
  });

  test('should remove links below threshold after decay', () => {
    const wm = new WorkingMemoryGraph({ decayRate: 0.99 });
    
    wm.link('entity-1', 'entity-2', 0.5);
    wm.decayAll();
    
    expect(wm.getWeight('entity-1', 'entity-2')).toBe(0); // Removed
  });
});

describe('NeuroDAG Concepts', () => {
  test('should represent proposition as node structure', () => {
    const proposition = {
      uuid: 'prop:server_down',
      props: {
        label: 'Server is offline',
        isProposition: true,
        neuro: {
          type: 'DIGITAL',
          truth: 1.0,
          prior: 0.5,
          is_locked: true
        }
      }
    };

    expect(proposition.props.isProposition).toBe(true);
    expect(proposition.props.neuro.type).toBe('DIGITAL');
    expect(proposition.props.neuro.truth).toBe(1.0);
  });

  test('should represent rule as node with associations', () => {
    const rule = {
      uuid: 'rule:server_implies_churn',
      props: {
        label: 'Server downtime implies churn risk',
        isRule: true,
        isNeuroDAG: true,
        neurodag: {
          type: 'IMPLICATION',
          weight: 0.9
        }
      }
    };

    // Associations would be:
    // rule --[dag_source]--> prop:server_down
    // rule --[dag_target]--> prop:churn_risk

    expect(rule.props.isRule).toBe(true);
    expect(rule.props.neurodag.type).toBe('IMPLICATION');
    expect(rule.props.neurodag.weight).toBe(0.9);
  });

  test('should calculate fuzzy implication', () => {
    // source.truth * weight = target contribution
    const sourceTruth = 1.0;
    const weight = 0.9;
    const contribution = sourceTruth * weight;
    
    expect(contribution).toBe(0.9);
  });

  test('should calculate attack/inhibition', () => {
    // target = target * (1 - attacker * weight)
    const targetTruth = 0.9;
    const attackerTruth = 1.0;
    const attackWeight = 1.0;
    
    const inhibited = targetTruth * (1.0 - attackerTruth * attackWeight);
    
    expect(inhibited).toBe(0); // Fully defeated
  });

  test('should handle partial attack', () => {
    const targetTruth = 0.9;
    const attackerTruth = 0.5;
    const attackWeight = 0.8;
    
    const inhibited = targetTruth * (1.0 - attackerTruth * attackWeight);
    
    expect(inhibited).toBeCloseTo(0.54, 2); // Partially reduced
  });
});
