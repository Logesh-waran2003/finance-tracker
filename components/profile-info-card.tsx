import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InfoItem {
  label: string
  value: string
}

interface Props {
  name: string
  items: InfoItem[]
}

export function ProfileInfoCard({ name, items }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {items.map(item => (
            <div key={item.label}>
              <dt className="text-xs text-gray-500">{item.label}</dt>
              <dd className="text-sm font-medium text-gray-900 mt-0.5">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
