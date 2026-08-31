'use client'

/**
 * lib/offline-queue.ts — durable write queue for field agents with no signal.
 *
 * THE PROBLEM
 * An agent stands in a village with no bars, types a ₹5,000 collection and taps
 * Save. Without this module the request rejects and the money is lost.
 *
 * WHAT THIS DOES
 * Failed writes are stored in IndexedDB (survives a reload, a crash and a phone
 * restart) and replayed automatically when the browser fires `online`.
 *
 * ============================================================================
 * IDEMPOTENCY CONTRACT — READ THIS BEFORE YOU QUEUE ANYTHING
 * ============================================================================
 * Replay is only safe because every queued item carries an `idempotencyKey`
 * that NEVER changes. `POST /api/collections` puts that value in the
 * `idempotency_key` column and inserts with `ON CONFLICT DO NOTHING`, so a
 * second delivery of the same key returns the existing row (HTTP 200) instead
 * of creating a second collection (HTTP 201). The uniqueness is enforced by the
 * database, not by application code, so concurrent replays are safe too.
 *
 * Callers MUST:
 *   1. Generate the key ONCE PER FORM OPEN — not per tap, not per retry.
 *        const [idempotencyKey] = useState(() => crypto.randomUUID())
 *   2. Send that same key in the request body as `idempotency_key`, AND pass it
 *      as `idempotencyKey` on the queued item. They must be the same string.
 *   3. Generate a NEW key only when the form is reopened for a NEW collection.
 *
 * If a caller regenerates the key on every tap, a double-tap or a replay
 * creates DUPLICATE MONEY. This is the single most important rule in the file.
 * ============================================================================
 */

import { useEffect, useState } from 'react'
import { apiFetch } from './api-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QueuedRequest = {
  /** Local record id. Unique per queued attempt. */
  id: string
  /** Same-origin path, e.g. '/api/collections'. */
  url: string
  /** 'POST' | 'PATCH' | 'DELETE' — non-GET only. */
  method: string
  /** Parsed JSON body. Must already contain `idempotency_key`. */
  body: unknown
  /** MUST equal body.idempotency_key. Never changes across replays. */
  idempotencyKey: string
  createdAt: number
  attempts: number
  /** Set once `attempts` reaches MAX_ATTEMPTS. Kept for the UI, never replayed. */
  failed?: boolean
}

export type FlushResult = { sent: number; failed: number }

const DB_NAME = 'finance-tracker-offline'
const DB_VERSION = 1
const STORE = 'queue'

/** Give up after this many delivery attempts and mark the item `failed`. */
export const MAX_ATTEMPTS = 10

// ---------------------------------------------------------------------------
// IndexedDB, promise-wrapped. No dependency.
// ---------------------------------------------------------------------------

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
  })
}

function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode)
        const request = run(tx.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'))
        tx.oncomplete = () => db.close()
      }),
  )
}

// ---------------------------------------------------------------------------
// Queue API
// ---------------------------------------------------------------------------

/**
 * Store a write for later delivery.
 * `item.idempotencyKey` must equal the `idempotency_key` inside `item.body`.
 */
export async function enqueue(item: QueuedRequest): Promise<void> {
  if (!hasIndexedDB()) return
  try {
    await withStore('readwrite', store => store.put(item))
    notifyCountChanged()
  } catch {
    // A full or blocked IndexedDB must not break the submit handler.
  }
}

/** Every queued item, oldest first. Includes items marked `failed`. */
export async function listQueued(): Promise<QueuedRequest[]> {
  if (!hasIndexedDB()) return []
  try {
    const rows = await withStore<QueuedRequest[]>('readonly', store => store.getAll())
    return (rows ?? []).sort((a, b) => a.createdAt - b.createdAt)
  } catch {
    return []
  }
}

/** Drop one item by its local id. */
export async function remove(id: string): Promise<void> {
  if (!hasIndexedDB()) return
  try {
    await withStore('readwrite', store => store.delete(id))
    notifyCountChanged()
  } catch {
    // Ignore — a missing row is the desired end state anyway.
  }
}

