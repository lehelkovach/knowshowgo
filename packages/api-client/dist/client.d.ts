export type KnowShowGoClientOptions = {
    baseUrl: string;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
};
export declare class KnowShowGoError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown);
}
export declare function createKnowShowGoClient(options: KnowShowGoClientOptions): {
    health: () => Promise<{
        ok: boolean;
    }>;
    listItems: () => Promise<{
        items: {
            id: string;
            title: string;
            content: string;
            createdAt: string;
            updatedAt: string;
        }[];
    }>;
    getItem: (id: string) => Promise<{
        item: {
            id: string;
            title: string;
            content: string;
            createdAt: string;
            updatedAt: string;
        };
    }>;
    createItem: (req: unknown) => Promise<{
        item: {
            id: string;
            title: string;
            content: string;
            createdAt: string;
            updatedAt: string;
        };
    }>;
    updateItem: (id: string, req: unknown) => Promise<{
        item: {
            id: string;
            title: string;
            content: string;
            createdAt: string;
            updatedAt: string;
        };
    }>;
    deleteItem: (id: string) => Promise<void>;
};
//# sourceMappingURL=client.d.ts.map