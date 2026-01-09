import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CreateItemInputSchema,
  ItemSchema,
  UpdateItemInputSchema
} from "./types.js";
import { createInMemoryItemStore, type ItemStore } from "./store.js";

export type AppOptions = {
  store?: ItemStore;
};

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: false });
  const store = options.store ?? createInMemoryItemStore();

  app.get("/healthz", async () => ({ ok: true }));

  app.get("/v1/items", async () => {
    const items = await store.list();
    return { items };
  });

  app.post("/v1/items", async (req, reply) => {
    const parsed = CreateItemInputSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_request", details: parsed.error.flatten() };
    }
    const item = await store.create(parsed.data);
    return { item };
  });

  app.get("/v1/items/:id", async (req, reply) => {
    const id = z.string().min(1).safeParse((req.params as any)?.id);
    if (!id.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    const item = await store.get(id.data);
    if (!item) {
      reply.code(404);
      return { error: "not_found" };
    }
    return { item };
  });

  app.patch("/v1/items/:id", async (req, reply) => {
    const id = z.string().min(1).safeParse((req.params as any)?.id);
    if (!id.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    const parsed = UpdateItemInputSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: "invalid_request", details: parsed.error.flatten() };
    }
    const item = await store.update(id.data, parsed.data);
    if (!item) {
      reply.code(404);
      return { error: "not_found" };
    }
    return { item };
  });

  app.delete("/v1/items/:id", async (req, reply) => {
    const id = z.string().min(1).safeParse((req.params as any)?.id);
    if (!id.success) {
      reply.code(400);
      return { error: "invalid_request" };
    }
    const deleted = await store.delete(id.data);
    if (!deleted) {
      reply.code(404);
      return { error: "not_found" };
    }
    reply.code(204);
    return "";
  });

  // Basic response shape sanity for the contract (kept lightweight for MVP)
  app.addHook("onSend", async (_req, reply, payload) => {
    // Don't validate 204 or non-JSON payloads.
    if (reply.statusCode === 204) return payload;
    const ct = reply.getHeader("content-type");
    if (typeof ct === "string" && !ct.includes("application/json")) return payload;
    // Validate the known shapes when possible, but never block responses.
    try {
      const json = typeof payload === "string" ? JSON.parse(payload) : payload;
      if (reply.request.url.startsWith("/v1/items") && json?.item) {
        ItemSchema.parse(json.item);
      }
    } catch {
      // ignore
    }
    return payload;
  });

  return app;
}

