import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bi } from '@/components/ui/bi'
import type { LabelKey } from '@/lib/i18n'

export interface ProfileInfoItem {
  /** Label key from `lib/i18n.ts` — never a hardcoded string. */
  k: LabelKey
  /** Already-formatted value, or a node such as a <StatusBadge>. */
  value: React.ReactNode
}

interface Props {
  name: string
  items: readonly ProfileInfoItem[]
}

export function ProfileInfoCard({ name, items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-0 md:grid md:grid-cols-2 md:gap-x-6">
          {items.map(item => (
            <div
              key={item.k}
              className="flex min-h-12 items-center justify-between gap-3 border-b border-border py-2 last:border-b-0 md:border-b-0 md:py-1.5"
            >
              <dt className="min-w-0 text-sm text-muted-foreground">
                <Bi k={item.k} />
              </dt>
              <dd className="min-w-0 text-right text-sm font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
