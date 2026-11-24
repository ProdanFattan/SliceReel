import { formatTime, parseTime } from './time'

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [5, '0:05'],
    [65, '1:05'],
    [599, '9:59'],
    [3599, '59:59'],
    [3600, '1:00:00'],
    [3725, '1:02:05'],
    [36000, '10:00:00'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatTime(seconds)).toBe(expected)
  })

  it('rounds before splitting so seconds never show 60', () => {
    expect(formatTime(59.6)).toBe('1:00')
    expect(formatTime(3599.5)).toBe('1:00:00')
  })

  it('clamps negative values to zero', () => {
    expect(formatTime(-0.0001)).toBe('0:00')
    expect(formatTime(-30)).toBe('0:00')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('throws for %d', (value) => {
    expect(() => formatTime(value)).toThrow(RangeError)
  })
})

describe('parseTime', () => {
  it.each([
    ['0', 0],
    ['90', 90],
    ['1:30', 90],
    ['0:05', 5],
    ['1:02:05', 3725],
    ['12:30.5', 750.5],
    ['  1:30  ', 90],
  ])('parses %s as %d seconds', (input, expected) => {
    expect(parseTime(input)).toBe(expected)
  })

  it.each(['', 'abc', '1:', ':30', '1:2:3:4', '-5', '1:60', '1:60:00', '1,5', '1:30.'])(
    'returns null for %j',
    (input) => {
      expect(parseTime(input)).toBeNull()
    },
  )

  it('round-trips with formatTime', () => {
    for (const seconds of [0, 59, 61, 3599, 3600, 7322]) {
      expect(parseTime(formatTime(seconds))).toBe(seconds)
    }
  })
})
