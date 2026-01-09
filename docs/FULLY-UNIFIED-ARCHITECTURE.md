# Fully Unified Architecture: Everything is a Node

## Core Principle

**Everything is a Topic (Node)** - Concepts, Prototypes, Properties, Values, Edges, Associations - all are first-class nodes in the graph. No special cases, no embedded data structures.

## Current Model (Partially Unified)

```javascript
// Current: Properties stored in props dict
const concept = new Node({
  kind: 'topic',
  props: {
    name: 'John Doe',      // Value embedded in props
    email: 'john@example.com',  // Value embedded in props
    age: 30               // Value embedded in props
  }
});
```

## Fully Unified Model

```javascript
// Fully Unified: Properties and values are nodes
const concept = new Node({
  kind: 'topic',
  props: {
    label: 'John Doe',
    isPrototype: false
    // NO embedded properties - all via associations
  }
});

// Properties are nodes
const nameProp = new Node({
  kind: 'topic',
  props: {
    label: 'name',
    isProperty: true,
    valueType: 'string'
  }
});

// Values are nodes
const nameValue = new Node({
  kind: 'topic',
  props: {
    label: 'John Doe',
    isValue: true,
    valueType: 'string',
    literalValue: 'John Doe'
  }
});

// Connect via associations
await ksg.addAssociation({
  fromConceptUuid: concept.uuid,
  toConceptUuid: nameProp.uuid,
  relationType: 'has_prop',  // Concept has property
  strength: 1.0
});

await ksg.addAssociation({
  fromConceptUuid: nameProp.uuid,
  toConceptUuid: nameValue.uuid,
  relationType: 'has_value',  // Property has value
  strength: 1.0
});
```

## Architecture Benefits

### 1. **Complete Uniformity**
- Everything is a node
- Everything uses associations
- No special cases or embedded structures

### 2. **Query Flexibility**
```javascript
// Find all concepts with a "name" property
const concepts = await ksg.findConcepts({
  hasProperty: 'name'
});

// Find all concepts with value "John Doe"
const concepts = await ksg.findConcepts({
  hasValue: 'John Doe'
});

// Find all properties of a concept
const properties = await ksg.getProperties(conceptUuid);

// Find all values of a property
const values = await ksg.getValues(propertyUuid);
```

### 3. **Property Reuse**
- Properties are shared across concepts
- Property definitions are nodes (can have metadata, descriptions, constraints)
- Values can be shared (e.g., same email used by multiple concepts)

### 4. **Versioning Everything**
- Properties can be versioned
- Values can be versioned
- Associations can be versioned
- Complete history tracking

### 5. **Type Safety**
- Property nodes define value types
- Value nodes validate against property types
- Type constraints are nodes too

## Data Model

### Concept Node
```javascript
{
  uuid: 'concept-123',
  kind: 'topic',
  props: {
    label: 'John Doe',
    isPrototype: false,
    isConcept: true,
    isValue: false,
    isProperty: false
  },
  llmEmbedding: [...]
}
```

### Property Node
```javascript
{
  uuid: 'prop-name',
  kind: 'topic',
  props: {
    label: 'name',
    isProperty: true,
    valueType: 'string',
    required: false,
    description: 'Person name'
  },
  llmEmbedding: [...]
}
```

### Value Node
```javascript
{
  uuid: 'value-john-doe',
  kind: 'topic',
  props: {
    label: 'John Doe',
    isValue: true,
    valueType: 'string',
    literalValue: 'John Doe'  // For quick access
  },
  llmEmbedding: [...]
}
```

### Association Structure
```
Concept --[has_prop]--> Property --[has_value]--> Value
```

## Implementation

### Creating a Concept with Properties

