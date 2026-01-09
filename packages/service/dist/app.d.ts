import { type FastifyInstance } from "fastify";
import { type ItemStore } from "./store.js";
export type AppOptions = {
    store?: ItemStore;
};
export declare function buildApp(options?: AppOptions): FastifyInstance;
//# sourceMappingURL=app.d.ts.map