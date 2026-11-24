import type { CutMode } from '@/api/schemas'

export interface VideoInfo {
  durationSec: number
  width: number
  height: number
  codec: string
}

/** Reads duration and basic info from an uploaded file. Rejects if it is not a readable video. */
export type VideoProbe = (file: File) => Promise<VideoInfo>

export type IdGenerator = (prefix: string) => string

export interface MockBackendOptions {
  probe: VideoProbe
  maxUploadBytes: number
  /** How long a video lives before it is auto-deleted (F12). */
  retentionMs: number
  /** Extra wait after the upload to mimic the server reading the file. */
  processingDelayMs: number
  cutMsPerClip: Record<CutMode, number>
  progressTickMs: number
  now: () => Date
}

export interface DownloadFile {
  fileName: string
  contentType: string
  content: string
}
