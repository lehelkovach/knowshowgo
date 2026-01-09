import { z } from "zod";
export declare const ItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    content: z.ZodDefault<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}, {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    content?: string | undefined;
}>;
export type Item = z.infer<typeof ItemSchema>;
export declare const CreateItemInputSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodDefault<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
}, {
    title: string;
    content?: string | undefined;
}>;
export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;
export declare const UpdateItemInputSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    content?: string | undefined;
}, {
    title?: string | undefined;
    content?: string | undefined;
}>;
export type UpdateItemInput = z.infer<typeof UpdateItemInputSchema>;
//# sourceMappingURL=types.d.ts.map