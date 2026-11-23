import { cutRequestSchema } from './cutRequest'

describe('cutRequestSchema', () => {
  it('accepts a clips request', () => {
    const request = {
      kind: 'clips',
      mode: 'exact',
      startSec: 12.5,
      clipLengthSec: 30,
      clipCount: 4,
      includeLeftover: true,
    }
    expect(cutRequestSchema.parse(request)).toEqual(request)
  })

  it('accepts a rest request with only mode and start', () => {
    const request = { kind: 'rest', mode: 'fast', startSec: 90 }
    expect(cutRequestSchema.parse(request)).toEqual(request)
  })

  it.each([
    ['a zero clip length', { clipLengthSec: 0 }],
    ['a fractional clip count', { clipCount: 1.5 }],
    ['zero clips', { clipCount: 0 }],
    ['a negative start', { startSec: -1 }],
  ])('rejects %s', (_label, override) => {
    const request = {
      kind: 'clips',
      mode: 'fast',
      startSec: 0,
      clipLengthSec: 30,
      clipCount: 2,
      includeLeftover: false,
      ...override,
    }
    expect(cutRequestSchema.safeParse(request).success).toBe(false)
  })

  it('rejects a clips request missing its clip fields', () => {
    expect(cutRequestSchema.safeParse({ kind: 'clips', mode: 'fast', startSec: 0 }).success).toBe(
      false,
    )
  })
})
