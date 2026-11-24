/**
 * Gaps shorter than this count as nothing. Durations come from the probe as floats
 * and the UI shows whole seconds, so a 0.2 s tail would read "0:00 left" yet still
 * block the video from being finished.
 */
export const TIME_TOLERANCE_SEC = 0.5

function assertTimeline(durationSec: number, cursorSec: number): void {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    throw new RangeError(`Invalid video duration: ${durationSec}`)
  }
  if (!Number.isFinite(cursorSec) || cursorSec < 0) {
    throw new RangeError(`Invalid cursor position: ${cursorSec}`)
  }
}

/** Seconds left to cut after the cursor, snapped to 0 within the tolerance. */
export function remainingSec(durationSec: number, cursorSec: number): number {
  assertTimeline(durationSec, cursorSec)
  const remaining = durationSec - cursorSec
  return remaining < TIME_TOLERANCE_SEC ? 0 : remaining
}

export function isVideoUsedUp(durationSec: number, cursorSec: number): boolean {
  return remainingSec(durationSec, cursorSec) === 0
}
