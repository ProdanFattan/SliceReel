import { progressEventSchema } from './progressEvent'

describe('progressEventSchema', () => {
  it('parses a progress message', () => {
    const event = progressEventSchema.parse({
      type: 'round.progress',
      roundId: 'r1',
      progress: 0.25,
      clipsDone: 1,
    })
    expect(event.type).toBe('round.progress')
  })

  it('parses a failure with the rolled-back cursor', () => {
    const event = progressEventSchema.parse({
      type: 'round.failed',
      roundId: 'r1',
      error: 'ffmpeg exited with code 1',
      cursorSec: 30,
    })
    expect(event).toMatchObject({ type: 'round.failed', cursorSec: 30 })
  })

  it('parses an expiry message', () => {
    expect(progressEventSchema.parse({ type: 'video.expired' })).toEqual({ type: 'video.expired' })
  })

  it('rejects an unknown event type', () => {
    expect(progressEventSchema.safeParse({ type: 'round.paused', roundId: 'r1' }).success).toBe(
      false,
    )
  })
})
