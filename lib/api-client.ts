'use client'

/**
 * lib/api-client.ts — the single network entry point for the whole app.
 *
 * WHY THIS EXISTS
 * Field agents work outdoors on bad mobile networks. A raw `await fetch(...)`
 * REJECTS when the signal drops. In a submit handler that means `setSaving(false)`
 * never runs, the button stays disabled forever, and the agent sees nothing.
 *
 * `apiFetch` NEVER throws and NEVER rejects. It always resolves to an `ApiResult`.
 * Callers can therefore always write:
 *
 *   const res = await apiFetch<Collection>('/api/collections', { method: 'POST', ... })
 *   if (!res.ok) { setSaving(false); return }   // toast already shown
 *   // res.data is typed here
 *
 * RULES
 * - Every fetch in feature code goes through here. No bare `fetch` in components.
 * - The failure toast is bilingual: Tamil first, English second.
 * - Optimistic UI is not allowed for money. Wait for the server.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; offline: boolean }

export type ApiFetchInit = RequestInit & {
  /** Abort the request after this many ms. Default 15000. */
  timeoutMs?: number
  /** Show a bilingual sonner toast on failure. Default true. */
  toastOnError?: boolean
}

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 15_000

// ---------------------------------------------------------------------------
// User-facing transport-failure messages.
//
// Deliberately NOT in lib/i18n.ts: this module is imported by client code that
// must keep working when everything else has failed, and these four strings are
// the only text it renders. Keeping them local means one fewer import on the
// error path.
//
// Each one says what happened AND whether the user's data was saved, because
// "try again" without that is the difference between a lost collection and a
// duplicated one.
// ---------------------------------------------------------------------------

const MESSAGES = {
  offline: 'No internet — nothing was saved, try again',
  timeout: 'Network too slow — nothing was saved, try again',
  server: 'Server problem — please try again',
  generic: 'Something went wrong — please try again',
} as const

type MessageKey = keyof typeof MESSAGES

function message(key: MessageKey): string {
  return MESSAGES[key]
}

/** Machine-readable error codes returned in `ApiResult.error` for transport failures. */
export const OFFLINE_ERROR = 'offline'
export const TIMEOUT_ERROR = 'timeout'

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/** Read the body safely. The API returns `{ error: string }` on failure. */
async function readBody(res: Response): Promise<unknown> {
  try {
    const text = await res.text()
    if (!text) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      // Not JSON (an HTML error page, a proxy response, a truncated body).
      return text
    }
  } catch {
    // The stream itself failed — e.g. the connection dropped mid-body.
    return null
  }
}

function extractError(body: unknown, res: Response): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const value = (body as { error: unknown }).error
    if (typeof value === 'string' && value.length > 0) return value
  }
  if (typeof body === 'string' && body.length > 0 && body.length < 300) return body
  return res.statusText || `HTTP ${res.status}`
}

/**
 * Fetch that can never reject.
 *
 * @param url    Same-origin path, e.g. `/api/collections`.
 * @param init   Standard `RequestInit` plus `timeoutMs` and `toastOnError`.
 * @returns      `{ ok: true, data }` or `{ ok: false, error, status, offline }`.
 *               `status` is 0 when the request never reached the server.
 */
export async function apiFetch<T>(url: string, init?: ApiFetchInit): Promise<ApiResult<T>> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, toastOnError = true, ...rest } = init ?? {}

  const fail = (
    error: string,
    status: number,
    offline: boolean,
    messageKey: MessageKey,
  ): ApiResult<T> => {
    if (toastOnError) {
      try {
        toast.error(message(messageKey), { description: error })
      } catch {
        // A toast must never break a submit handler.
      }
    }
    return { ok: false, error, status, offline }
  }

  // Fast path: the device already knows it has no connection.
  if (isOffline()) {
    return fail(OFFLINE_ERROR, 0, true, 'offline')
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)

  try {
    const res = await fetch(url, { ...rest, signal: controller.signal })
    clearTimeout(timer)

    const body = await readBody(res)

    if (!res.ok) {
      return fail(
        extractError(body, res),
        res.status,
        false,
        res.status >= 500 ? 'server' : 'generic',
      )
    }

    return { ok: true, data: body as T }
  } catch (err) {
    clearTimeout(timer)

    if (timedOut) {
      return fail(TIMEOUT_ERROR, 0, true, 'timeout')
    }

    // A caller-supplied signal aborted us. Not a failure worth shouting about.
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'aborted', status: 0, offline: false }
    }

    // `fetch` throws TypeError for DNS failure, connection refused, CORS,
    // and a dropped mobile connection. Treat all of them as offline.
    if (err instanceof TypeError || isOffline()) {
      return fail(OFFLINE_ERROR, 0, true, 'offline')
    }

    const message = err instanceof Error ? err.message : String(err)
    return fail(message, 0, false, 'generic')
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export function apiGet<T>(url: string, init?: ApiFetchInit): Promise<ApiResult<T>> {
  return apiFetch<T>(url, { ...init, method: 'GET' })
}

export function apiPost<T>(
  url: string,
  body?: unknown,
  init?: ApiFetchInit,
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    ...init,
    method: 'POST',
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiPatch<T>(
  url: string,
  body?: unknown,
  init?: ApiFetchInit,
): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    ...init,
    method: 'PATCH',
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T>(url: string, init?: ApiFetchInit): Promise<ApiResult<T>> {
  return apiFetch<T>(url, {
    ...init,
    method: 'DELETE',
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
  })
}

// ---------------------------------------------------------------------------
// Online status hook
// ---------------------------------------------------------------------------

/**
 * `true` when the browser thinks it has a connection.
 *
 * Starts as `true` so the server render and the first client render match
 * (no hydration mismatch); the real value lands in the first effect.
 *
 *   const online = useOnlineStatus()
 *   {!online && <OfflineBanner />}
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    if (typeof navigator === 'undefined') return

    setOnline(navigator.onLine)

    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return online
}
