import { z } from "zod";

export const HealthResponseSchema = z.object({ ok: z.boolean() });
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type Item = z.infer<typeof ItemSchema>;

export const ListItemsResponseSchema = z.object({
  items: z.array(ItemSchema)
});
export type ListItemsResponse = z.infer<typeof ListItemsResponseSchema>;

export const GetItemResponseSchema = z.object({ item: ItemSchema });
export type GetItemResponse = z.infer<typeof GetItemResponseSchema>;

export const CreateItemRequestSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional()
});
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

export const CreateItemResponseSchema = z.object({ item: ItemSchema });
export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;

export const UpdateItemRequestSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional()
});
export type UpdateItemRequest = z.infer<typeof UpdateItemRequestSchema>;

export const UpdateItemResponseSchema = z.object({ item: ItemSchema });
export type UpdateItemResponse = z.infer<typeof UpdateItemResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.unknown().optional()
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
