'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, AlertCircle, Info, AlertTriangle, CheckSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Notification {
  id?: string
  type: string
  title: string
  message: string
  href: string
  dbNotification?: boolean
}

const ICON_MAP: Record<string, React.ElementType> = {
  error:    AlertCircle,
  warning:  AlertTriangle,
  info:     Info,
  approval: CheckSquare,
}

const COLOR_MAP: Record<string, string> = {
  error:    'text-red-700 bg-red-50 border-red-300',
  warning:  'text-yellow-700 bg-yellow-50 border-yellow-300',
  info:     'text-blue-700 bg-blue-50 border-blue-300',
  approval: 'text-orange-700 bg-orange-50 border-orange-300',
}

function NotifRow({ n, origIdx, dismissed, setDismissed, endpoint, router, pathname, setOpen }: {
  n: Notification
  origIdx: number
  dismissed: Set<number>
  setDismissed: React.Dispatch<React.SetStateAction<Set<number>>>
  endpoint: string
  router: ReturnType<typeof useRouter>
  pathname: string
  setOpen: (v: boolean) => void
}) {
  const Icon = ICON_MAP[n.type] ?? Info
  const color = COLOR_MAP[n.type] ?? COLOR_MAP.info

  function handleView() {
    setOpen(false)
    const hrefPath = n.href.split('#')[0]
    if (pathname === hrefPath) {
      router.refresh()
    } else {
      router.push(n.href)
    }
  }

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 border-l-4 ${color}`}>
      <Icon size={15} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{n.title}</p>
        <p className="text-xs mt-0.5 opacity-90">{n.message}</p>
        <button
          className="text-xs underline mt-1 inline-block opacity-80 hover:opacity-100"
          onClick={handleView}
        >
          View →
        </button>
      </div>
      <button
        className="shrink-0 opacity-40 hover:opacity-70 transition-opacity"
        onClick={async () => {
          setDismissed(prev => new Set([...prev, origIdx]))
          if (n.dbNotification && n.id) {
            await fetch(endpoint, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: n.id }),
            }).catch(() => {})
          }
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function NotificationBell({ userRole }: { userRole?: 'ADMIN' | 'COLLECTION_AGENT' }) {
  const router = useRouter()
  const pathname = usePathname()
  const endpoint = userRole === 'COLLECTION_AGENT' ? '/api/agent/notifications' : '/api/admin/notifications'
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())

  async function fetchNotifications() {
    setLoading(true)
    try {
      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
        setCount(data.count ?? 0)
        setDismissed(new Set())
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const visible = notifications.filter((_, i) => !dismissed.has(i))
  const visibleCount = visible.length

  const actionItems = visible.filter(n => n.type === 'approval')
  const updateItems = visible.filter(n => n.type !== 'approval')

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications() }}
      >
        <Bell size={18} className="text-gray-600" />
        {visibleCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {visibleCount > 9 ? '9+' : visibleCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div className="absolute right-0 top-10 z-40 w-[calc(100vw-1rem)] max-w-sm rounded-xl border bg-white shadow-lg overflow-hidden sm:w-80">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Notifications</p>
              <div className="flex items-center gap-2">
                {loading && <span className="text-xs text-gray-400">Refreshing…</span>}
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {visible.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  All clear — no pending alerts
                </div>
              )}

              {actionItems.length > 0 && (
                <>
                  <div className="px-4 py-1.5 bg-orange-50 border-b">
                    <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wide">Needs Action</p>
                  </div>
                  {actionItems.map(n => {
                    const origIdx = notifications.indexOf(n)
                    return <NotifRow key={origIdx} n={n} origIdx={origIdx} dismissed={dismissed} setDismissed={setDismissed} endpoint={endpoint} router={router} pathname={pathname} setOpen={setOpen} />
                  })}
                </>
              )}

              {updateItems.length > 0 && (
                <>
                  <div className={`px-4 py-1.5 border-b ${actionItems.length > 0 ? 'border-t bg-gray-50' : 'bg-gray-50'}`}>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Updates</p>
                  </div>
                  {updateItems.map(n => {
                    const origIdx = notifications.indexOf(n)
                    return <NotifRow key={origIdx} n={n} origIdx={origIdx} dismissed={dismissed} setDismissed={setDismissed} endpoint={endpoint} router={router} pathname={pathname} setOpen={setOpen} />
                  })}
                </>
              )}
            </div>

            <div className="px-4 py-2 border-t bg-gray-50">
              <button
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                onClick={fetchNotifications}
              >
                Refresh
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
