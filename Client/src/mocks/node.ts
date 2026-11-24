import { setupServer } from 'msw/node'
import { MockBackend } from './backend/MockBackend'
import type { MockBackendOptions } from './backend/types'
import { createHandlers } from './handlers/createHandlers'

type ServerOptions = Partial<MockBackendOptions> & Pick<MockBackendOptions, 'probe'>

/** The same mock API for tests: intercepts requests in Node instead of a service worker. */
export function createMockServer(options: ServerOptions, apiBase?: string) {
  const backend = new MockBackend(options)
  const server = setupServer(...createHandlers(backend, apiBase))
  return { backend, server }
}
