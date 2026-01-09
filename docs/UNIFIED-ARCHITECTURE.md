# Unified Architecture: Everything is a Node

## Core Principle

**Everything is a Topic (Node)** - Concepts, Prototypes, Properties, Values, Edges, Associations - all are first-class nodes in the graph.

## Multiple Inheritance via "is_a" Associations

### Current Implementation (Single Inheritance)
```javascript
// Current: Single "inherits" edge
if (basePrototypeUuid) {
  const edge = new Edge({
    fromNode: proto.uuid,
    toNode: basePrototypeUuid,
    rel: 'inherits',  // Single parent
    ...
  });
}
```

### Unified Architecture (Multiple Inheritance)
```javascript
// Unified: Multiple "is_a" associations
async createPrototype({
  ...,
  parentPrototypeUuids = []  // Array of parent UUIDs
}) {
  // Create prototype node
  const proto = new Node({...});
  
  // Create multiple "is_a" associations (one per parent)
  for (const parentUuid of parentPrototypeUuids) {
    await this.addAssociation({
      fromConceptUuid: proto.uuid,
      toConceptUuid: parentUuid,
      relationType: 'is_a',  // Multiple inheritance
      strength: 1.0
    });
  }
}
```

## Why "is_a" Instead of "inherits"?

1. **Multiple Inheritance**: A prototype can have multiple parents
2. **Uniform Model**: All relationships use associations, not special properties
3. **Parallel Property Lists**: Each parent contributes its property list independently
4. **Query Flexibility**: Can query "all things that are_a X" or "all things that are_a Y"

## Property Inheritance Model

### Parallel Property Lists
When a concept has multiple parents via "is_a":
- Each parent contributes its property definitions
- Properties are merged (concept values override parent defaults)
- No property conflicts (concept values take precedence)

### Example: Multiple Inheritance
```
Person (prototype)
  - name: string
  - age: number

Employee (prototype)
  - employeeId: string
  - department: string

Manager (prototype) is_a [Person, Employee]
  - teamSize: number
  - Properties: name, age, employeeId, department, teamSize
```

## Edge as Node (Hyperedges)

### Current: Edges are separate
```javascript
// Edge is separate from nodes
const edge = new Edge({
  fromNode: 'uuid1',
  toNode: 'uuid2',
  rel: 'is_a',
  ...
});
```

### Unified: Edges are also Nodes
```javascript
// Edge is also a Node (hyperedge)
const edgeNode = new Node({
  kind: 'topic',
  props: {
    isEdge: true,
    fromNode: 'uuid1',
    toNode: 'uuid2',
    relationType: 'is_a',
    ...
  }
});

// Then create associations from edge node to source/target
await this.addAssociation({
  fromConceptUuid: edgeNode.uuid,
  toConceptUuid: 'uuid1',
  relationType: 'connects_from'
});

await this.addAssociation({
  fromConceptUuid: edgeNode.uuid,
  toConceptUuid: 'uuid2',
  relationType: 'connects_to'
});
```

## Implementation Strategy

### Phase 1: Multiple Inheritance (is_a)
- Replace single `basePrototypeUuid` with `parentPrototypeUuids[]`
- Use `is_a` association type instead of `inherits`
- Update ORM to traverse multiple `is_a` edges

### Phase 2: Edges as Nodes
- Make Edge extend Node (or Edge is a Node with `isEdge: true`)
- Store edges as nodes in the graph
- Use associations to link edge nodes to source/target

### Phase 3: Everything is a Topic
- Properties are nodes
- Values are nodes
- All relationships are associations between nodes

## API Changes

### Before (Single Inheritance)
```javascript
const protoUuid = await ksg.createPrototype({
  name: 'Manager',
  ...,
  basePrototypeUuid: 'person-uuid'  // Single parent
});
```

### After (Multiple Inheritance)
```javascript
const protoUuid = await ksg.createPrototype({
  name: 'Manager',
  ...,
  parentPrototypeUuids: ['person-uuid', 'employee-uuid']  // Multiple parents
});
```

## ORM Property Resolution

### Multiple Inheritance Resolution
```javascript
async hydrateConcept(conceptNode) {
  // Find all parents via "is_a" associations
  const parentUuids = await this.findAssociations({
    fromConceptUuid: conceptNode.uuid,
    relationType: 'is_a'
  });
  
  // Load all parent prototypes
  const parents = await Promise.all(
    parentUuids.map(uuid => this.getNode(uuid))
  );
  
  // Merge property lists from all parents
  const allProperties = new Map();
  for (const parent of parents) {
    const parentProps = await this.loadPrototypeProperties(parent);
    for (const prop of parentProps) {
      if (!allProperties.has(prop.name)) {
        allProperties.set(prop.name, prop);
      }
    }
  }
  
  // Merge with concept values
  return this.mergeProperties(conceptNode, Array.from(allProperties.values()));
}
```

## Benefits

1. **True Multiple Inheritance**: Prototypes can inherit from multiple parents
2. **Uniform Model**: Everything is a node, everything uses associations
3. **Flexible Queries**: Query by any parent type
4. **No Special Cases**: No special "inherits" edge, just another association type
5. **Extensible**: Easy to add new relationship types

## Migration Path

1. **Add `parentPrototypeUuids` parameter** (backward compatible with `basePrototypeUuid`)
2. **Create multiple `is_a` associations** instead of single `inherits` edge
3. **Update ORM** to traverse multiple `is_a` edges
4. **Deprecate `basePrototypeUuid`** (keep for backward compatibility)
5. **Eventually make edges nodes** (Phase 2)

