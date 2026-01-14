/**
 * Seed ontology/prototypes expected by osl-agent-prototype.
 *
 * This is idempotent: it will reuse existing nodes if found.
 */

const DEFAULT_PROTOTYPES = [
  'BasePrototype',
  'Person',
  'Organization',
  'Place',
  'Thing',
  'DigitalResource',
  'CreativeWork',
  'Event',
  'Task',
  'Project',
  'Commandlet',
  'Procedure',
  'Step',
  'Trigger',
  'QueueItem',
  'WebResource',
  // Backward compat container-ish prototypes
  'Object',
  'List',
  'DAG',
  'Queue'
];

const INHERITS = {
  Person: ['BasePrototype'],
  Organization: ['BasePrototype'],
  Place: ['BasePrototype'],
  Thing: ['BasePrototype'],
  DigitalResource: ['BasePrototype'],
  CreativeWork: ['BasePrototype'],
  Event: ['BasePrototype'],
  Task: ['BasePrototype'],
  Project: ['BasePrototype'],
  Commandlet: ['BasePrototype'],
  Procedure: ['BasePrototype'],
  Step: ['BasePrototype'],
  Trigger: ['BasePrototype'],
  QueueItem: ['BasePrototype'],
  WebResource: ['BasePrototype'],
  Object: ['BasePrototype'],
  List: ['BasePrototype'],
  DAG: ['List'],
  Queue: ['List']
};

const PROPERTY_DEFS = [
  // ontology core
  { name: 'instanceOf', valueType: 'node_ref', description: 'Topic → Prototype (type membership)' },
  { name: 'broaderThan', valueType: 'node_ref', description: 'Broader concept relationship' },
  { name: 'narrowerThan', valueType: 'node_ref', description: 'Narrower concept relationship' },
  { name: 'relatedTo', valueType: 'node_ref', description: 'General relatedness' },
  { name: 'partOf', valueType: 'node_ref', description: 'Part-whole relationship' },
  { name: 'hasPart', valueType: 'node_ref', description: 'Has-part relationship' },
  { name: 'synonymOf', valueType: 'node_ref', description: 'Soft equivalence' },
  { name: 'sameAs', valueType: 'node_ref', description: 'Strong equivalence / merge' },
  { name: 'hasSource', valueType: 'node_ref', description: 'Source reference (DigitalResource or URL)' },
  // identity/external refs
  { name: 'alias', valueType: 'string', description: 'Alternative name/label' },
  { name: 'externalUrl', valueType: 'url', description: 'External URL reference' },
  { name: 'imageUrl', valueType: 'url', description: 'Image URL' },
  { name: 'schemaOrgType', valueType: 'url', description: 'schema.org type reference' },
  { name: 'wikipediaUrl', valueType: 'url', description: 'Wikipedia URL' },
  // time + scheduling
  { name: 'startTime', valueType: 'datetime', description: 'Start datetime' },
  { name: 'endTime', valueType: 'datetime', description: 'End datetime' },
  { name: 'dueTime', valueType: 'datetime', description: 'Due datetime' },
  { name: 'priority', valueType: 'number', description: 'Priority level' },
  { name: 'status', valueType: 'string', description: 'Status' },
  // procedural memory
  { name: 'hasStep', valueType: 'node_ref', description: 'Procedure → Step' },
  { name: 'nextStep', valueType: 'node_ref', description: 'Step → Step (sequence)' },
  { name: 'usesCommandlet', valueType: 'node_ref', description: 'Step → Commandlet' },
  { name: 'params', valueType: 'json', description: 'Parameters JSON' },
  { name: 'trigger', valueType: 'node_ref', description: 'Procedure → Trigger' },
  { name: 'successCriteria', valueType: 'json', description: 'Success criteria JSON' },
  { name: 'appliesToSite', valueType: 'node_ref', description: 'Procedure → WebResource' },
  { name: 'runsProcedure', valueType: 'node_ref', description: 'QueueItem → Procedure' },
  { name: 'context', valueType: 'json', description: 'Context JSON' },
  // common fields (backward compat)
  { name: 'name', valueType: 'string', description: 'Name/label' },
  { name: 'description', valueType: 'string', description: 'Description/summary' },
  { name: 'createdAt', valueType: 'datetime', description: 'Creation timestamp' },
  { name: 'updatedAt', valueType: 'datetime', description: 'Update timestamp' }
];

