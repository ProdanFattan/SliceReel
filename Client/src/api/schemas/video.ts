import { z } from 'zod'
import { idSchema, secondsSchema, timestampSchema } from './primitives'
import { roundSchema } from './round'

export const videoSchema = z.object({
  id: idSchema,
  fileName: z.string().min(1),
  sizeBytes: z.int().nonnegative(),
  durationSec: z.number().positive(),
  width: z.int().positive(),
  height: z.int().positive(),
  codec: z.string().min(1),
  /** Where the next round starts. */
  cursorSec: secondsSchema,
  expiresAt: timestampSchema,
  /** Oldest first. */
  rounds: z.array(roundSchema),
})

export type Video = z.infer<typeof videoSchema>
