import { isVideoUsedUp, remainingSec } from './timeline'

describe('remainingSec', () => {
  it('returns the time after the cursor', () => {
    expect(remainingSec(120, 45)).toBe(75)
  })

  it.each([
    ['a tail inside the tolerance', 120, 119.7],
    ['a cursor at the end', 120, 120],
    ['a cursor past the end', 120, 121],
  ])('snaps %s to 0', (_label, duration, cursor) => {
    expect(remainingSec(duration, cursor)).toBe(0)
  })

  it.each([
    ['a zero duration', 0, 0],
    ['a non-finite duration', Number.NaN, 0],
    ['a negative cursor', 120, -1],
    ['a non-finite cursor', 120, Number.POSITIVE_INFINITY],
  ])('throws for %s', (_label, duration, cursor) => {
    expect(() => remainingSec(duration, cursor)).toThrow(RangeError)
  })
})

describe('isVideoUsedUp', () => {
  it('is true only when nothing is left', () => {
    expect(isVideoUsedUp(120, 119.8)).toBe(true)
    expect(isVideoUsedUp(120, 100)).toBe(false)
  })
})
