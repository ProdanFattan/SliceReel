import type { Clip, Round, Video } from '@/api/schemas'
import type { DownloadFile } from './types'

function splitFileName(fileName: string): { base: string; extension: string } {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0) return { base: fileName, extension: '' }
  return { base: fileName.slice(0, dot), extension: fileName.slice(dot) }
}

/** The mock cannot cut video, so downloads carry a short note instead of real media. */
const placeholder = (fileName: string) => `SliceReel mock download: ${fileName}\n`

export function clipDownload(video: Video, round: Round, clip: Clip): DownloadFile {
  const { base, extension } = splitFileName(video.fileName)
  const suffix = clip.isLeftover ? '-leftover' : ''
  const fileName = `${base}-round${round.number}-clip${clip.index + 1}${suffix}${extension}`
  return { fileName, contentType: 'application/octet-stream', content: placeholder(fileName) }
}

export function roundZipDownload(video: Video, round: Round): DownloadFile {
  const fileName = `${splitFileName(video.fileName).base}-round${round.number}.zip`
  return { fileName, contentType: 'application/zip', content: placeholder(fileName) }
}
