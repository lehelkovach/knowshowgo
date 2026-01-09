import type { CreateItemInput, Item, UpdateItemInput } from "./types.js";

export interface ItemStore {
  list(): Promise<Item[]>;
  get(id: string): Promise<Item | null>;
  create(input: CreateItemInput): Promise<Item>;
  update(id: string, input: UpdateItemInput): Promise<Item | null>;
  delete(id: string): Promise<boolean>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function randomId(): string {
  // Simple, deterministic-enough for MVP; replace with ULID/UUID later if needed.
  return `item_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function createInMemoryItemStore(): ItemStore {
  const items = new Map<string, Item>();

  return {
    async list() {
      return [...items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async get(id) {
      return items.get(id) ?? null;
    },
    async create(input) {
      const ts = nowIso();
      const item: Item = {
        id: randomId(),
        title: input.title,
        content: input.content ?? "",
        createdAt: ts,
        updatedAt: ts
      };
      items.set(item.id, item);
      return item;
    },
    async update(id, input) {
      const existing = items.get(id);
      if (!existing) return null;
      const updated: Item = {
        ...existing,
        title: input.title ?? existing.title,
        content: input.content ?? existing.content,
        updatedAt: nowIso()
      };
      items.set(id, updated);
      return updated;
    },
    async delete(id) {
      return items.delete(id);
    }
  };
}

