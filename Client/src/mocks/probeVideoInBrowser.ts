import type { VideoInfo } from './backend/types'

/**
 * Reads duration and size with a `<video>` element. MSW runs handlers on the page,
 * so the DOM is available. Browsers do not expose the codec, so the MIME type stands in.
 */
export function probeVideoInBrowser(file: File): Promise<VideoInfo> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true

  const info = new Promise<VideoInfo>((resolve, reject) => {
    video.onloadedmetadata = () => {
      const { duration, videoWidth, videoHeight } = video
      if (!Number.isFinite(duration) || duration <= 0 || videoWidth === 0) {
        reject(new Error('the file has no readable video track'))
        return
      }
      resolve({ durationSec: duration, width: videoWidth, height: videoHeight, codec: file.type })
    }
    video.onerror = () => reject(new Error('the browser cannot decode this file'))
  })
  video.src = url

  return info.finally(() => {
    video.removeAttribute('src')
    URL.revokeObjectURL(url)
  })
}
