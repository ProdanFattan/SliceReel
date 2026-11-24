// @vitest-environment node -- jsdom's Blob is not a valid body for Node's Response.
import { parseRange, rangeResponse } from './rangeResponse'

describe('parseRange', () => {
  it.each([
    ['bytes=0-99', { start: 0, end: 99 }],
    ['bytes=900-', { start: 900, end: 999 }],
    ['bytes=-100', { start: 900, end: 999 }],
    ['bytes=500-5000', { start: 500, end: 999 }],
  ])('parses %s', (header, expected) => {
    expect(parseRange(header, 1000)).toEqual(expected)
  })

  it.each(['bytes=-', 'bytes=1000-', 'bytes=50-10', 'bytes=-0', 'items=0-1', 'bytes=0-1,5-9'])(
    'rejects %s',
    (header) => {
      expect(parseRange(header, 1000)).toBeNull()
    },
  )
})

describe('rangeResponse', () => {
  const file = new Blob([new Uint8Array(1000)], { type: 'video/mp4' })

  it('serves the whole file without a range', () => {
    const response = rangeResponse(file, null)

    expect(response.status).toBe(200)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
  })

  it('serves a partial response for a range', async () => {
    const response = rangeResponse(file, 'bytes=100-199')

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 100-199/1000')
    expect((await response.arrayBuffer()).byteLength).toBe(100)
  })

  it('answers 416 for an unsatisfiable range', () => {
    const response = rangeResponse(file, 'bytes=2000-')

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */1000')
  })
})
