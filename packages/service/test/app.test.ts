import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("service", () => {
  it("healthz", async () => {
    const app = buildApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it("items CRUD", async () => {
    const app = buildApp();

    const empty = await app.inject({ method: "GET", url: "/v1/items" });
    expect(empty.statusCode).toBe(200);
    expect(empty.json()).toEqual({ items: [] });

    const created = await app.inject({
      method: "POST",
      url: "/v1/items",
      payload: { title: "Hello", content: "World" }
    });
    expect(created.statusCode).toBe(200);
    const createdBody = created.json();
    expect(createdBody.item.id).toMatch(/^item_/);
    expect(createdBody.item.title).toBe("Hello");
    expect(createdBody.item.content).toBe("World");

    const id = createdBody.item.id as string;

    const fetched = await app.inject({ method: "GET", url: `/v1/items/${id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().item.id).toBe(id);

    const patched = await app.inject({
      method: "PATCH",
      url: `/v1/items/${id}`,
      payload: { title: "Hello2" }
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().item.title).toBe("Hello2");

    const del = await app.inject({ method: "DELETE", url: `/v1/items/${id}` });
    expect(del.statusCode).toBe(204);

    const missing = await app.inject({ method: "GET", url: `/v1/items/${id}` });
    expect(missing.statusCode).toBe(404);
  });
});

