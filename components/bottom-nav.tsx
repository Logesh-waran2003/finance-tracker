'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, CreditCard, Users, Clock, Banknote, ClipboardList,
  Receipt, ArrowLeftRight, CheckSquare, ShieldCheck, CalendarCheck,
  FileBarChart2, Settings, User, LogOut, ChevronRight, MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Bi } from '@/components/ui/bi'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import type { LabelKey } from '@/lib/i18n'

export type Role = 'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'

export interface NavItem {
  /** Full name — sidebar and More sheet. */
  k: LabelKey
  /**
   * Short name for the tab bar. A tab is ~72px wide at 360px, so "My
   * Collections" does not fit; "Collections" does. Falls back to `k`.
   */
  tabK?: LabelKey
  href: string
  icon: LucideIcon
}

/**
 * ONE nav registry for the whole shell.
 *
 * `tabs` are the 4 most-used destinations and become the first four items in
 * the phone tab bar. Everything in `overflow` is reachable from the "More"
 * sheet (5th tab). The sidebar on `md:` shows `tabs` + `overflow` together,
 * so nothing is phone-only or desktop-only.
 *
 * Profile and Logout are appended to the More sheet for EVERY role, which is
 * what stops STAFF — who have very few destinations — from being trapped in
 * the app with no way to sign out.
 */
interface RoleNav {
  tabs: NavItem[]
  overflow: NavItem[]
}

const ROLE_NAV: Record<Role, RoleNav> = {
  COLLECTION_AGENT: {
    tabs: [
      { k: 'dashboard', tabK: 'tabHome', href: '/dashboard', icon: LayoutDashboard },
      { k: 'myCollections', tabK: 'tabCollections', href: '/collections', icon: CreditCard },
      { k: 'myCustomers', tabK: 'tabCustomers', href: '/customers', icon: Users },
      { k: 'loans', tabK: 'tabLoans', href: '/loans', icon: Banknote },
    ],
    overflow: [
      { k: 'myAttendance', tabK: 'tabAttendance', href: '/attendance', icon: Clock },
      { k: 'officeExpenses', tabK: 'tabExpenses', href: '/expenses', icon: Receipt },
      { k: 'cashSettlement', tabK: 'tabSettlement', href: '/reconciliation', icon: ArrowLeftRight },
    ],
  },
  ADMIN: {
    tabs: [
      { k: 'dashboard', tabK: 'tabHome', href: '/dashboard', icon: LayoutDashboard },
      { k: 'collections', tabK: 'tabCollections', href: '/admin/collections', icon: CreditCard },
      { k: 'loans', tabK: 'tabLoans', href: '/admin/loans', icon: Banknote },
      { k: 'customers', tabK: 'tabCustomers', href: '/admin/customers', icon: Users },
    ],
    overflow: [
      { k: 'loanRequests', tabK: 'tabRequests', href: '/admin/loan-requests', icon: ClipboardList },
      { k: 'collectionApproval', href: '/admin/loans/collection-approval', icon: CheckSquare },
      { k: 'employees', href: '/admin/employees', icon: ShieldCheck },
      { k: 'attendance', tabK: 'tabAttendance', href: '/admin/attendance', icon: CalendarCheck },
      { k: 'reconciliation', tabK: 'tabSettlement', href: '/admin/reconciliation', icon: ArrowLeftRight },
      { k: 'reports', href: '/admin/reports', icon: FileBarChart2 },
      { k: 'settings', href: '/admin/settings', icon: Settings },
      { k: 'myAttendance', href: '/attendance', icon: Clock },
      { k: 'officeExpenses', tabK: 'tabExpenses', href: '/expenses', icon: Receipt },
    ],
  },
  STAFF: {
    tabs: [
      { k: 'dashboard', tabK: 'tabHome', href: '/dashboard', icon: LayoutDashboard },
      { k: 'myAttendance', tabK: 'tabAttendance', href: '/attendance', icon: Clock },
      { k: 'officeExpenses', tabK: 'tabExpenses', href: '/expenses', icon: Receipt },
    ],
    overflow: [],
  },
}

