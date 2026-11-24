import type { CutMode, ProgressEvent, Round } from '@/api/schemas'
import type { EventHub } from './EventHub'
import type { MockVideoStore } from './MockVideoStore'
import { simulateProgress } from './simulateProgress'

export interface CutTiming {
  msPerClip: Record<CutMode, number>
  tickMs: number
}

interface CutSimulatorDeps {
  store: MockVideoStore
  events: EventHub<ProgressEvent>
  timing: CutTiming
}

/** Plays the part of the cutting workers: moves rounds to `ready` and publishes progress. */
export class CutSimulator {
  readonly #deps: CutSimulatorDeps
  readonly #running = new Map<string, () => void>()

  constructor(deps: CutSimulatorDeps) {
    this.#deps = deps
  }

  start(videoId: string, round: Round): void {
    const { msPerClip, tickMs } = this.#deps.timing
    const cancel = simulateProgress({
      durationMs: msPerClip[round.mode] * round.clips.length,
      tickMs,
      onTick: (fraction) => this.#advance(videoId, round.id, fraction),
      onDone: () => this.#finish(videoId, round.id),
    })
    this.#running.set(round.id, cancel)
  }

  cancel(roundId: string): void {
    this.#running.get(roundId)?.()
    this.#running.delete(roundId)
  }

  cancelAll(rounds: readonly Round[]): void {
    for (const round of rounds) this.cancel(round.id)
  }

  isRunning(roundId: string): boolean {
    return this.#running.has(roundId)
  }

  #advance(videoId: string, roundId: string, fraction: number): void {
    const round = this.#deps.store.findRound(videoId, roundId)
    if (!round) return this.cancel(roundId)

    const clipsDone = Math.floor(fraction * round.clips.length)
    round.status = 'cutting'
    round.progress = fraction
    round.clipsDone = clipsDone
    round.clips.forEach((clip, index) => (clip.isReady = index < clipsDone))

    this.#deps.events.publish(videoId, {
      type: 'round.progress',
      roundId,
      progress: fraction,
      clipsDone,
    })
  }

  #finish(videoId: string, roundId: string): void {
    this.#running.delete(roundId)
    const round = this.#deps.store.findRound(videoId, roundId)
    if (!round) return

    round.status = 'ready'
    round.progress = 1
    round.clipsDone = round.clips.length
    round.clips.forEach((clip) => (clip.isReady = true))

    this.#deps.events.publish(videoId, { type: 'round.ready', round: structuredClone(round) })
  }
}
