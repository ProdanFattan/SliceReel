import { planRound } from './planRound'
import type { InvalidRoundPlan, RoundPlan, RoundSettings, ValidRoundPlan } from './roundPlan'

const settings = (override: Partial<RoundSettings> = {}): RoundSettings => ({
  clipLengthSec: 30,
  clipCount: 2,
  includeLeftover: false,
  ...override,
})

function expectValid(plan: RoundPlan): ValidRoundPlan {
  if (!plan.ok) throw new Error(`Expected a valid plan, got ${plan.issue.code}`)
  return plan
}

function expectInvalid(plan: RoundPlan): InvalidRoundPlan {
  if (plan.ok) throw new Error('Expected an invalid plan')
  return plan
}

describe('planRound', () => {
  describe('a valid request', () => {
    it('lays out consecutive clips from the cursor', () => {
      const plan = expectValid(planRound({ durationSec: 200, cursorSec: 50 }, settings()))

      expect(plan.clips).toEqual([
        { startSec: 50, endSec: 80, isLeftover: false },
        { startSec: 80, endSec: 110, isLeftover: false },
      ])
      expect(plan).toMatchObject({
        startSec: 50,
        endSec: 110,
        requestedSec: 60,
        remainingSec: 150,
        leftoverSec: 0,
        remainingAfterSec: 90,
        afterRound: 'time_remains',
      })
    })

    it('uses up the video when the clips fill exactly what is left', () => {
      const plan = expectValid(planRound({ durationSec: 60, cursorSec: 0 }, settings()))

      expect(plan.remainingAfterSec).toBe(0)
      expect(plan.afterRound).toBe('video_used_up')
    })

    it('treats a tail inside the tolerance as used up', () => {
      const plan = expectValid(planRound({ durationSec: 60.3, cursorSec: 0 }, settings()))

      expect(plan.afterRound).toBe('video_used_up')
      expect(plan.remainingAfterSec).toBe(0)
    })

    it('accepts clips that overrun the end within the tolerance and clamps the last one', () => {
      const plan = expectValid(planRound({ durationSec: 59.8, cursorSec: 0 }, settings()))

      expect(plan.clips.at(-1)?.endSec).toBe(59.8)
      expect(plan.endSec).toBe(59.8)
      expect(plan.afterRound).toBe('video_used_up')
    })
  })

  describe('the leftover clip', () => {
    const position = { durationSec: 75, cursorSec: 0 }

    it('saves a tail shorter than one clip when asked', () => {
      const plan = expectValid(planRound(position, settings({ includeLeftover: true })))

      expect(plan.clips.at(-1)).toEqual({ startSec: 60, endSec: 75, isLeftover: true })
      expect(plan).toMatchObject({
        endSec: 75,
        leftoverSec: 15,
        remainingAfterSec: 0,
        afterRound: 'leftover_saved',
      })
    })

    it('leaves the short tail in place when not asked', () => {
      const plan = expectValid(planRound(position, settings()))

      expect(plan.clips).toHaveLength(2)
      expect(plan).toMatchObject({
        endSec: 60,
        leftoverSec: 0,
        remainingAfterSec: 15,
        afterRound: 'leftover_unsaved',
      })
    })

    it('is not added when a full clip still fits after the round', () => {
      const plan = expectValid(
        planRound({ durationSec: 100, cursorSec: 0 }, settings({ includeLeftover: true })),
      )

      expect(plan.clips.some((clip) => clip.isLeftover)).toBe(false)
      expect(plan.afterRound).toBe('time_remains')
    })

    it('is not added for a tail inside the tolerance', () => {
      const plan = expectValid(
        planRound({ durationSec: 60.4, cursorSec: 0 }, settings({ includeLeftover: true })),
      )

      expect(plan.clips).toHaveLength(2)
      expect(plan.afterRound).toBe('video_used_up')
    })
  })

  describe('an invalid request', () => {
    it('reports a used-up video before checking the settings', () => {
      const plan = expectInvalid(
        planRound({ durationSec: 60, cursorSec: 60 }, settings({ clipLengthSec: 0 })),
      )

      expect(plan.issue).toEqual({ code: 'video_used_up' })
      expect(plan.remainingSec).toBe(0)
    })

    it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects a clip length of %s',
      (clipLengthSec) => {
        const plan = expectInvalid(
          planRound({ durationSec: 60, cursorSec: 0 }, settings({ clipLengthSec })),
        )
        expect(plan.issue.code).toBe('invalid_clip_length')
      },
    )

    it.each([0, -1, 1.5, Number.NaN])('rejects a clip count of %s', (clipCount) => {
      const plan = expectInvalid(
        planRound({ durationSec: 60, cursorSec: 0 }, settings({ clipCount })),
      )
      expect(plan.issue.code).toBe('invalid_clip_count')
    })

    it('offers to cut the rest when one clip is longer than what is left', () => {
      const plan = expectInvalid(
        planRound({ durationSec: 100, cursorSec: 80 }, settings({ clipCount: 3 })),
      )

      expect(plan.issue).toEqual({
        code: 'clip_longer_than_remaining',
        requestedSec: 90,
        fix: { kind: 'cut_rest', lengthSec: 20 },
      })
    })

    it('offers the largest clip count that fits when the clips overrun', () => {
      const plan = expectInvalid(
        planRound(
          { durationSec: 100, cursorSec: 0 },
          settings({ clipLengthSec: 30, clipCount: 5 }),
        ),
      )

      expect(plan.issue).toEqual({
        code: 'over_limit',
        requestedSec: 150,
        fix: { kind: 'set_clip_count', clipCount: 3 },
      })
    })

    it('counts a clip that fits within the tolerance in the suggested count', () => {
      const plan = expectInvalid(
        planRound(
          { durationSec: 89.7, cursorSec: 0 },
          settings({ clipLengthSec: 30, clipCount: 4 }),
        ),
      )

      expect(plan.issue).toMatchObject({ fix: { kind: 'set_clip_count', clipCount: 3 } })
    })

    it('produces a fix that makes the plan valid', () => {
      const position = { durationSec: 100, cursorSec: 0 }
      const plan = expectInvalid(planRound(position, settings({ clipCount: 5 })))
      if (plan.issue.code !== 'over_limit' || plan.issue.fix.kind !== 'set_clip_count') {
        throw new Error('Expected a clip count fix')
      }

      const fixed = planRound(position, settings({ clipCount: plan.issue.fix.clipCount }))
      expect(fixed.ok).toBe(true)
    })
  })
})
