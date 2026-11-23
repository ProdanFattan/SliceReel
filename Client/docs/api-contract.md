# API contract

The client's view of the SliceReel server API. The Zod schemas in
[`src/api/schemas/`](../src/api/schemas/) are the source of truth: every response and SSE message
is parsed with them, so any change here must change there too.

## Conventions

- Base path: `/api`. JSON bodies, `camelCase` fields.
- Times on the video timeline are seconds (`…Sec`, fractions allowed). Wall-clock times are ISO 8601
  strings with an offset (`createdAt`, `expiresAt`).
- Access is scoped to the session cookie. A video from another session returns `404`.
- Every non-2xx response has the body `{ "code": string, "message": string }` (`ApiErrorBody`).

## Endpoints

| Method   | Path                                      | Body                    | Success     | Notes                                                                |
| -------- | ----------------------------------------- | ----------------------- | ----------- | -------------------------------------------------------------------- |
| `POST`   | `/videos`                                 | multipart, field `file` | `201 Video` | Returns once duration and info are read (F1, F2)                     |
| `GET`    | `/videos/:videoId`                        |                         | `200 Video` | Includes all rounds, oldest first                                    |
| `DELETE` | `/videos/:videoId`                        |                         | `204`       | "New video": deletes the video and all clips                         |
| `POST`   | `/videos/:videoId/rounds`                 | `CutRequest`            | `202 Round` | Round starts as `queued`; the cursor moves to `round.endSec` at once |
| `DELETE` | `/videos/:videoId/rounds/:roundId`        |                         | `200 Video` | Undo. Only the last round; cancels it if still cutting (F10)         |
| `GET`    | `/videos/:videoId/events`                 |                         | SSE stream  | `ProgressEvent` messages, see below                                  |
| `GET`    | `/videos/:videoId/stream`                 |                         | `206` video | Supports `Range` for playback                                        |
| `GET`    | `/videos/:videoId/clips/:clipId/download` |                         | file        | Only when `clip.isReady`                                             |
| `GET`    | `/videos/:videoId/rounds/:roundId/zip`    |                         | ZIP file    | Only when the round is `ready` (F7)                                  |

## Models

**Video**: `id`, `fileName`, `sizeBytes`, `durationSec`, `width`, `height`, `codec`, `cursorSec`
(where the next round starts), `expiresAt`, `rounds: Round[]`.

**Round**: `id`, `number` (1-based), `kind`, `mode` (`fast` | `exact`), `clipLengthSec`
(`null` for `rest`), `clipCount` (`0` for `rest`), `startSec`, `endSec`, `status`, `progress` (0–1),
`clipsDone`, `clips: Clip[]`, `error` (`null` unless failed), `createdAt`.

- `kind: "clips"`: `clipCount` clips of `clipLengthSec`, plus a leftover clip if requested (F11).
- `kind: "rest"`: a single leftover clip covering what is left of the video.
- `status`: `queued` → `cutting` → `ready`, or `failed`.

**Clip**: `id`, `index`, `startSec`, `endSec`, `isLeftover`, `isReady`.

**CutRequest**: a union on `kind`.

- `{ kind: "clips", mode, startSec, clipLengthSec, clipCount, includeLeftover }`
- `{ kind: "rest", mode, startSec }`

`startSec` must equal the current `cursorSec`, otherwise the server answers `409 cursor_moved`. This
stops two tabs from cutting overlapping rounds.

## SSE events (`ProgressEvent`)

One stream per video. Each message's `data` is JSON with a `type`:

| `type`           | Fields                             | Meaning                                                      |
| ---------------- | ---------------------------------- | ------------------------------------------------------------ |
| `round.progress` | `roundId`, `progress`, `clipsDone` | Cutting moved forward (F6)                                   |
| `round.ready`    | `round`                            | The round finished; the full `Round` replaces the cached one |
| `round.failed`   | `roundId`, `error`, `cursorSec`    | The server removed the round and rolled the cursor back      |
| `video.expired`  |                                    | The files were auto-deleted (F12)                            |

## Error codes

| HTTP  | `code`              | When                                                |
| ----- | ------------------- | --------------------------------------------------- |
| `400` | `invalid_request`   | The body fails validation                           |
| `404` | `not_found`         | Unknown video, round or clip, or another session's  |
| `409` | `cursor_moved`      | `CutRequest.startSec` is not the current cursor     |
| `409` | `not_last_round`    | Undo was asked for a round that is not the last one |
| `410` | `expired`           | The video was auto-deleted                          |
| `413` | `file_too_large`    | Upload is over the size limit (2 GB by default)     |
| `415` | `unsupported_media` | The file is not a readable video                    |
| `422` | `over_limit`        | The round needs more time than is left (F4)         |
