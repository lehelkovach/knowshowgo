# KnowShowGo Architecture Summary

## Core Principles

1. **Everything is a Node (Topic)**
   - Concepts, Prototypes, Properties, Values, Edges - all are nodes
   - No special cases or embedded structures

2. **Multiple Inheritance via "is_a" Associations**
   - Prototypes can have multiple parents
   - Each parent contributes its property list in parallel
   - No single "inherits" property - use "is_a" associations

3. **Properties and Values as Nodes**
   - Properties are nodes (can be shared, versioned, queried)
   - Values are nodes (can be shared, versioned, queried)
   - Connected via "has_prop" and "has_value" associations

4. **Complete Uniformity**
   - All relationships are associations
   - All data is nodes
   - Query everything uniformly

## Architecture Evolution

### Current Implementation (Hybrid)
- ✅ Multiple inheritance via "is_a" associations
- ✅ Properties can be nodes (via `createConceptWithProperties`)
- ⚠️ Still supports props dict for backward compatibility
- ⚠️ Edges are separate (not nodes yet)

### Target Architecture (Fully Unified)
- ✅ Everything is a node
- ✅ Multiple inheritance via "is_a"
- ✅ Properties as nodes via "has_prop"
- ✅ Values as nodes via "has_value"
- ⏳ Edges as nodes (hyperedges) - Phase 2

## Data Model

```
Concept (Node)
  ├─[instanceOf]─> Prototype (Node)
  ├─[is_a]──────> Parent1 (Node)  // Multiple inheritance
  ├─[is_a]──────> Parent2 (Node)
  ├─[has_prop]──> Property (Node)
  │                └─[has_value]─> Value (Node)
  └─[has_value]──> Value (Node)  // Direct link with propertyName
```

## Benefits

1. **Property Reuse**: Properties shared across concepts
2. **Value Reuse**: Values shared across concepts  
3. **Query Flexibility**: Query by property, value, or both
4. **Versioning**: Everything can be versioned
5. **Type Safety**: Property nodes define types
6. **Multiple Inheritance**: True multiple inheritance support
7. **Uniform Model**: No special cases

## API Usage

### Multiple Inheritance
```javascript
const managerProto = await ksg.createPrototype({
  name: 'Manager',
  parentPrototypeUuids: ['person-uuid', 'employee-uuid']  // Multiple parents
});
```

### Properties as Nodes
```javascript
const concept = await ksg.createConceptWithProperties({
  prototypeUuid: personProto,
  properties: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  embedding: await embed('John Doe')
});

// Properties accessed via associations
const props = await ksg.getProperties(concept);
// { name: 'John Doe', email: 'john@example.com' }
```

## Migration Status

- ✅ Multiple inheritance implemented
- ✅ Properties as nodes implemented
- ✅ Values as nodes implemented
- ⏳ Edges as nodes (future)
- ⏳ Full migration from props dict (future)

