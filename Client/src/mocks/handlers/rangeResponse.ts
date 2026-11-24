import { HttpResponse } from 'msw'

interface ByteRange {
  start: number
  end: number
}

const RANGE_PATTERN = /^bytes=(\d*)-(\d*)$/

/** Parses a single `bytes=` range. Returns `null` when it is malformed or unsatisfiable. */
export function parseRange(header: string, size: number): ByteRange | null {
  const match = RANGE_PATTERN.exec(header.trim())
  if (!match) return null
  const [, startText = '', endText = ''] = match
  if (startText === '' && endText === '') return null

  if (startText === '') {
    const suffixLength = Number(endText)
    if (suffixLength === 0) return null
    return { start: Math.max(0, size - suffixLength), end: size - 1 }
  }

  const start = Number(startText)
  const end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1)
  return start <= end && start < size ? { start, end } : null
}

/** Serves a blob with `Range` support so the video element can seek. */
export function rangeResponse(file: Blob, rangeHeader: string | null): Response {
  const baseHeaders = { 'accept-ranges': 'bytes', 'content-type': file.type }
  if (rangeHeader === null) {
    return new HttpResponse(file, {
      headers: { ...baseHeaders, 'content-length': String(file.size) },
    })
  }

  const range = parseRange(rangeHeader, file.size)
  if (!range) {
    return new HttpResponse(null, {
      status: 416,
      headers: { 'content-range': `bytes */${file.size}` },
    })
  }

  const { start, end } = range
  return new HttpResponse(file.slice(start, end + 1), {
    status: 206,
    headers: {
      ...baseHeaders,
      'content-length': String(end - start + 1),
      'content-range': `bytes ${start}-${end}/${file.size}`,
    },
  })
}
