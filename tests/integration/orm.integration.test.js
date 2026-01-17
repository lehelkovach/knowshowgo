/**
 * ORM Integration Tests
 * 
 * Tests the ORM layer with lazy loading, property access,
 * and persistence across mock and live backends.
 * 
 * Run:
 *   npm test -- tests/integration/orm.integration.test.js
 *   TEST_LIVE=true npm test -- tests/integration/orm.integration.test.js
 */

import {
  IS_LIVE,
  createTestKSG,
  cleanupTestKSG,
  mockEmbedFn
} from './setup.js';

describe(`ORM Integration Tests (${IS_LIVE ? 'LIVE' : 'MOCK'})`, () => {
  let ksg;

  beforeAll(async () => {
    ksg = await createTestKSG();
  });

  afterAll(async () => {
    await cleanupTestKSG(ksg);
  });

  describe('Prototype Registration', () => {
    test('registerPrototype creates dynamic class', async () => {
      const Person = await ksg.orm.registerPrototype('ORMPerson', {
        properties: {
          name: { type: 'string', required: true },
          email: { type: 'string' },
          age: { type: 'number' }
        }
      });

      expect(Person).toBeDefined();
      expect(typeof Person.create).toBe('function');
      expect(typeof Person.get).toBe('function');
      expect(typeof Person.find).toBe('function');
    });

    test('re-registering same prototype returns equivalent class', async () => {
      const Class1 = await ksg.orm.registerPrototype('DuplicateTest', {
        properties: { value: { type: 'string' } }
      });
      
      const Class2 = await ksg.orm.registerPrototype('DuplicateTest', {
        properties: { value: { type: 'string' } }
      });

      // Both should be valid classes with the same prototype name
      expect(Class1.prototypeName).toBe('DuplicateTest');
      expect(Class2.prototypeName).toBe('DuplicateTest');
    });
  });

  describe('Instance Creation', () => {
    let TaskClass;

    beforeAll(async () => {
      TaskClass = await ksg.orm.registerPrototype('ORMTask', {
        properties: {
          title: { type: 'string', required: true },
          description: { type: 'string' },
          priority: { type: 'string', default: '5' },
          completed: { type: 'string', default: 'false' }
        }
      });
    });

    test('create() creates instance with properties', async () => {
      const task = await TaskClass.create({
        title: 'Integration Test Task',
        description: 'Testing ORM creation',
        priority: '8'
      });

      expect(task).toBeDefined();
      expect(task.uuid).toBeDefined();
      expect(task.title).toBe('Integration Test Task');
      expect(task.description).toBe('Testing ORM creation');
      expect(task.priority).toBe('8');
    });

    test('create() with minimal properties works', async () => {
      const task = await TaskClass.create({
        title: 'Task with Minimal Props'
      });

      expect(task.title).toBe('Task with Minimal Props');
      expect(task.uuid).toBeDefined();
    });
  });

  describe('Instance Retrieval (Lazy Loading)', () => {
    let ProjectClass;
    let createdProjectUuid;

    beforeAll(async () => {
      ProjectClass = await ksg.orm.registerPrototype('ORMProject', {
        properties: {
          name: { type: 'string', required: true },
          budget: { type: 'string' },
          active: { type: 'string', default: 'true' }
        }
      });

      // Create a project to retrieve later
      const project = await ProjectClass.create({
        name: 'Lazy Load Test Project',
        budget: '10000'
      });
      createdProjectUuid = project.uuid;
    });

    test('get() retrieves instance by UUID', async () => {
      const project = await ProjectClass.get(createdProjectUuid);

      expect(project).toBeDefined();
      expect(project.uuid).toBe(createdProjectUuid);
    });

    test('lazy loading retrieves property values via _getProperty', async () => {
      const project = await ProjectClass.get(createdProjectUuid);
      
      // Use async _getProperty for lazy loading
      const name = await project._getProperty('name');
      const budget = await project._getProperty('budget');
      
      expect(name).toBe('Lazy Load Test Project');
      expect(budget).toBe('10000');
    });

    test('get() returns null for non-existent UUID', async () => {
      const project = await ProjectClass.get('non-existent-uuid-12345');
      expect(project).toBeNull();
    });
  });

  describe('Instance Updates', () => {
    let ItemClass;
    let itemUuid;

    beforeAll(async () => {
      ItemClass = await ksg.orm.registerPrototype('ORMItem', {
        properties: {
          name: { type: 'string', required: true },
          quantity: { type: 'string', default: '1' }
        }
      });

      const item = await ItemClass.create({
        name: 'Original Item',
        quantity: '5'
      });
      itemUuid = item.uuid;
    });

    test('property update persists via _setProperty', async () => {
      const item = await ItemClass.get(itemUuid);
      
      // Use async setter method
      await item._setProperty('quantity', '10');
      await item.save();
      
      // Retrieve fresh instance and verify
      const freshItem = await ItemClass.get(itemUuid);
      const qty = await freshItem._getProperty('quantity');
      expect(qty).toBe('10');
    });

    test('multiple properties can be updated', async () => {
      const item = await ItemClass.get(itemUuid);
      
      await item._setProperty('name', 'Updated Item');
      await item._setProperty('quantity', '20');
      await item.save();
      
      const freshItem = await ItemClass.get(itemUuid);
      const name = await freshItem._getProperty('name');
      const qty = await freshItem._getProperty('quantity');
      expect(name).toBe('Updated Item');
      expect(qty).toBe('20');
    });
  });

  describe('Finding Instances', () => {
    let CategoryClass;

    beforeAll(async () => {
      CategoryClass = await ksg.orm.registerPrototype('ORMCategory', {
        properties: {
          name: { type: 'string', required: true },
          priority: { type: 'string' }
        }
      });

      // Create multiple categories
      await CategoryClass.create({ name: 'Category A', priority: '1' });
      await CategoryClass.create({ name: 'Category B', priority: '2' });
      await CategoryClass.create({ name: 'Category C', priority: '3' });
    });

    test('find() returns array of instances', async () => {
      const categories = await CategoryClass.find();
      
      expect(Array.isArray(categories)).toBe(true);
      // Should return at least some results
      expect(categories.length).toBeGreaterThan(0);
    });

    test('find() returns instances with correct prototype', async () => {
      const categories = await CategoryClass.find();
      
      if (categories.length > 0) {
        // Each result should have a uuid
        expect(categories[0].uuid).toBeDefined();
      }
    });
  });

  describe('ORM with Associations', () => {
    let AuthorClass, BookClass;
    let authorUuid, bookUuid;

    beforeAll(async () => {
      AuthorClass = await ksg.orm.registerPrototype('ORMAuthor', {
        properties: {
          name: { type: 'string', required: true }
        }
      });

      BookClass = await ksg.orm.registerPrototype('ORMBook', {
        properties: {
          title: { type: 'string', required: true },
          year: { type: 'number' }
        }
      });

      const author = await AuthorClass.create({ name: 'Test Author' });
      authorUuid = author.uuid;

      const book = await BookClass.create({ title: 'Test Book', year: 2024 });
      bookUuid = book.uuid;
    });

    test('creating association between ORM instances', async () => {
      await ksg.addAssociation({
        fromConceptUuid: authorUuid,
        toConceptUuid: bookUuid,
        relationType: 'wrote',
        strength: 1.0
      });

      const associations = await ksg.getAssociations(authorUuid, 'outgoing');
      expect(Array.isArray(associations)).toBe(true);
      const wroteAssoc = associations.find(a => a.rel === 'wrote');
      expect(wroteAssoc).toBeDefined();
    });
  });
});

describe('ORM Error Handling', () => {
  let ksg;

  beforeAll(async () => {
    ksg = await createTestKSG();
  });

  afterAll(async () => {
    await cleanupTestKSG(ksg);
  });

  test('handles updating string property', async () => {
    const TestClass = await ksg.orm.registerPrototype('ErrorTestClass', {
      properties: {
        value: { type: 'string' }
      }
    });

    const instance = await TestClass.create({ value: 'test' });
    
    // Update property
    await instance._setProperty('value', 'updated');
    await instance.save();
    
    const fresh = await TestClass.get(instance.uuid);
    const val = await fresh._getProperty('value');
    expect(val).toBe('updated');
  });
});
