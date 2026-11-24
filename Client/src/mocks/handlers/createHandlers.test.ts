// @vitest-environment node
import { apiErrorSchema, progressEventSchema, roundSchema, videoSchema } from '@/api/schemas'
import { createMockServer } from '@/mocks/node'
import { clipsRequest, TEST_BACKEND_OPTIONS, videoFile } from '@/test/mockBackend'

const API = 'http://slicereel.test/api'
const { server } = createMockServer(TEST_BACKEND_OPTIONS, API)

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())

async function upload(file = videoFile()) {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${API}/videos`, { method: 'POST', body: form })
}

async function uploadVideo() {
  return videoSchema.parse(await (await upload()).json())
}

function postRound(videoId: string, body: unknown) {
  return fetch(`${API}/videos/${videoId}/rounds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function readEvents(response: Response, count: number) {
  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()
  if (!reader) throw new Error('The event stream has no body')
  let buffer = ''
  const dataMessages = () => buffer.split('\n\n').filter((message) => message.startsWith('data: '))
  while (dataMessages().length < count) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
  }
  await reader.cancel()
  return dataMessages()
    .slice(0, count)
    .map((message) => progressEventSchema.parse(JSON.parse(message.slice('data: '.length))))
}

describe('mock API handlers', () => {
  it('uploads a video and reads it back', async () => {
    const response = await upload()
    expect(response.status).toBe(201)

    const video = videoSchema.parse(await response.json())
    const fetched = await fetch(`${API}/videos/${video.id}`)
    expect(videoSchema.parse(await fetched.json())).toEqual(video)
  })

  it('answers an unknown video with a contract error body', async () => {
    const response = await fetch(`${API}/videos/missing`)

    expect(response.status).toBe(404)
    expect(apiErrorSchema.parse(await response.json()).code).toBe('not_found')
  })

  it('rejects an upload without a file field', async () => {
    const response = await fetch(`${API}/videos`, { method: 'POST', body: new FormData() })
    expect(response.status).toBe(400)
  })

  it('creates a round with 202 and undoes it', async () => {
    const video = await uploadVideo()

    const created = await postRound(video.id, clipsRequest(0))
    expect(created.status).toBe(202)
    const round = roundSchema.parse(await created.json())

    const undone = await fetch(`${API}/videos/${video.id}/rounds/${round.id}`, { method: 'DELETE' })
    expect(videoSchema.parse(await undone.json())).toMatchObject({ cursorSec: 0, rounds: [] })
  })

  it('rejects a body that is not JSON', async () => {
    const video = await uploadVideo()
    const response = await fetch(`${API}/videos/${video.id}/rounds`, {
      method: 'POST',
      body: 'not json',
    })
    expect(response.status).toBe(400)
  })

  it('streams progress events until the round is ready', async () => {
    const video = await uploadVideo()
    const stream = await fetch(`${API}/videos/${video.id}/events`)
    expect(stream.headers.get('content-type')).toBe('text/event-stream')

    await postRound(video.id, clipsRequest(0))
    const events = await readEvents(stream, 4)

    expect(events.map((event) => event.type)).toEqual([
      'round.progress',
      'round.progress',
      'round.progress',
      'round.ready',
    ])
  })

  it('serves the source video with range support', async () => {
    const video = await uploadVideo()
    const response = await fetch(`${API}/videos/${video.id}/stream`, {
      headers: { range: 'bytes=0-9' },
    })

    expect(response.status).toBe(206)
    expect((await response.arrayBuffer()).byteLength).toBe(10)
  })

  it('downloads a ready clip as an attachment', async () => {
    const video = await uploadVideo()
    const stream = await fetch(`${API}/videos/${video.id}/events`)
    const round = roundSchema.parse(await (await postRound(video.id, clipsRequest(0))).json())
    await readEvents(stream, 4)

    const response = await fetch(`${API}/videos/${video.id}/clips/${round.clips[0]?.id}/download`)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toBe(
      "attachment; filename*=UTF-8''holiday-round1-clip1.mp4",
    )
  })
})
