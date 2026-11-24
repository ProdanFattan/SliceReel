import type { ProgressEvent } from '@/api/schemas'
import type { EventSink } from '../backend/EventHub'

type Subscribe = (sink: EventSink<ProgressEvent>) => () => void

export const SSE_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
}

/**
 * A `text/event-stream` body fed by a subscription. Built by hand instead of with
 * MSW's `sse()` because that needs `EventSource`, which test environments lack.
 */
export function createSseStream(
  subscribe: Subscribe,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let unsubscribe = () => {}

  return new ReadableStream({
    start(controller) {
      const close = () => {
        unsubscribe()
        controller.close()
      }
      unsubscribe = subscribe({
        send: (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)),
        close,
      })
      // A comment line flushes the headers at once, as real SSE servers do. Without
      // it, `fetch` in Node waits for the first event before resolving.
      controller.enqueue(encoder.encode(': connected\n\n'))
      signal.addEventListener('abort', () => unsubscribe(), { once: true })
    },
    cancel() {
      unsubscribe()
    },
  })
}
