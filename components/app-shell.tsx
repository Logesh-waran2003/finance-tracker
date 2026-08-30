'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  Menu, LayoutDashboard, Clock, Receipt, CreditCard, Users,
  ArrowLeftRight, ShieldCheck, Building2, CalendarCheck,
  FileBarChart2, Settings, LogOut, User, Banknote, ClipboardList, CheckSquare,
} from 'lucide-react'
import { NotificationBell } from '@/components/notification-bell'
import { BottomNav } from '@/components/bottom-nav'

type Role = 'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const commonNav: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Attendance', href: '/attendance', icon: Clock },
  { label: 'Office Expenses', href: '/expenses', icon: Receipt },
]

const agentNav: NavItem[] = [
  { label: 'My Collections', href: '/collections', icon: CreditCard },
  { label: 'My Customers', href: '/customers', icon: Users },
  { label: 'Loans', href: '/loans', icon: Banknote },
  { label: 'Cash Reconciliation', href: '/reconciliation', icon: ArrowLeftRight },
]

const adminNav: NavItem[] = [
  { label: 'Collections', href: '/admin/collections', icon: CreditCard },
  { label: 'Loans', href: '/admin/loans', icon: Banknote },
  { label: 'Loan Requests', href: '/admin/loan-requests', icon: ClipboardList },
  { label: 'Collection Approval', href: '/admin/loans/collection-approval', icon: CheckSquare },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Employees', href: '/admin/employees', icon: ShieldCheck },
  { label: 'Attendance', href: '/admin/attendance', icon: CalendarCheck },
  { label: 'Reconciliation', href: '/admin/reconciliation', icon: ArrowLeftRight },
  { label: 'Reports', href: '/admin/reports', icon: FileBarChart2 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
]

function getNavItems(role: Role): NavItem[] {
  if (role === 'COLLECTION_AGENT') return [...commonNav, ...agentNav]
  if (role === 'ADMIN') return [...commonNav, ...adminNav]
  return commonNav
}

const ROLE_BADGE: Record<Role, 'destructive' | 'secondary' | 'outline'> = {
  ADMIN: 'destructive',
  COLLECTION_AGENT: 'secondary',
  STAFF: 'outline',
}

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  COLLECTION_AGENT: 'Agent',
  STAFF: 'Staff',
}

interface SidebarNavProps {
  items: NavItem[]
  pathname: string
  onClose?: () => void
}

function SidebarNav({ items, pathname, onClose }: SidebarNavProps) {
  return (
    <nav className="flex-1 space-y-0.5 px-2 py-3">
      {items.map(item => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export interface AppShellProps {
  children: React.ReactNode
  userName: string
  userRole: Role
}

export function AppShell({ children, userName, userRole }: AppShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const navItems = getNavItems(userRole)

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-14 items-center px-4 border-b shrink-0">
        <Building2 className="h-5 w-5 text-gray-700 mr-2" />
        <span className="text-sm font-semibold text-gray-900">Finance Tracker</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav items={navItems} pathname={pathname} onClose={() => setOpen(false)} />
      </div>
      <Separator />
      <div className="p-2 shrink-0">
        <Link
          href="/profile"
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname === '/profile'
              ? 'bg-gray-100 text-gray-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
          )}
        >
          <User className="h-4 w-4 shrink-0" />
          Profile
        </Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:bg-white shrink-0">
        {sidebarContent}
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-4 md:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              }
            />
            <SheetContent side="left" className="w-56 p-0">
              {sidebarContent}
            </SheetContent>
          </Sheet>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {(userRole === 'ADMIN' || userRole === 'COLLECTION_AGENT') && <NotificationBell userRole={userRole} />}
            <Badge variant={ROLE_BADGE[userRole]} className="hidden sm:flex">
              {ROLE_LABEL[userRole]}
            </Badge>
            <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[160px] truncate">
              {userName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-gray-600"
              onClick={() => { window.location.href = '/auth/signout' }}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Logout</span>
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 pb-20 md:pb-6 md:p-6">
          {children}
        </main>
      </div>
      <BottomNav userRole={userRole} />
    </div>
  )
}
