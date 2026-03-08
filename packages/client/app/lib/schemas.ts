import { z } from "zod";

export const sessionExistsSchema = z.object({
  exists: z.boolean(),
});

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  createdAt: z.string(),
  participants: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      connectedAt: z.string(),
    }),
  ),
});

export type SessionExistsResponse = z.infer<typeof sessionExistsSchema>;
export type SessionResponse = z.infer<typeof sessionSchema>;