```javascript
async createConceptWithProperties({
  prototypeUuid,
  properties,  // { name: 'John Doe', email: 'john@example.com' }
  embedding
}) {
  // 1. Create concept node
  const concept = new Node({
    kind: 'topic',
    props: {
      label: properties.name || 'concept',
      isPrototype: false,
      isConcept: true
    },
    llmEmbedding: embedding
  });
  await this.memory.upsert(concept, prov);
  
  // 2. Create instanceOf association to prototype
  await this.addAssociation({
    fromConceptUuid: concept.uuid,
    toConceptUuid: prototypeUuid,
    relationType: 'instanceOf',
    strength: 1.0
  });
  
  // 3. For each property, create property node, value node, and associations
  for (const [propName, propValue] of Object.entries(properties)) {
    // Get or create property node
    const propNode = await this.getOrCreateProperty(propName);
    
    // Create value node
    const valueNode = await this.createValueNode(propValue);
    
    // Concept --[has_prop]--> Property
    await this.addAssociation({
      fromConceptUuid: concept.uuid,
      toConceptUuid: propNode.uuid,
      relationType: 'has_prop',
      strength: 1.0
    });
    
    // Property --[has_value]--> Value
    await this.addAssociation({
      fromConceptUuid: propNode.uuid,
      toConceptUuid: valueNode.uuid,
      relationType: 'has_value',
      strength: 1.0
    });
    
    // Also link concept directly to value (for quick access)
    await this.addAssociation({
      fromConceptUuid: concept.uuid,
      toConceptUuid: valueNode.uuid,
      relationType: 'has_value',
      strength: 1.0,
      props: {
        propertyName: propName  // Which property this value belongs to
      }
    });
  }
  
  return concept.uuid;
}
```

### Querying Properties

```javascript
async getProperties(conceptUuid) {
  // Find all "has_prop" associations from concept
  const propAssociations = await this.findAssociations({
    fromConceptUuid: conceptUuid,
    relationType: 'has_prop'
  });
  
  // Load property nodes
  const properties = {};
  for (const assoc of propAssociations) {
    const propNode = await this.getNode(assoc.toNode);
    const valueAssoc = await this.findAssociations({
      fromConceptUuid: propNode.uuid,
      relationType: 'has_value'
    });
    
    if (valueAssoc.length > 0) {
      const valueNode = await this.getNode(valueAssoc[0].toNode);
      properties[propNode.props.label] = valueNode.props.literalValue;
    }
  }
  
  return properties;
}
```

## Migration Strategy

### Phase 1: Support Both Models
- Keep `props` dict for backward compatibility
- Add `has_prop` associations alongside props
- ORM can read from either source

### Phase 2: Prefer Associations
- New concepts use `has_prop` associations
- ORM prefers associations over props dict
- Migrate existing concepts to associations

### Phase 3: Remove Props Dict
- All properties via associations
- Props dict only for metadata (label, isPrototype, etc.)
- Fully unified model

## Benefits Summary

1. **Complete Uniformity**: Everything is a node, everything uses associations
2. **Property Reuse**: Properties shared across concepts
3. **Value Reuse**: Values shared across concepts
4. **Query Flexibility**: Query by property, value, or both
5. **Versioning**: Everything can be versioned
6. **Type Safety**: Property nodes define types
7. **Extensibility**: Easy to add property metadata, constraints, etc.

## Example: Person Concept

```javascript
// Create Person prototype
const personProto = await ksg.createPrototype({
  name: 'Person',
  description: 'A human individual',
  context: 'identity',
  embedding: await embed('Person')
});

// Create property definitions
const nameProp = await ksg.createProperty({
  name: 'name',
  valueType: 'string',
  required: true
});

const emailProp = await ksg.createProperty({
  name: 'email',
  valueType: 'string',
  required: true
});

// Create concept with properties
const john = await ksg.createConceptWithProperties({
  prototypeUuid: personProto,
  properties: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  embedding: await embed('John Doe person')
});

// Query properties
const props = await ksg.getProperties(john);
// { name: 'John Doe', email: 'john@example.com' }
```

