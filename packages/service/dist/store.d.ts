import type { CreateItemInput, Item, UpdateItemInput } from "./types.js";
export interface ItemStore {
    list(): Promise<Item[]>;
    get(id: string): Promise<Item | null>;
    create(input: CreateItemInput): Promise<Item>;
    update(id: string, input: UpdateItemInput): Promise<Item | null>;
    delete(id: string): Promise<boolean>;
}
export declare function createInMemoryItemStore(): ItemStore;
//# sourceMappingURL=store.d.ts.map