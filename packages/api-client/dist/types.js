import { z } from "zod";
export const HealthResponseSchema = z.object({ ok: z.boolean() });
export const ItemSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    content: z.string(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});
export const ListItemsResponseSchema = z.object({
    items: z.array(ItemSchema)
});
export const GetItemResponseSchema = z.object({ item: ItemSchema });
export const CreateItemRequestSchema = z.object({
    title: z.string().min(1),
    content: z.string().optional()
});
export const CreateItemResponseSchema = z.object({ item: ItemSchema });
export const UpdateItemRequestSchema = z.object({
    title: z.string().min(1).optional(),
    content: z.string().optional()
});
export const UpdateItemResponseSchema = z.object({ item: ItemSchema });
export const ErrorResponseSchema = z.object({
    error: z.string(),
    details: z.unknown().optional()
});
//# sourceMappingURL=types.js.map