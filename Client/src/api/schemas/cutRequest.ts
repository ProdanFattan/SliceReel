import { z } from 'zod'
import { secondsSchema } from './primitives'
import { cutModeSchema } from './round'

/**
 * `startSec` must equal the cursor the client saw. The server rejects the request
 * with `cursor_moved` otherwise, so two tabs cannot cut overlapping rounds.
 */
const cutRequestBase = {
  mode: cutModeSchema,
  startSec: secondsSchema,
}

export const cutRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    ...cutRequestBase,
    kind: z.literal('clips'),
    clipLengthSec: z.number().positive(),
    clipCount: z.int().positive(),
    includeLeftover: z.boolean(),
  }),
  z.object({
    ...cutRequestBase,
    kind: z.literal('rest'),
  }),
])

export type CutRequest = z.infer<typeof cutRequestSchema>
