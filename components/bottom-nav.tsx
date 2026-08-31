'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, Users, Clock, Banknote, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

type Role = 'ADMIN' | 'COLLECTION_AGENT' | 'STAFF'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const agentBottomNav: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Collections', href: '/collections', icon: CreditCard },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Loans', href: '/loans', icon: Banknote },
  { label: 'Attendance', href: '/attendance', icon: Clock },
]

const adminBottomNav: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Collections', href: '/admin/collections', icon: CreditCard },
  { label: 'Loans', href: '/admin/loans', icon: Banknote },
  { label: 'Requests', href: '/admin/loan-requests', icon: ClipboardList },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Attendance', href: '/admin/attendance', icon: Clock },
]

const staffBottomNav: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Attendance', href: '/attendance', icon: Clock },
]

function getBottomNav(role: Role): NavItem[] {
  if (role === 'COLLECTION_AGENT') return agentBottomNav
  if (role === 'ADMIN') return adminBottomNav
  return staffBottomNav
}

export function BottomNav({ userRole }: { userRole: Role }) {
  const pathname = usePathname()
  const items = getBottomNav(userRole)

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                active ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600',
              )}
            >
              <item.icon className={cn('h-5 w-5', active ? 'stroke-[2.5px]' : 'stroke-2')} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
