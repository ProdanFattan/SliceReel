import { HttpResponse } from 'msw'
import { MockApiError } from '../backend/MockApiError'
import type { DownloadFile } from '../backend/types'

/** Runs a handler body and turns a `MockApiError` into the contract's error response. */
export async function respond(action: () => Response | Promise<Response>): Promise<Response> {
  try {
    return await action()
  } catch (error) {
    if (error instanceof MockApiError) {
      return HttpResponse.json(error.toBody(), { status: error.status })
    }
    throw error
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new MockApiError(400, 'invalid_request', 'The request body is not valid JSON.')
  }
}

export async function readUploadedFile(request: Request): Promise<File> {
  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get('file')
  } catch {
    throw new MockApiError(400, 'invalid_request', 'The upload is not valid multipart form data.')
  }
  if (!(file instanceof File)) {
    throw new MockApiError(400, 'invalid_request', 'The upload has no "file" field.')
  }
  return file
}

export function downloadResponse({ fileName, contentType, content }: DownloadFile): Response {
  return new HttpResponse(content, {
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
