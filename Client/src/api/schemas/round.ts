import { z } from 'zod'
import { clipSchema } from './clip'
import { idSchema, secondsSchema, timestampSchema } from './primitives'

export const cutModeSchema = z.enum(['fast', 'exact'])
export type CutMode = z.infer<typeof cutModeSchema>

export const roundStatusSchema = z.enum(['queued', 'cutting', 'ready', 'failed'])
export type RoundStatus = z.infer<typeof roundStatusSchema>

/**
 * `clips`: `clipCount` clips of `clipLengthSec`, plus an optional leftover clip.
 * `rest`: one leftover clip covering whatever is left when it is shorter than a full clip.
 */
export const roundKindSchema = z.enum(['clips', 'rest'])
export type RoundKind = z.infer<typeof roundKindSchema>

export const roundSchema = z.object({
  id: idSchema,
  number: z.int().positive(),
  kind: roundKindSchema,
  mode: cutModeSchema,
  clipLengthSec: secondsSchema.nullable(),
  clipCount: z.int().nonnegative(),
  startSec: secondsSchema,
  endSec: secondsSchema,
  status: roundStatusSchema,
  progress: z.number().min(0).max(1),
  clipsDone: z.int().nonnegative(),
  clips: z.array(clipSchema).min(1),
  error: z.string().nullable(),
  createdAt: timestampSchema,
})

export type Round = z.infer<typeof roundSchema>
