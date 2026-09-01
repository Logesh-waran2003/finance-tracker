'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, AlertCircle, Info, AlertTriangle, CheckSquare, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { apiGet, apiPatch } from '@/lib/api-client'
import { formatCount } from '@/lib/format'

interface Notification {
  id?: string
  type: string
  title: string
  message: string
  href: string
  dbNotification?: boolean
}

const ICON_MAP: Record<string, React.ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  approval: CheckSquare,
}

/** Colour carries meaning here: red = failed, amber = waiting, blue = fact. */
const TONE_MAP: Record<string, string> = {
  error: 'border-l-danger bg-danger-muted text-danger-muted-foreground',
  warning: 'border-l-warning bg-warning-muted text-warning-muted-foreground',
  info: 'border-l-info bg-info-muted text-info-muted-foreground',
  approval: 'border-l-warning bg-warning-muted text-warning-muted-foreground',
}

/**
 * `md:` and up. Starts false so the server and the first client render agree;
 * the effect corrects it before paint matters.
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return isDesktop
}

interface NotifRowProps {
  n: Notification
  origIdx: number
  onDismiss: (idx: number, n: Notification) => void
  onView: (n: Notification) => void
}

function NotifRow({ n, origIdx, onDismiss, onView }: NotifRowProps) {
  const Icon = ICON_MAP[n.type] ?? Info
  const tone = TONE_MAP[n.type] ?? TONE_MAP.info

  return (
    <div className={cn('flex items-start gap-3 border-b border-l-4 border-border px-4 py-3 last:border-b-0', tone)}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold break-words">{n.title}</p>
        <p className="mt-0.5 text-sm break-words opacity-90">{n.message}</p>
        <button
          type="button"
          className="mt-1 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          onClick={() => onView(n)}
        >
          <Bi k="viewDetails" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg opacity-60 transition-opacity hover:opacity-100"
        onClick={() => onDismiss(origIdx, n)}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

export function NotificationBell({ userRole }: { userRole?: 'ADMIN' | 'COLLECTION_AGENT' }) {
  const router = useRouter()
  const pathname = usePathname()
  const isDesktop = useIsDesktop()
  const endpoint = userRole === 'COLLECTION_AGENT' ? '/api/agent/notifications' : '/api/admin/notifications'

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  // useCallback + a real dependency array: the effect below polls on an
  // interval, and an unlisted dependency here is how a poller silently keeps
  // calling a stale endpoint after the prop changes.
  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    // apiGet never throws — the empty catch this replaces swallowed every
    // failure, so a broken notifications endpoint looked like "no notifications".
    const res = await apiGet<{ notifications?: Notification[]; count?: number }>(
      endpoint,
      { toastOnError: false },
    )
    if (res.ok) {
      setNotifications(res.data.notifications ?? [])
      setDismissed(new Set())
    }
    setLoading(false)
  }, [endpoint])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const visible = notifications.filter((_, i) => !dismissed.has(i))
  const visibleCount = visible.length

  const actionItems = visible.filter(n => n.type === 'approval')
  const updateItems = visible.filter(n => n.type !== 'approval')

  function handleView(n: Notification) {
    setOpen(false)
    const hrefPath = n.href.split('#')[0]
    if (pathname === hrefPath) {
      // Full reload ensures server components re-fetch fresh data
      window.location.reload()
    } else {
      router.push(n.href)
    }
  }

  async function handleDismiss(idx: number, n: Notification) {
    setDismissed(prev => new Set([...prev, idx]))
    if (n.dbNotification && n.id) {
      await apiPatch(endpoint, { id: n.id }, { toastOnError: false })
    }
  }

  function renderGroup(items: Notification[], titleKey: 'pendingApprovals' | 'notifications') {
    if (items.length === 0) return null
    return (
      <>
        <div className="border-b border-border bg-muted px-4 py-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Bi k={titleKey} />
          </p>
        </div>
        {items.map(n => {
          const origIdx = notifications.indexOf(n)
          return (
            <NotifRow
              key={origIdx}
              n={n}
              origIdx={origIdx}
              onDismiss={handleDismiss}
              onView={handleView}
            />
          )
        })}
      </>
    )
  }

  const list = (
    <div className="max-h-[60dvh] overflow-y-auto overscroll-contain md:max-h-96">
      {visible.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          <Bi k="noNotifications" />
        </div>
      )}
      {renderGroup(actionItems, 'pendingApprovals')}
      {renderGroup(updateItems, 'notifications')}
    </div>
  )

  const footer = (
    <div className="flex items-center justify-between border-t border-border px-2 py-2">
      <Button variant="ghost" size="sm" onClick={fetchNotifications} disabled={loading}>
        <Bi k={loading ? 'refreshing' : 'refresh'} />
      </Button>
    </div>
  )

  const trigger = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications"
      className="relative shrink-0"
      onClick={() => { setOpen(v => !v); if (!open) fetchNotifications() }}
    >
      <Bell className="size-5" />
      {visibleCount > 0 && (
        <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[10px] leading-none font-bold text-danger-foreground tabular">
          {visibleCount > 9 ? '9+' : formatCount(visibleCount)}
        </span>
      )}
    </Button>
  )

  // Phone: a bottom sheet — a dropdown pinned near a 390px-wide top bar either
  // clipped or overflowed. Desktop: a normal dropdown under the bell.
  if (!isDesktop) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="gap-0 p-0">
            <SheetHeader className="border-b border-border pb-3">
              <SheetTitle>
                <Bi k="notifications" />
              </SheetTitle>
            </SheetHeader>
            {list}
            {footer}
          </SheetContent>
        </Sheet>
      </>
    )
  }

  return (
    <div className="relative">
      {trigger}
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-40 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">
                <Bi k="notifications" />
              </p>
              <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {list}
            {footer}
          </div>
        </>
      )}
    </div>
  )
}
