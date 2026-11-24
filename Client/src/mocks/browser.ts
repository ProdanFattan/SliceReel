import { setupWorker } from 'msw/browser'
import { MockBackend } from './backend/MockBackend'
import { createHandlers } from './handlers/createHandlers'
import { probeVideoInBrowser } from './probeVideoInBrowser'

/** Starts the in-browser mock API. State lives in memory, so a page reload starts empty. */
export async function startMockApi(): Promise<void> {
  const backend = new MockBackend({ probe: probeVideoInBrowser, processingDelayMs: 800 })
  const worker = setupWorker(...createHandlers(backend))
  await worker.start({ onUnhandledFrame: 'bypass' })
}
