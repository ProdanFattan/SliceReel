import { z } from 'zod'

export const idSchema = z.string().min(1)

/** A point or length on the video timeline, in seconds (fractions allowed). */
export const secondsSchema = z.number().nonnegative()

export const timestampSchema = z.iso.datetime({ offset: true })
