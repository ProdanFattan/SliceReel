import { z } from 'zod'
import { idSchema, secondsSchema } from './primitives'

export const clipSchema = z.object({
  id: idSchema,
  index: z.int().nonnegative(),
  startSec: secondsSchema,
  endSec: secondsSchema,
  isLeftover: z.boolean(),
  isReady: z.boolean(),
})

export type Clip = z.infer<typeof clipSchema>
