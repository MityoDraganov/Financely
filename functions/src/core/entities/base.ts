import z from "zod";

export const baseEntitySchema = z.object({
  id: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type BaseEntity = z.infer<typeof baseEntitySchema>;
