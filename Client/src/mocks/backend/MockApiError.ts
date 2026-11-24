import type { ApiErrorBody } from '@/api/schemas'

export type MockErrorCode =
  | 'invalid_request'
  | 'not_found'
  | 'cursor_moved'
  | 'not_last_round'
  | 'not_ready'
  | 'expired'
  | 'file_too_large'
  | 'unsupported_media'
  | 'over_limit'

/** Thrown by the mock backend; the handlers turn it into an `ApiErrorBody` response. */
export class MockApiError extends Error {
  readonly status: number
  readonly code: MockErrorCode

  constructor(status: number, code: MockErrorCode, message: string) {
    super(message)
    this.name = 'MockApiError'
    this.status = status
    this.code = code
  }

  toBody(): ApiErrorBody {
    return { code: this.code, message: this.message }
  }
}
