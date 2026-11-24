import type { Round, Video } from '@/api/schemas'
import { MockApiError } from './MockApiError'

export interface VideoRecord {
  video: Video
  file: File
}

/** In-memory videos. Expired ids are remembered so they answer `410` instead of `404`. */
export class MockVideoStore {
  readonly #records = new Map<string, VideoRecord>()
  readonly #expiredIds = new Set<string>()

  add(record: VideoRecord): void {
    this.#records.set(record.video.id, record)
  }

  require(videoId: string): VideoRecord {
    const record = this.#records.get(videoId)
    if (record) return record
    if (this.#expiredIds.has(videoId)) {
      throw new MockApiError(410, 'expired', 'This video was deleted after its time limit.')
    }
    throw new MockApiError(404, 'not_found', 'Video not found.')
  }

  remove(videoId: string): void {
    this.#records.delete(videoId)
  }

  expire(videoId: string): void {
    this.#records.delete(videoId)
    this.#expiredIds.add(videoId)
  }

  findRound(videoId: string, roundId: string): Round | undefined {
    return this.#records.get(videoId)?.video.rounds.find((round) => round.id === roundId)
  }

  requireRound(videoId: string, roundId: string): Round {
    this.require(videoId)
    const round = this.findRound(videoId, roundId)
    if (!round) throw new MockApiError(404, 'not_found', 'Round not found.')
    return round
  }
}
