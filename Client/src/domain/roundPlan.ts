export interface RoundSettings {
  clipLengthSec: number
  clipCount: number
  /** Save a tail shorter than one clip as its own clip (F11). */
  includeLeftover: boolean
}

export interface TimelinePosition {
  durationSec: number
  cursorSec: number
}

export interface PlannedClip {
  startSec: number
  endSec: number
  isLeftover: boolean
}

/** A one-click change that turns an invalid request into a valid one. */
export type PlanFix =
  | { kind: 'set_clip_count'; clipCount: number }
  /** Cut everything that is left as a single `rest` round. */
  | { kind: 'cut_rest'; lengthSec: number }

export type PlanIssue =
  | { code: 'video_used_up' }
  | { code: 'invalid_clip_length' }
  | { code: 'invalid_clip_count' }
  | { code: 'clip_longer_than_remaining'; requestedSec: number; fix: PlanFix }
  | { code: 'over_limit'; requestedSec: number; fix: PlanFix }

/** What the video looks like once this round is cut. */
export type AfterRound =
  | 'video_used_up'
  | 'leftover_saved'
  /** A tail shorter than one clip stays; only a `rest` round can use it. */
  | 'leftover_unsaved'
  | 'time_remains'

interface PlanBase {
  startSec: number
  remainingSec: number
}

export interface ValidRoundPlan extends PlanBase {
  ok: true
  endSec: number
  clips: PlannedClip[]
  /** Length of the clips without the leftover. */
  requestedSec: number
  /** `0` unless a leftover clip is saved. */
  leftoverSec: number
  remainingAfterSec: number
  afterRound: AfterRound
}

export interface InvalidRoundPlan extends PlanBase {
  ok: false
  issue: PlanIssue
}

export type RoundPlan = ValidRoundPlan | InvalidRoundPlan
