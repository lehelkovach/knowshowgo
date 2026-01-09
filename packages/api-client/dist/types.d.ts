import { z } from "zod";
export declare const HealthResponseSchema: z.ZodObject<{
    ok: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
}, {
    ok: boolean;
}>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export declare const ItemSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
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
    content: string;
    createdAt: string;
    updatedAt: string;
}>;
export type Item = z.infer<typeof ItemSchema>;
export declare const ListItemsResponseSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
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
        content: string;
        createdAt: string;
        updatedAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    }[];
}, {
    items: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    }[];
}>;
export type ListItemsResponse = z.infer<typeof ListItemsResponseSchema>;
export declare const GetItemResponseSchema: z.ZodObject<{
    item: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
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
        content: string;
        createdAt: string;
        updatedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    item: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    };
}, {
    item: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    };
}>;
export type GetItemResponse = z.infer<typeof GetItemResponseSchema>;
export declare const CreateItemRequestSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content?: string | undefined;
}, {
    title: string;
    content?: string | undefined;
}>;
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;
export declare const CreateItemResponseSchema: z.ZodObject<{
    item: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
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
        content: string;
        createdAt: string;
        updatedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    item: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    };
}, {
    item: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    };
}>;
export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;
export declare const UpdateItemRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    content?: string | undefined;
}, {
    title?: string | undefined;
    content?: string | undefined;
}>;
export type UpdateItemRequest = z.infer<typeof UpdateItemRequestSchema>;
export declare const UpdateItemResponseSchema: z.ZodObject<{
    item: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
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
        content: string;
        createdAt: string;
        updatedAt: string;
    }>;
}, "strip", z.ZodTypeAny, {
    item: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    };
}, {
    item: {
        id: string;
        title: string;
        content: string;
        createdAt: string;
        updatedAt: string;
    };
}>;
export type UpdateItemResponse = z.infer<typeof UpdateItemResponseSchema>;
export declare const ErrorResponseSchema: z.ZodObject<{
    error: z.ZodString;
    details: z.ZodOptional<z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    error: string;
    details?: unknown;
}, {
    error: string;
    details?: unknown;
}>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
//# sourceMappingURL=types.d.ts.map