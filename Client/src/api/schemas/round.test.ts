import { roundSchema } from './round'

const validRound = {
  id: 'r1',
  number: 1,
  kind: 'clips',
  mode: 'fast',
  clipLengthSec: 30,
  clipCount: 2,
  startSec: 0,
  endSec: 60,
  status: 'cutting',
  progress: 0.5,
  clipsDone: 1,
  clips: [
    { id: 'c1', index: 0, startSec: 0, endSec: 30, isLeftover: false, isReady: true },
    { id: 'c2', index: 1, startSec: 30, endSec: 60, isLeftover: false, isReady: false },
  ],
  error: null,
  createdAt: '2026-11-23T10:00:00Z',
}

describe('roundSchema', () => {
  it('accepts a valid round', () => {
    expect(roundSchema.parse(validRound)).toEqual(validRound)
  })

  it('accepts a rest round with no clip length', () => {
    const rest = { ...validRound, kind: 'rest', clipLengthSec: null, clipCount: 0 }
    expect(roundSchema.safeParse(rest).success).toBe(true)
  })

  it.each([
    ['an unknown status', { status: 'done' }],
    ['progress above 1', { progress: 1.2 }],
    ['no clips', { clips: [] }],
    ['a non-ISO createdAt', { createdAt: 'yesterday' }],
  ])('rejects %s', (_label, override) => {
    expect(roundSchema.safeParse({ ...validRound, ...override }).success).toBe(false)
  })
})
