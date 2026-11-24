import type { ProgressEvent } from '@/api/schemas'
import { roundSchema, videoSchema } from '@/api/schemas'
import { clipsRequest, TEST_BACKEND_OPTIONS, videoFile } from '@/test/mockBackend'
import { MockApiError } from './MockApiError'
import { MockBackend } from './MockBackend'
import type { MockBackendOptions } from './types'

function createBackend(overrides: Partial<MockBackendOptions> = {}) {
  return new MockBackend({ ...TEST_BACKEND_OPTIONS, ...overrides })
}

function recordEvents(backend: MockBackend, videoId: string) {
  const events: ProgressEvent[] = []
  const close = vi.fn()
  backend.subscribe(videoId, { send: (event) => events.push(event), close })
  return { events, close }
}

async function expectApiError(action: () => unknown, status: number, code: string) {
  const error: unknown = await Promise.resolve()
    .then(action)
    .then(
      () => null,
      (caught: unknown) => caught,
    )
  expect(error).toBeInstanceOf(MockApiError)
  expect(error).toMatchObject({ status, code })
}

describe('MockBackend', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  describe('uploadVideo', () => {
    it('returns a contract-valid video with the probed info', async () => {
      const video = await createBackend().uploadVideo(videoFile('trip.mp4'))

      expect(videoSchema.parse(video)).toMatchObject({
        fileName: 'trip.mp4',
        sizeBytes: 1000,
        durationSec: 100,
        cursorSec: 0,
        rounds: [],
        expiresAt: '2026-11-24T10:01:00.000Z',
      })
    })

    it('rejects a file over the size limit', async () => {
      const backend = createBackend({ maxUploadBytes: 999 })
      await expectApiError(() => backend.uploadVideo(videoFile()), 413, 'file_too_large')
    })

    it('rejects a file that is not a video', async () => {
      const backend = createBackend()
      await expectApiError(
        () => backend.uploadVideo(videoFile('notes.txt', 'text/plain')),
        415,
        'unsupported_media',
      )
    })

    it('rejects a video the probe cannot read', async () => {
      const backend = createBackend({ probe: () => Promise.reject(new Error('corrupt')) })
      await expectApiError(() => backend.uploadVideo(videoFile()), 415, 'unsupported_media')
    })
  })

  describe('createRound', () => {
    it('queues the round and moves the cursor at once', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())

      const round = backend.createRound(id, clipsRequest(0))

      expect(roundSchema.parse(round)).toMatchObject({ number: 1, status: 'queued', endSec: 60 })
      expect(backend.getVideo(id).cursorSec).toBe(60)
    })

    it('cuts a rest round from the cursor to the end', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      backend.createRound(id, clipsRequest(0, 30, 3))

      const rest = backend.createRound(id, { kind: 'rest', mode: 'exact', startSec: 90 })

      expect(rest).toMatchObject({ kind: 'rest', clipLengthSec: null, clipCount: 0, endSec: 100 })
      expect(rest.clips).toEqual([expect.objectContaining({ startSec: 90, isLeftover: true })])
    })

    it('rejects a start that is not the current cursor', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      backend.createRound(id, clipsRequest(0))

      await expectApiError(() => backend.createRound(id, clipsRequest(0)), 409, 'cursor_moved')
    })

    it('rejects a round longer than what is left', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())

      await expectApiError(() => backend.createRound(id, clipsRequest(0, 30, 4)), 422, 'over_limit')
    })

    it('rejects a malformed request', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())

      await expectApiError(() => backend.createRound(id, { kind: 'clips' }), 400, 'invalid_request')
    })
  })

  describe('cutting progress', () => {
    it('publishes progress, then the ready round', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      const { events } = recordEvents(backend, id)
      const round = backend.createRound(id, clipsRequest(0))

      vi.advanceTimersByTime(100)
      expect(events.at(-1)).toMatchObject({ type: 'round.progress', roundId: round.id })
      expect(backend.getVideo(id).rounds[0]?.status).toBe('cutting')

      vi.advanceTimersByTime(100)
      expect(events.at(-1)).toMatchObject({
        type: 'round.ready',
        round: { id: round.id, status: 'ready', progress: 1, clipsDone: 2 },
      })
      expect(backend.getVideo(id).rounds[0]?.clips.every((clip) => clip.isReady)).toBe(true)
    })

    it('takes longer in exact mode', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      backend.createRound(id, { ...clipsRequest(0), mode: 'exact' })

      vi.advanceTimersByTime(200)
      expect(backend.getVideo(id).rounds[0]?.status).toBe('cutting')
      vi.advanceTimersByTime(400)
      expect(backend.getVideo(id).rounds[0]?.status).toBe('ready')
    })
  })

  describe('undoRound', () => {
    it('removes the last round, cancels it and rolls the cursor back', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      const { events } = recordEvents(backend, id)
      const round = backend.createRound(id, clipsRequest(0))

      const video = backend.undoRound(id, round.id)
      vi.advanceTimersByTime(1000)

      expect(video).toMatchObject({ cursorSec: 0, rounds: [] })
      expect(events).toEqual([])
    })

    it('refuses to undo a round that is not the last', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      const first = backend.createRound(id, clipsRequest(0, 10, 1))
      backend.createRound(id, clipsRequest(10, 10, 1))

      await expectApiError(() => backend.undoRound(id, first.id), 409, 'not_last_round')
    })
  })

  describe('downloads', () => {
    it('serves a clip only once it is ready', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile('trip.mp4'))
      const clipId = backend.createRound(id, clipsRequest(0)).clips[0]?.id ?? ''

      await expectApiError(() => backend.getClipDownload(id, clipId), 409, 'not_ready')
      vi.advanceTimersByTime(200)
      expect(backend.getClipDownload(id, clipId).fileName).toBe('trip-round1-clip1.mp4')
    })

    it('serves a round ZIP only once the round is ready', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile('trip.mp4'))
      const roundId = backend.createRound(id, clipsRequest(0)).id

      await expectApiError(() => backend.getRoundZip(id, roundId), 409, 'not_ready')
      vi.advanceTimersByTime(200)
      expect(backend.getRoundZip(id, roundId).fileName).toBe('trip-round1.zip')
    })
  })

  describe('deleting and expiry', () => {
    it('deletes a video and closes its event streams', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      const { close } = recordEvents(backend, id)

      backend.deleteVideo(id)

      expect(close).toHaveBeenCalledOnce()
      await expectApiError(() => backend.getVideo(id), 404, 'not_found')
    })

    it('auto-deletes a video after the retention time', async () => {
      const backend = createBackend()
      const { id } = await backend.uploadVideo(videoFile())
      const { events, close } = recordEvents(backend, id)

      vi.advanceTimersByTime(60_000)

      expect(events).toEqual([{ type: 'video.expired' }])
      expect(close).toHaveBeenCalledOnce()
      await expectApiError(() => backend.getVideo(id), 410, 'expired')
    })
  })
})
