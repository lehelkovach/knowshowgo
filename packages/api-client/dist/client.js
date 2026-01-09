import { CreateItemRequestSchema, CreateItemResponseSchema, ErrorResponseSchema, GetItemResponseSchema, HealthResponseSchema, ListItemsResponseSchema, UpdateItemRequestSchema, UpdateItemResponseSchema } from "./types.js";
export class KnowShowGoError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.name = "KnowShowGoError";
        this.status = status;
        this.body = body;
    }
}
function joinUrl(baseUrl, path) {
    return `${baseUrl.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}
async function parseJsonOrText(res) {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json"))
        return res.json();
    return res.text();
}
export function createKnowShowGoClient(options) {
    const baseUrl = options.baseUrl;
    const doFetch = options.fetch ?? fetch;
    const defaultHeaders = options.headers ?? {};
    async function request(method, path, body, parse) {
        const res = await doFetch(joinUrl(baseUrl, path), {
            method,
            headers: {
                accept: "application/json",
                ...(body ? { "content-type": "application/json" } : {}),
                ...defaultHeaders
            },
            body: body ? JSON.stringify(body) : undefined
        });
        const payload = await parseJsonOrText(res);
        if (!res.ok) {
            const err = ErrorResponseSchema.safeParse(payload);
            throw new KnowShowGoError(`Request failed: ${method} ${path} (${res.status})`, res.status, err.success ? err.data : payload);
        }
        return parse(payload);
    }
    return {
        health: async () => request("GET", "/healthz", undefined, (x) => HealthResponseSchema.parse(x)),
        listItems: async () => request("GET", "/v1/items", undefined, (x) => ListItemsResponseSchema.parse(x)),
        getItem: async (id) => request("GET", `/v1/items/${encodeURIComponent(id)}`, undefined, (x) => GetItemResponseSchema.parse(x)),
        createItem: async (req) => {
            const parsed = CreateItemRequestSchema.parse(req);
            return request("POST", "/v1/items", parsed, (x) => CreateItemResponseSchema.parse(x));
        },
        updateItem: async (id, req) => {
            const parsed = UpdateItemRequestSchema.parse(req);
            return request("PATCH", `/v1/items/${encodeURIComponent(id)}`, parsed, (x) => UpdateItemResponseSchema.parse(x));
        },
        deleteItem: async (id) => {
            const res = await doFetch(joinUrl(baseUrl, `/v1/items/${encodeURIComponent(id)}`), {
                method: "DELETE",
                headers: { ...defaultHeaders }
            });
            if (res.status === 204)
                return;
            const payload = await parseJsonOrText(res);
            const err = ErrorResponseSchema.safeParse(payload);
            throw new KnowShowGoError(`Request failed: DELETE /v1/items/:id (${res.status})`, res.status, err.success ? err.data : payload);
        }
    };
}
//# sourceMappingURL=client.js.map