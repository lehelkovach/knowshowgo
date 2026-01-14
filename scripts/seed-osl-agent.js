import { createKnowShowGoFromEnv } from '../src/server/rest-api.js';
import { seedOslAgentPrototype } from '../src/seed/osl_agent.js';

const ksg = createKnowShowGoFromEnv();
const report = await seedOslAgentPrototype(ksg);
// eslint-disable-next-line no-console
console.log(JSON.stringify({ ok: true, report }, null, 2));