/** How many items are waiting (failed items included). */
export async function count(): Promise<number> {
  if (!hasIndexedDB()) return 0
  try {
    return (await withStore<number>('readonly', store => store.count())) ?? 0
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Flush
// ---------------------------------------------------------------------------

let flushing = false

/**
 * Replay every queued write through `apiFetch`, one at a time, oldest first.
 *
 * Outcome rules:
 * - 2xx  → delivered. Remove.
 * - 4xx  → the server rejected the payload itself. A retry can never succeed,
 *          so remove it. Keeping it would block the queue forever. Logged.
 * - 5xx / network failure → keep, increment `attempts`, stop the run (the
 *          network is probably still down; do not hammer it).
 * - attempts >= MAX_ATTEMPTS → mark `failed` and stop replaying it.
 *
 * Never throws. Safe to call at any time; concurrent calls collapse into one.
 */
export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return { sent: 0, failed: 0 }
  flushing = true

  let sent = 0
  let failed = 0

  try {
    const items = await listQueued()

    for (const item of items) {
      if (item.failed) {
        failed += 1
        continue
      }

      const res = await apiFetch<unknown>(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.body),
        // The user is not looking at this. Do not toast a background replay.
        toastOnError: false,
      })

      if (res.ok) {
        await remove(item.id)
        sent += 1
        continue
      }

      // 4xx — permanently rejected. Dropping it prevents an infinite queue.
      if (res.status >= 400 && res.status < 500) {
        // eslint-disable-next-line no-console -- a dropped money write must leave a trace
        console.warn(
          `[offline-queue] dropping ${item.method} ${item.url} ` +
            `(idempotency_key=${item.idempotencyKey}): HTTP ${res.status} ${res.error}`,
        )
        await remove(item.id)
        failed += 1
        continue
      }

      // Network failure or 5xx — keep it and count the attempt.
      const attempts = item.attempts + 1
      const exhausted = attempts >= MAX_ATTEMPTS
      await enqueue({ ...item, attempts, failed: exhausted })
      failed += 1

      if (exhausted) {
        // eslint-disable-next-line no-console -- needs a trace, the money never landed
        console.error(
          `[offline-queue] giving up on ${item.method} ${item.url} after ${attempts} attempts`,
        )
        continue
      }

      // Still offline / server still unhappy. Stop; `online` will call us again.
      break
    }
  } catch {
    // Never throw out of a background sync.
  } finally {
    flushing = false
    notifyCountChanged()
  }

  return { sent, failed }
}

// ---------------------------------------------------------------------------
// Auto-sync
// ---------------------------------------------------------------------------

let syncStarted = false

/**
 * Flush whenever the browser comes back online. Idempotent — calling it more
 * than once registers exactly one listener. Called by <ServiceWorkerRegistrar>.
 */
export function startOfflineSync(): void {
  if (syncStarted || typeof window === 'undefined') return
  syncStarted = true

  window.addEventListener('online', () => {
    void flushQueue()
  })

  // Anything left over from the last session goes out now.
  if (navigator.onLine) void flushQueue()
}

// ---------------------------------------------------------------------------
// Count subscription + hook
// ---------------------------------------------------------------------------

const QUEUE_CHANGED_EVENT = 'offline-queue:changed'

function notifyCountChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT))
}

/**
 * Number of writes still waiting to sync, for a badge like "3 waiting to sync".
 * Updates on enqueue, on remove, on flush, and when the connection returns.
 */
export function useQueueCount(): number {
  const [n, setN] = useState(0)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void count().then(value => {
        if (alive) setN(value)
      })
    }

    refresh()
    window.addEventListener(QUEUE_CHANGED_EVENT, refresh)
    window.addEventListener('online', refresh)
    return () => {
      alive = false
      window.removeEventListener(QUEUE_CHANGED_EVENT, refresh)
      window.removeEventListener('online', refresh)
    }
  }, [])

  return n
}
