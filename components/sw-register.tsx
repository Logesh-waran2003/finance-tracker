'use client'

import { useEffect } from 'react'
import { startOfflineSync } from '@/lib/offline-queue'

/**
 * Registers the service worker and starts the offline write queue.
 *
 * Rendered once from app/layout.tsx. Renders nothing.
 *
 * The worker is registered in production only. In development it would fight
 * the dev server's hot module replacement and serve stale chunks. The offline
 * queue starts in every environment — it does not depend on the worker.
 */
export function ServiceWorkerRegistrar(): null {
  useEffect(() => {
    startOfflineSync()

    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    // Wait for load so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration failure is not fatal — the app works online without it.
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
