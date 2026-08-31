'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Building2, CloudOff, LogOut, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogClose, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { NotificationBell } from '@/components/notification-bell'
import {
  BottomNav, PROFILE_ITEM, activeHref, getNavItems, type NavItem, type Role,
} from '@/components/bottom-nav'
import { apiPost, useOnlineStatus } from '@/lib/api-client'
import { useQueueCount } from '@/lib/offline-queue'
import { formatCount } from '@/lib/format'
import type { LabelKey } from '@/lib/i18n'

export type { Role }

/**
 * Route → screen title.
 *
 * The title is shown in the 56px top bar on a phone and by `<PageHeader>`
 * from `md:` up — never both at once. Longest prefix wins so
 * `/admin/loans/collection-approval` does not resolve to "Loans".
 */
const TITLE_ROUTES: ReadonlyArray<readonly [string, LabelKey]> = [
  ['/dashboard', 'dashboard'],
  ['/collections', 'myCollections'],
  ['/customers', 'myCustomers'],
  ['/loans', 'loans'],
  ['/attendance', 'myAttendance'],
  ['/expenses', 'officeExpenses'],
  ['/reconciliation', 'cashSettlement'],
  ['/profile', 'profile'],
  ['/admin/collections', 'collections'],
  ['/admin/customers', 'customers'],
  ['/admin/loans', 'loans'],
  ['/admin/loans/collection-approval', 'collectionApproval'],
  ['/admin/loan-requests', 'loanRequests'],
  ['/admin/employees', 'employees'],
  ['/admin/attendance', 'attendance'],
  ['/admin/expenses', 'expenses'],
  ['/admin/reconciliation', 'reconciliation'],
  ['/admin/reports', 'reports'],
  ['/admin/settings', 'settings'],
]

function screenTitleKey(pathname: string): LabelKey {
  let best: readonly [string, LabelKey] | null = null
  for (const entry of TITLE_ROUTES) {
    const hit = pathname === entry[0] || pathname.startsWith(entry[0] + '/')
    if (hit && (best === null || entry[0].length > best[0].length)) best = entry
  }
  return best ? best[1] : 'appName'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SidebarLink({ item, active, labelKey }: { item: NavItem; active: boolean; labelKey?: LabelKey }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
        active
          ? 'bg-muted text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <item.icon className="size-4 shrink-0" />
      <Bi k={labelKey ?? item.k} className="min-w-0 truncate" />
    </Link>
  )
}

/**
 * Offline / pending-sync strip.
 *
 * An agent whose phone lost signal has no other way to learn that the money
 * they just recorded is still sitting on the handset. Silence here is the
 * expensive failure, so this renders as a full-width bar rather than a chip
 * tucked into the top bar.
 */
function SyncStatusStrip({ online, queued }: { online: boolean; queued: number }) {
  if (online && queued === 0) return null

  return (
    <div
      role="status"
      className={cn(
        'flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm',
        online
          ? 'border-info-muted bg-info-muted text-info-muted-foreground'
          : 'border-warning-muted bg-warning-muted text-warning-muted-foreground',
      )}
    >
      {online ? (
        <RefreshCw aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <CloudOff aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">
        {online ? null : <Bi k="offlineNow" />}
        {!online && queued > 0 ? ' · ' : null}
        {queued > 0 ? (
          <>
            <span className="tabular">{formatCount(queued)}</span>{' '}
            <Bi k="waitingToSync" />
          </>
        ) : null}
      </span>
    </div>
  )
}

export interface AppShellProps {
  children: React.ReactNode
  userName: string
  userRole: Role
}

/**
 * Application shell.
 *
 * Scroll model: `h-dvh overflow-hidden` on the shell and `overflow-y-auto` on
 * `<main>`. With `min-h-dvh` the document itself scrolls, the phone URL bar
 * shows and hides, `dvh` changes under the fixed tab bar and the whole layout
 * jumps. The tab bar is fixed at 64px + safe area; `<main>` carries `pb-24`
 * so the last row is never covered.
 *
 * There is NO hamburger on a phone. The bottom tab bar plus its More sheet is
 * the only navigation there; a drawer as well meant two nav systems at once.
 */
export function AppShell({ children, userName, userRole }: AppShellProps) {
  const pathname = usePathname()
  const online = useOnlineStatus()
  const queued = useQueueCount()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const navItems = getNavItems(userRole)
  const active = activeHref(pathname, [...navItems, PROFILE_ITEM])
  const titleKey = screenTitleKey(pathname)

  async function confirmLogout() {
    setSigningOut(true)
    // Write the LOGOUT audit record BEFORE next-auth clears the session — the
    // route reads auth() to know who is leaving.
    //
    // This used to be fired by a `beforeunload` sendBeacon in IdleLogout, which
    // was wrong twice over: it logged a "logout" on every page refresh, and it
    // never fired for a real logout through this button, because signOut() does
    // not touch that route. So the audit trail recorded refreshes and missed
    // the actual sign-outs.
    await apiPost('/api/auth/logout', undefined, { toastOnError: false })
    await signOut({ callbackUrl: '/login' })
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar. Hidden on a phone — the tab bar replaces it. */}
      <aside className="hidden shrink-0 border-r border-border bg-card md:flex md:w-56 md:flex-col">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <Building2 className="size-5 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">
            <Bi k="appName" />
          </span>
        </div>
        <nav aria-label="Sidebar" className="flex-1 space-y-1 overflow-y-auto p-2">
          {navItems.map(item => (
            <SidebarLink key={item.href} item={item} active={active === item.href} />
          ))}
        </nav>
        <Separator />
        <div className="shrink-0 space-y-1 p-2">
          <SidebarLink item={PROFILE_ITEM} active={active === PROFILE_ITEM.href} />
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-muted"
          >
            <LogOut className="size-4 shrink-0" />
            <Bi k="logout" className="min-w-0 truncate" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 56px top bar. The screen title lives here on a phone only —
            <PageHeader> prints it from md: up, and rendering both stacked the
            same words twice. */}
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-card px-2 md:px-6">
          <h1 className="min-w-0 flex-1 truncate px-2 text-lg font-semibold md:hidden">
            <Bi k={titleKey} />
          </h1>
          <div className="hidden min-w-0 flex-1 md:block" />

          {(userRole === 'ADMIN' || userRole === 'COLLECTION_AGENT') && (
            <NotificationBell userRole={userRole} />
          )}

          <Link
            href="/profile"
            aria-label="Profile"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            {initials(userName)}
          </Link>
        </header>

        <SyncStatusStrip online={online} queued={queued} />

        <main className="flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </main>
      </div>

      <BottomNav userRole={userRole} onLogout={() => setLogoutOpen(true)} />

      {/* Logout is confirmed, never one tap. A stray tap in the field costs an
          agent their session and, offline, their unsent work. */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Bi k="logoutQuestion" />
            </DialogTitle>
            <DialogDescription>
              <Bi k="logoutWarning" />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" size="lg">
                  <Bi k="stayLoggedIn" />
                </Button>
              }
            />
            <Button
              variant="destructive"
              size="lg"
              disabled={signingOut}
              onClick={confirmLogout}
            >
              <LogOut />
              <Bi k="logout" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
