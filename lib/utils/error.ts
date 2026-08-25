import { NextResponse } from 'next/server'

/**
 * Returns a JSON error response with the given message and status.
 * Never expose stack traces or internal error details to clients.
 */
export function apiError(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Catches an unknown error, logs it server-side only, and returns a
 * generic 500. Drop-in for catch blocks that previously returned
 * `error.message` directly.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof Error) {
    console.error('[API Error]', error.message, error.stack)
  } else {
    console.error('[API Error]', error)
  }
  return apiError('Internal server error', 500)
}