export const PROFILE_ITEM: NavItem = { k: 'profile', href: '/profile', icon: User }

/** Tab-bar items, never more than 4 — the 5th slot is always "More". */
export function getTabItems(role: Role): NavItem[] {
  return ROLE_NAV[role].tabs.slice(0, 4)
}

/** Everything the tab bar could not fit, plus Profile. Logout is rendered separately. */
export function getMoreItems(role: Role): NavItem[] {
  return [...ROLE_NAV[role].tabs.slice(4), ...ROLE_NAV[role].overflow, PROFILE_ITEM]
}

/** Full destination list for the `md:` sidebar. Profile is rendered separately there. */
export function getNavItems(role: Role): NavItem[] {
  return [...ROLE_NAV[role].tabs, ...ROLE_NAV[role].overflow]
}

/**
 * Longest-prefix match. `/admin/loans/collection-approval` must light up
 * "Collection Approval", not "Loans", so a plain `startsWith` is not enough.
 */
export function activeHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null
  for (const item of items) {
    const hit = pathname === item.href || pathname.startsWith(item.href + '/')
    if (hit && (best === null || item.href.length > best.length)) best = item.href
  }
  return best
}

export interface BottomNavProps {
  userRole: Role
  /** Opens the confirm dialog owned by the app shell. */
  onLogout: () => void
}

/**
 * Phone-only tab bar. 64px row + safe-area padding — `<StickyActionBar>`
 * offsets itself by exactly `calc(4rem + env(safe-area-inset-bottom))`, so
 * that height is a contract, not a preference.
 */
export function BottomNav({ userRole, onLogout }: BottomNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const tabs = getTabItems(userRole)
  const moreItems = getMoreItems(userRole)
  const active = activeHref(pathname, [...tabs, ...moreItems])
  const moreActive = moreItems.some(i => i.href === active)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-safe md:hidden"
    >
      <div className="flex h-16 items-stretch">
        {tabs.map(item => {
          const isActive = active === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                />
              )}
              <item.icon className="size-6 shrink-0" strokeWidth={isActive ? 2.4 : 2} />
              <Bi
                k={item.tabK ?? item.k}
                className="w-full truncate text-center text-[11px] leading-none font-medium"
              />
            </Link>
          )
        })}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label="More options"
                className={cn(
                  'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
                  moreActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {moreActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                  />
                )}
                <MoreHorizontal className="size-6 shrink-0" strokeWidth={moreActive ? 2.4 : 2} />
                <Bi
                  k="tabMore"
                  className="w-full truncate text-center text-[11px] leading-none font-medium"
                />
              </button>
            }
          />

          <SheetContent side="bottom" className="gap-0 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
            <SheetHeader className="pb-2">
              <SheetTitle>
                <Bi k="more" />
              </SheetTitle>
            </SheetHeader>

            <ul className="flex flex-col px-2">
              {moreItems.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active === item.href ? 'page' : undefined}
                    className={cn(
                      'flex min-h-14 items-center gap-3 rounded-lg px-3 text-base transition-colors active:bg-muted',
                      active === item.href
                        ? 'bg-muted font-semibold text-primary'
                        : 'text-foreground',
                    )}
                  >
                    <item.icon className="size-5 shrink-0 text-muted-foreground" />
                    <Bi k={item.k} className="min-w-0 flex-1 truncate" />
                    <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => { setMoreOpen(false); onLogout() }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg px-3 text-base text-danger transition-colors active:bg-danger-muted"
                >
                  <LogOut className="size-5 shrink-0" />
                  <Bi k="logout" className="min-w-0 flex-1 truncate text-left" />
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 opacity-60" />
                </button>
              </li>
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
