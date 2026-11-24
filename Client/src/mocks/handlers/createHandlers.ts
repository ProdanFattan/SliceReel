import { http, HttpResponse, type HttpHandler } from 'msw'
import type { MockBackend } from '../backend/MockBackend'
import { rangeResponse } from './rangeResponse'
import { downloadResponse, readJson, readUploadedFile, respond } from './respond'
import { createSseStream, SSE_HEADERS } from './sseStream'

type VideoParams = { videoId: string }
type RoundParams = VideoParams & { roundId: string }
type ClipParams = VideoParams & { clipId: string }

/** Request handlers for every endpoint in `docs/api-contract.md`. */
export function createHandlers(backend: MockBackend, apiBase = '/api'): HttpHandler[] {
  const videos = `${apiBase}/videos`
  const video = `${videos}/:videoId`

  return [
    http.post(videos, ({ request }) =>
      respond(async () => {
        const file = await readUploadedFile(request)
        return HttpResponse.json(await backend.uploadVideo(file), { status: 201 })
      }),
    ),

    http.get<VideoParams>(video, ({ params }) =>
      respond(() => HttpResponse.json(backend.getVideo(params.videoId))),
    ),

    http.delete<VideoParams>(video, ({ params }) =>
      respond(() => {
        backend.deleteVideo(params.videoId)
        return new HttpResponse(null, { status: 204 })
      }),
    ),

    http.post<VideoParams>(`${video}/rounds`, ({ params, request }) =>
      respond(async () => {
        const round = backend.createRound(params.videoId, await readJson(request))
        return HttpResponse.json(round, { status: 202 })
      }),
    ),

    http.delete<RoundParams>(`${video}/rounds/:roundId`, ({ params }) =>
      respond(() => HttpResponse.json(backend.undoRound(params.videoId, params.roundId))),
    ),

    http.get<VideoParams>(`${video}/events`, ({ params, request }) =>
      respond(() => {
        // `ReadableStream` runs `start` synchronously, so an unknown video throws here.
        const stream = createSseStream(
          (sink) => backend.subscribe(params.videoId, sink),
          request.signal,
        )
        return new HttpResponse(stream, { headers: SSE_HEADERS })
      }),
    ),

    http.get<VideoParams>(`${video}/stream`, ({ params, request }) =>
      respond(() =>
        rangeResponse(backend.getSourceFile(params.videoId), request.headers.get('range')),
      ),
    ),

    http.get<ClipParams>(`${video}/clips/:clipId/download`, ({ params }) =>
      respond(() => downloadResponse(backend.getClipDownload(params.videoId, params.clipId))),
    ),

    http.get<RoundParams>(`${video}/rounds/:roundId/zip`, ({ params }) =>
      respond(() => downloadResponse(backend.getRoundZip(params.videoId, params.roundId))),
    ),
  ]
}
