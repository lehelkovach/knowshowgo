function nowIso() {
    return new Date().toISOString();
}
function randomId() {
    // Simple, deterministic-enough for MVP; replace with ULID/UUID later if needed.
    return `item_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}
export function createInMemoryItemStore() {
    const items = new Map();
    return {
        async list() {
            return [...items.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        },
        async get(id) {
            return items.get(id) ?? null;
        },
        async create(input) {
            const ts = nowIso();
            const item = {
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
            if (!existing)
                return null;
            const updated = {
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
//# sourceMappingURL=store.js.map