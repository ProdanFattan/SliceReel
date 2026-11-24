import type { MockBackendOptions, VideoInfo } from '@/mocks/backend/types'

export const TEST_VIDEO_INFO: VideoInfo = {
  durationSec: 100,
  width: 1920,
  height: 1080,
  codec: 'video/mp4',
}

/** Fast timings and a stub probe, so mock-backend tests need no real video. */
export const TEST_BACKEND_OPTIONS: Partial<MockBackendOptions> & Pick<MockBackendOptions, 'probe'> =
  {
    probe: () => Promise.resolve(TEST_VIDEO_INFO),
    cutMsPerClip: { fast: 100, exact: 300 },
    progressTickMs: 50,
    retentionMs: 60_000,
    now: () => new Date('2026-11-24T10:00:00Z'),
  }

export function videoFile(name = 'holiday.mp4', type = 'video/mp4', sizeBytes = 1000): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

export function clipsRequest(startSec: number, clipLengthSec = 30, clipCount = 2) {
  return { kind: 'clips', mode: 'fast', startSec, clipLengthSec, clipCount, includeLeftover: false }
}
