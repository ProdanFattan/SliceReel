import { cutRequestSchema, type ProgressEvent, type Round, type Video } from '@/api/schemas'
import { buildRound } from './buildRound'
import { CutSimulator } from './CutSimulator'
import { clipDownload, roundZipDownload } from './downloads'
import { EventHub, type EventSink } from './EventHub'
import { MockApiError } from './MockApiError'
import { MockVideoStore } from './MockVideoStore'
import type { DownloadFile, IdGenerator, MockBackendOptions, VideoInfo } from './types'

const DEFAULT_OPTIONS: Omit<MockBackendOptions, 'probe'> = {
  maxUploadBytes: 2e9,
  retentionMs: 24 * 60 * 60 * 1000,
  processingDelayMs: 0,
  cutMsPerClip: { fast: 450, exact: 1500 },
  progressTickMs: 100,
  now: () => new Date(),
}

function createIdGenerator(): IdGenerator {
  let counter = 0
  return (prefix) => `${prefix}_${++counter}`
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * An in-memory stand-in for the SliceReel server, shaped like the API contract.
 * Every method returns copies, so callers cannot change stored state by accident.
 */
export class MockBackend {
  readonly #options: MockBackendOptions
  readonly #store = new MockVideoStore()
  readonly #events = new EventHub<ProgressEvent>()
  readonly #cuts: CutSimulator
  readonly #expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  readonly #nextId = createIdGenerator()

  constructor(options: Partial<MockBackendOptions> & Pick<MockBackendOptions, 'probe'>) {
    this.#options = { ...DEFAULT_OPTIONS, ...options }
    this.#cuts = new CutSimulator({
      store: this.#store,
      events: this.#events,
      timing: { msPerClip: this.#options.cutMsPerClip, tickMs: this.#options.progressTickMs },
    })
  }

  async uploadVideo(file: File): Promise<Video> {
    this.#assertUploadable(file)
    const info = await this.#readInfo(file)
    if (this.#options.processingDelayMs > 0) await sleep(this.#options.processingDelayMs)

    const now = this.#options.now()
    const video: Video = {
      id: this.#nextId('video'),
      fileName: file.name,
      sizeBytes: file.size,
      durationSec: info.durationSec,
      width: info.width,
      height: info.height,
      codec: info.codec,
      cursorSec: 0,
      expiresAt: new Date(now.getTime() + this.#options.retentionMs).toISOString(),
      rounds: [],
    }
    this.#store.add({ video, file })
    this.#scheduleExpiry(video.id)
    return structuredClone(video)
  }

  getVideo(videoId: string): Video {
    return structuredClone(this.#store.require(videoId).video)
  }

  deleteVideo(videoId: string): void {
    const { video } = this.#store.require(videoId)
    this.#dispose(video)
    this.#store.remove(videoId)
  }

  createRound(videoId: string, body: unknown): Round {
    const { video } = this.#store.require(videoId)
    const parsed = cutRequestSchema.safeParse(body)
    if (!parsed.success) {
      throw new MockApiError(400, 'invalid_request', 'The cut request is not valid.')
    }
    if (parsed.data.startSec !== video.cursorSec) {
      throw new MockApiError(
        409,
        'cursor_moved',
        'The video was cut elsewhere. Reload and try again.',
      )
    }

    const round = buildRound(video, parsed.data, this.#nextId, this.#options.now())
    video.rounds.push(round)
    video.cursorSec = round.endSec
    this.#cuts.start(videoId, round)
    return structuredClone(round)
  }

  undoRound(videoId: string, roundId: string): Video {
    const { video } = this.#store.require(videoId)
    const round = this.#store.requireRound(videoId, roundId)
    if (round !== video.rounds.at(-1)) {
      throw new MockApiError(409, 'not_last_round', 'Only the last round can be undone.')
    }

    this.#cuts.cancel(roundId)
    video.rounds.pop()
    video.cursorSec = round.startSec
    return structuredClone(video)
  }

  subscribe(videoId: string, sink: EventSink<ProgressEvent>): () => void {
    this.#store.require(videoId)
    return this.#events.subscribe(videoId, sink)
  }

  getSourceFile(videoId: string): File {
    return this.#store.require(videoId).file
  }

  getClipDownload(videoId: string, clipId: string): DownloadFile {
    const { video } = this.#store.require(videoId)
    for (const round of video.rounds) {
      const clip = round.clips.find((candidate) => candidate.id === clipId)
      if (!clip) continue
      if (!clip.isReady) throw new MockApiError(409, 'not_ready', 'This clip is still being cut.')
      return clipDownload(video, round, clip)
    }
    throw new MockApiError(404, 'not_found', 'Clip not found.')
  }

  getRoundZip(videoId: string, roundId: string): DownloadFile {
    const { video } = this.#store.require(videoId)
    const round = this.#store.requireRound(videoId, roundId)
    if (round.status !== 'ready') {
      throw new MockApiError(409, 'not_ready', 'This round is still being cut.')
    }
    return roundZipDownload(video, round)
  }

  #assertUploadable(file: File): void {
    if (file.size > this.#options.maxUploadBytes) {
      throw new MockApiError(413, 'file_too_large', 'The file is over the upload limit.')
    }
    if (!file.type.startsWith('video/')) {
      throw new MockApiError(415, 'unsupported_media', 'The file is not a video.')
    }
  }

  async #readInfo(file: File): Promise<VideoInfo> {
    try {
      return await this.#options.probe(file)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new MockApiError(415, 'unsupported_media', `The video could not be read: ${reason}`)
    }
  }

  #scheduleExpiry(videoId: string): void {
    const timer = setTimeout(() => this.#expire(videoId), this.#options.retentionMs)
    this.#expiryTimers.set(videoId, timer)
  }

  #expire(videoId: string): void {
    const { video } = this.#store.require(videoId)
    this.#events.publish(videoId, { type: 'video.expired' })
    this.#dispose(video)
    this.#store.expire(videoId)
  }

  #dispose(video: Video): void {
    clearTimeout(this.#expiryTimers.get(video.id))
    this.#expiryTimers.delete(video.id)
    this.#cuts.cancelAll(video.rounds)
    this.#events.closeAll(video.id)
  }
}
