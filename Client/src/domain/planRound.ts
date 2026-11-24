import type {
  AfterRound,
  PlanIssue,
  PlannedClip,
  RoundPlan,
  RoundSettings,
  TimelinePosition,
} from './roundPlan'
import { TIME_TOLERANCE_SEC, remainingSec as getRemainingSec } from './timeline'

const isValidClipLength = (sec: number): boolean => Number.isFinite(sec) && sec > 0
const isValidClipCount = (count: number): boolean => Number.isInteger(count) && count >= 1

function findIssue(settings: RoundSettings, remainingSec: number): PlanIssue | null {
  const { clipLengthSec, clipCount } = settings
  if (remainingSec === 0) return { code: 'video_used_up' }
  if (!isValidClipLength(clipLengthSec)) return { code: 'invalid_clip_length' }
  if (!isValidClipCount(clipCount)) return { code: 'invalid_clip_count' }

  const requestedSec = clipLengthSec * clipCount
  const limitSec = remainingSec + TIME_TOLERANCE_SEC

  if (clipLengthSec > limitSec) {
    return {
      code: 'clip_longer_than_remaining',
      requestedSec,
      fix: { kind: 'cut_rest', lengthSec: remainingSec },
    }
  }
  if (requestedSec > limitSec) {
    return {
      code: 'over_limit',
      requestedSec,
      fix: { kind: 'set_clip_count', clipCount: Math.floor(limitSec / clipLengthSec) },
    }
  }
  return null
}

/** Clip ends are clamped because the tolerance lets the last clip run just past the end. */
function buildClips(
  { clipLengthSec, clipCount }: RoundSettings,
  startSec: number,
  durationSec: number,
  leftoverSec: number,
): PlannedClip[] {
  const clips = Array.from({ length: clipCount }, (_, index) => ({
    startSec: startSec + index * clipLengthSec,
    endSec: Math.min(startSec + (index + 1) * clipLengthSec, durationSec),
    isLeftover: false,
  }))
  if (leftoverSec > 0) {
    clips.push({
      startSec: startSec + clipCount * clipLengthSec,
      endSec: durationSec,
      isLeftover: true,
    })
  }
  return clips
}

function describeAfterRound(
  tailSec: number,
  leftoverSec: number,
  clipLengthSec: number,
): AfterRound {
  if (leftoverSec > 0) return 'leftover_saved'
  if (tailSec === 0) return 'video_used_up'
  return tailSec < clipLengthSec ? 'leftover_unsaved' : 'time_remains'
}

/**
 * Checks a round request against the time left after the cursor (F3, F4) and works
 * out its clips, the optional leftover clip (F11) and the time remaining afterwards
 * (F8). An invalid request comes back with an issue and, where possible, a fix.
 */
export function planRound(position: TimelinePosition, settings: RoundSettings): RoundPlan {
  const { durationSec, cursorSec: startSec } = position
  const remainingSec = getRemainingSec(durationSec, startSec)

  const issue = findIssue(settings, remainingSec)
  if (issue) return { ok: false, startSec, remainingSec, issue }

  const { clipLengthSec, clipCount, includeLeftover } = settings
  const requestedSec = clipLengthSec * clipCount
  const rawTailSec = remainingSec - requestedSec
  const tailSec = rawTailSec < TIME_TOLERANCE_SEC ? 0 : rawTailSec
  const leftoverSec = includeLeftover && tailSec > 0 && tailSec < clipLengthSec ? tailSec : 0
  const clips = buildClips(settings, startSec, durationSec, leftoverSec)

  return {
    ok: true,
    startSec,
    remainingSec,
    endSec: clips[clips.length - 1]?.endSec ?? startSec,
    clips,
    requestedSec,
    leftoverSec,
    remainingAfterSec: tailSec - leftoverSec,
    afterRound: describeAfterRound(tailSec, leftoverSec, clipLengthSec),
  }
}
