'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const schema = z.object({
  company_name: z.string().min(1, 'Required'),
  currency: z.string().min(1, 'Required'),
  currency_symbol: z.string().min(1, 'Required'),
  timezone: z.string().min(1, 'Required'),
  financial_year_start: z.number().int().min(1).max(12),
})

type FormValues = z.infer<typeof schema>

interface Props {
  initialData: {
    company_name: string
    currency: string
    currency_symbol: string
    timezone: string
    financial_year_start: number
    logo_url?: string | null
  } | null
}

export function CompanySettingsForm({ initialData }: Props) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: initialData?.company_name ?? 'My Company',
      currency: initialData?.currency ?? 'INR',
      currency_symbol: initialData?.currency_symbol ?? '₹',
      timezone: initialData?.timezone ?? 'Asia/Kolkata',
      financial_year_start: initialData?.financial_year_start ?? 4,
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error ?? 'Failed to save')
        return
      }
      toast.success('Settings saved')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Company Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Company Name</Label>
            <Input id="company_name" {...register('company_name')} />
            {errors.company_name && (
              <p className="text-xs text-red-500">{errors.company_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency Code</Label>
              <Input id="currency" placeholder="INR" {...register('currency')} />
              {errors.currency && (
                <p className="text-xs text-red-500">{errors.currency.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency_symbol">Currency Symbol</Label>
              <Input id="currency_symbol" placeholder="INR" {...register('currency_symbol')} />
              {errors.currency_symbol && (
                <p className="text-xs text-red-500">{errors.currency_symbol.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" placeholder="Asia/Kolkata" {...register('timezone')} />
            {errors.timezone && (
              <p className="text-xs text-red-500">{errors.timezone.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="financial_year_start">Financial Year Start (month 1-12)</Label>
            <Input
              id="financial_year_start"
              type="number"
              min={1}
              max={12}
              {...register('financial_year_start', { valueAsNumber: true })}
            />
            {errors.financial_year_start && (
              <p className="text-xs text-red-500">{errors.financial_year_start.message}</p>
            )}
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
