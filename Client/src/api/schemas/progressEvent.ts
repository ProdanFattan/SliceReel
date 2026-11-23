import { z } from 'zod'
import { idSchema, secondsSchema } from './primitives'
import { roundSchema } from './round'

const roundProgressSchema = z.object({
  type: z.literal('round.progress'),
  roundId: idSchema,
  progress: z.number().min(0).max(1),
  clipsDone: z.int().nonnegative(),
})

const roundReadySchema = z.object({
  type: z.literal('round.ready'),
  round: roundSchema,
})

const roundFailedSchema = z.object({
  type: z.literal('round.failed'),
  roundId: idSchema,
  error: z.string(),
  /** The cursor after the server rolled back the failed round. */
  cursorSec: secondsSchema,
})

const videoExpiredSchema = z.object({
  type: z.literal('video.expired'),
})

/** One message on the per-video SSE stream. */
export const progressEventSchema = z.discriminatedUnion('type', [
  roundProgressSchema,
  roundReadySchema,
  roundFailedSchema,
  videoExpiredSchema,
])

export type ProgressEvent = z.infer<typeof progressEventSchema>