async function findPrototypeByLabel(ksg, label) {
  const results = await ksg.searchConcepts({ query: label, topK: 20 });
  const hit = results.find(r => r?.props?.isPrototype === true && (r?.props?.label === label || r?.props?.name === label));
  return hit?.uuid ?? null;
}

async function ensurePrototype(ksg, name) {
  const existing = await findPrototypeByLabel(ksg, name);
  if (existing) return existing;
  return await ksg.createPrototype({
    name,
    description: `${name} prototype`,
    context: 'seed',
    labels: [name],
    embedding: await ksg.embedFn(`${name} prototype`)
  });
}

async function findPropertyByName(ksg, name) {
  const results = await ksg.searchConcepts({ query: `property ${name}`, topK: 20 });
  const hit = results.find(r => r?.props?.isProperty === true && r?.props?.label === name);
  return hit?.uuid ?? null;
}

async function ensurePropertyDef(ksg, def) {
  const existing = await findPropertyByName(ksg, def.name);
  if (existing) return existing;
  return await ksg.createProperty({
    name: def.name,
    valueType: def.valueType,
    required: false,
    description: def.description
  });
}

async function ensureDefinesProp(ksg, protoUuid, propUuid, propName) {
  // avoid duplicates
  const edges = await ksg.getAssociations(protoUuid, 'outgoing');
  const already = edges.find(e => e.rel === 'defines_prop' && e.toNode === propUuid);
  if (already) return;
  await ksg.addAssociation({
    fromConceptUuid: protoUuid,
    toConceptUuid: propUuid,
    relationType: 'defines_prop',
    strength: 1.0,
    props: { propertyName: propName }
  });
}

export async function seedOslAgentPrototype(ksg) {
  const report = {
    prototypes: [],
    propertyDefs: [],
    inheritanceEdges: 0,
    definesPropEdges: 0
  };

  // 1) Prototypes
  const protoUuids = {};
  for (const p of DEFAULT_PROTOTYPES) {
    const uuid = await ensurePrototype(ksg, p);
    protoUuids[p] = uuid;
    report.prototypes.push({ name: p, uuid });
  }

  // 2) Inheritance (as is_a + inherits; createPrototype already writes both)
  for (const [child, parents] of Object.entries(INHERITS)) {
    const childUuid = protoUuids[child];
    if (!childUuid) continue;
    for (const parentName of parents) {
      const parentUuid = protoUuids[parentName];
      if (!parentUuid) continue;
      // createPrototype doesn't run here (already exists). Add missing links explicitly.
      const out = await ksg.getAssociations(childUuid, 'outgoing');
      const hasIsA = out.some(e => e.rel === 'is_a' && e.toNode === parentUuid);
      if (!hasIsA) {
        await ksg.addAssociation({ fromConceptUuid: childUuid, toConceptUuid: parentUuid, relationType: 'is_a', strength: 1.0 });
        report.inheritanceEdges += 1;
      }
    }
  }

  // 3) PropertyDefs (as property nodes)
  const propUuids = {};
  for (const def of PROPERTY_DEFS) {
    const uuid = await ensurePropertyDef(ksg, def);
    propUuids[def.name] = uuid;
    report.propertyDefs.push({ name: def.name, uuid, valueType: def.valueType });
  }

  // 4) Attach some schema edges (enables prototype-driven forms)
  const attach = async (protoName, props) => {
    const protoUuid = protoUuids[protoName];
    if (!protoUuid) return;
    for (const propName of props) {
      const propUuid = propUuids[propName];
      if (!propUuid) continue;
      const before = (await ksg.getAssociations(protoUuid, 'outgoing')).filter(e => e.rel === 'defines_prop').length;
      await ensureDefinesProp(ksg, protoUuid, propUuid, propName);
      const after = (await ksg.getAssociations(protoUuid, 'outgoing')).filter(e => e.rel === 'defines_prop').length;
      if (after > before) report.definesPropEdges += 1;
    }
  };

  await attach('Procedure', ['title', 'description', 'hasStep', 'nextStep', 'trigger', 'successCriteria', 'appliesToSite', 'context']);
  await attach('Step', ['title', 'usesCommandlet', 'params', 'nextStep', 'context']);
  await attach('Task', ['title', 'description', 'dueTime', 'priority', 'status', 'context']);
  await attach('QueueItem', ['priority', 'dueTime', 'status', 'runsProcedure', 'context']);

  return report;
}

