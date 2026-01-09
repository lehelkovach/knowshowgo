import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "@knowshowgo/service";
import { createKnowShowGoClient, KnowShowGoError } from "../src/client.js";

describe("api-client", () => {
  const app = buildApp();
  let baseUrl = "";

  beforeAll(async () => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    if (!addr || typeof addr === "string") throw new Error("expected server address");
    baseUrl = `http://${addr.address}:${addr.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("health works", async () => {
    const client = createKnowShowGoClient({ baseUrl });
    await expect(client.health()).resolves.toEqual({ ok: true });
  });

  it("items lifecycle", async () => {
    const client = createKnowShowGoClient({ baseUrl });

    const list0 = await client.listItems();
    expect(list0.items).toEqual([]);

    const created = await client.createItem({ title: "t1", content: "c1" });
    expect(created.item.title).toBe("t1");

    const got = await client.getItem(created.item.id);
    expect(got.item.id).toBe(created.item.id);

    const updated = await client.updateItem(created.item.id, { title: "t2" });
    expect(updated.item.title).toBe("t2");

    await client.deleteItem(created.item.id);

    await expect(client.getItem(created.item.id)).rejects.toMatchObject<Partial<KnowShowGoError>>({
      name: "KnowShowGoError",
      status: 404
    });
  });
});

