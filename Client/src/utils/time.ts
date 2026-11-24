const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600

const pad2 = (value: number): string => String(value).padStart(2, '0')

/**
 * Formats seconds as `m:ss`, or `h:mm:ss` from one hour up. Rounds to whole seconds
 * first so 59.6 shows as `1:00`, not `0:60`. Negative values clamp to `0:00` because
 * float maths on the cursor can dip just below zero.
 */
export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    throw new RangeError(`Cannot format a non-finite time: ${totalSeconds}`)
  }
  const rounded = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(rounded / SECONDS_PER_HOUR)
  const minutes = Math.floor((rounded % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = rounded % SECONDS_PER_MINUTE

  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${minutes}:${pad2(seconds)}`
}

const TIME_PATTERN = /^(?:(?:(\d+):)?(\d+):)?(\d+(?:\.\d+)?)$/

/**
 * Parses `ss`, `m:ss` or `h:mm:ss` (seconds may have a fraction) into seconds.
 * Returns `null` for anything else, including minutes or seconds of 60+ when a
 * larger unit is given. A lone number may exceed 59 (`"90"` is 90 seconds).
 */
export function parseTime(input: string): number | null {
  const match = TIME_PATTERN.exec(input.trim())
  if (!match) return null

  const [, hoursText, minutesText, secondsText = ''] = match
  const hours = hoursText === undefined ? 0 : Number(hoursText)
  const minutes = minutesText === undefined ? 0 : Number(minutesText)
  const seconds = Number(secondsText)

  if (minutesText !== undefined && seconds >= SECONDS_PER_MINUTE) return null
  if (hoursText !== undefined && minutes >= SECONDS_PER_MINUTE) return null

  return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds
}
