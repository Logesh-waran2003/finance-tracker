'use client'

import { useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'

const IDLE_MS = 2 * 60 * 1000 // 2 minutes

export function IdleLogout() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function resetTimer() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      signOut({ callbackUrl: '/login' })
    }, IDLE_MS)
  }

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click', 'pointerdown']

    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // start the timer immediately

    // Tab close — sendBeacon fires even during unload
    function handleUnload() {
      navigator.sendBeacon('/api/auth/logout')
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      if (timer.current) clearTimeout(timer.current)
      events.forEach(e => window.removeEventListener(e, resetTimer))
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [])

  return null
}
