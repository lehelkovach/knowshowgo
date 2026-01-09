import { z } from "zod";

export const ItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().default(""),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export type Item = z.infer<typeof ItemSchema>;

export const CreateItemInputSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional().default("")
});

export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;

export const UpdateItemInputSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional()
});

export type UpdateItemInput = z.infer<typeof UpdateItemInputSchema>;
