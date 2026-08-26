import { auth } from '@/auth'
import { db } from '@/lib/db'
import { collections, profiles, attendance } from '@/lib/db/schema'
import { sql, eq, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import DashboardClient from '@/components/dashboard/dashboard-client'

// ── helpers ──────────────────────────────────────────────────────────────────

function todayIST() {
  // IST = UTC+5:30
  const istNow = new Date(Date.now() + 330 * 60_000)
  return istNow.toISOString().slice(0, 10)
}

// ── main page ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const userId = session.user.id
  const role = (session.user as any).role as string

  // ── profile row ────────────────────────────────────────────────────────────
  const profileRow = await db.query.profiles.findFirst({
    where: eq(profiles.id, userId),
    with: { branch: true } as any,
  }).catch(() => null)

  // ── non-admin view ─────────────────────────────────────────────────────────
  if (role !== 'ADMIN') {
    const today = todayIST()

    const [myAttRow, myPendingRow] = await Promise.all([
      db.select().from(attendance)
        .where(and(eq(attendance.employee_id, userId), eq(attendance.date, today)))
        .limit(1),
      db.select({ count: sql<string>`count(*)` }).from(collections)
        .where(and(eq(collections.agent_id, userId), eq(collections.status, 'PENDING'))),
    ])

    const myAtt = myAttRow[0]
    const myPending = parseInt(myPendingRow[0]?.count ?? '0', 10)

    const attLabel: Record<string, string> = {
      PRESENT: 'Present', LATE: 'Late', HALF_DAY: 'Half Day',
      ABSENT: 'Absent', LEAVE: 'On Leave', WEEK_OFF: 'Week Off',
    }
    const attVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      PRESENT: 'default', LATE: 'secondary', HALF_DAY: 'outline',
      ABSENT: 'destructive', LEAVE: 'secondary', WEEK_OFF: 'outline',
    }

    return (
      <div className="max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Welcome, {(profileRow as any)?.full_name ?? 'User'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Role: <span className="text-foreground font-medium">{role.replace(/_/g, ' ')}</span></p>
            <p>Branch: <span className="text-foreground font-medium">{(profileRow as any)?.branch?.name ?? 'Unassigned'}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Attendance today</span>
              {myAtt ? (
                <Badge variant={attVariant[myAtt.status] ?? 'outline'}>
                  {attLabel[myAtt.status] ?? myAtt.status}
                  {myAtt.check_in_at
                    ? ` · ${new Date(myAtt.check_in_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : ''}
                </Badge>
              ) : (
                <Badge variant="outline">Not checked in</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pending collections</span>
              <span className="font-semibold">{myPending}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3 text-sm">
          {[
            { href: '/attendance', label: '📍 Check In' },
            { href: '/collections', label: '💰 My Collections' },
            { href: '/customers', label: '👥 My Customers' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center justify-center rounded-lg border bg-card px-3 py-3 font-medium hover:bg-muted transition-colors text-center"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // ── admin view ────────────────────────────────────────────────────────────
  const today = todayIST()

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview for {today}</p>
      </div>
      <DashboardClient />
    </div>
  )
}
