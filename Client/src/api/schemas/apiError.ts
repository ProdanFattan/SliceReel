import { z } from 'zod'

/**
 * Body of every non-2xx response. `code` stays an open string so a new server
 * code does not break parsing; the client branches only on the codes it knows.
 */
export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
})

export type ApiErrorBody = z.infer<typeof apiErrorSchema>
