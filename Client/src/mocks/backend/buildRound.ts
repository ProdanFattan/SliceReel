import type { CutRequest, Round, Video } from '@/api/schemas'
import { planRound } from '@/domain/planRound'
import type { PlanIssue, PlannedClip } from '@/domain/roundPlan'
import { isVideoUsedUp } from '@/domain/timeline'
import { MockApiError } from './MockApiError'
import type { IdGenerator } from './types'

function toApiError(issue: PlanIssue): MockApiError {
  switch (issue.code) {
    case 'invalid_clip_length':
    case 'invalid_clip_count':
      return new MockApiError(400, 'invalid_request', 'Clip length and count must be positive.')
    case 'video_used_up':
    case 'clip_longer_than_remaining':
    case 'over_limit':
      return new MockApiError(422, 'over_limit', 'The round needs more time than is left.')
  }
}

function planClips(video: Video, request: CutRequest): PlannedClip[] {
  const position = { durationSec: video.durationSec, cursorSec: video.cursorSec }

  if (request.kind === 'rest') {
    if (isVideoUsedUp(position.durationSec, position.cursorSec)) {
      throw new MockApiError(422, 'over_limit', 'Nothing is left to cut.')
    }
    return [{ startSec: video.cursorSec, endSec: video.durationSec, isLeftover: true }]
  }

  const plan = planRound(position, request)
  if (!plan.ok) throw toApiError(plan.issue)
  return plan.clips
}

/** Builds a new `queued` round starting at the video's cursor, or throws a `MockApiError`. */
export function buildRound(
  video: Video,
  request: CutRequest,
  nextId: IdGenerator,
  createdAt: Date,
): Round {
  const plannedClips = planClips(video, request)
  const clips = plannedClips.map((clip, index) => ({
    ...clip,
    id: nextId('clip'),
    index,
    isReady: false,
  }))
  const isClips = request.kind === 'clips'

  return {
    id: nextId('round'),
    number: video.rounds.length + 1,
    kind: request.kind,
    mode: request.mode,
    clipLengthSec: isClips ? request.clipLengthSec : null,
    clipCount: isClips ? request.clipCount : 0,
    startSec: video.cursorSec,
    endSec: clips.at(-1)?.endSec ?? video.cursorSec,
    status: 'queued',
    progress: 0,
    clipsDone: 0,
    clips,
    error: null,
    createdAt: createdAt.toISOString(),
  }
}
