import { formatBytes } from './bytes'

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1000, '1 KB'],
    [1499, '1 KB'],
    [999_400, '999 KB'],
    [5_400_000, '5 MB'],
    [734_000_000, '734 MB'],
    [1_234_567_890, '1.23 GB'],
    [2e9, '2.00 GB'],
  ])('formats %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })

  it('moves up a unit when rounding would reach 1000', () => {
    expect(formatBytes(999_600)).toBe('1 MB')
    expect(formatBytes(999_600_000)).toBe('1.00 GB')
  })

  it('stays in GB above 1000 GB', () => {
    expect(formatBytes(1.5e12)).toBe('1500.00 GB')
  })

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('throws for %d', (bytes) => {
    expect(() => formatBytes(bytes)).toThrow(RangeError)
  })
})
