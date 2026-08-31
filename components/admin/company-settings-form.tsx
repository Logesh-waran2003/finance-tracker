'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { apiPatch } from '@/lib/api-client'
import { t } from '@/lib/i18n'

const schema = z.object({
  company_name: z.string().min(1, t('requiredField').en),
  currency: z.string().min(1, t('requiredField').en),
  currency_symbol: z.string().min(1, t('requiredField').en),
  timezone: z.string().min(1, t('requiredField').en),
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      company_name: initialData?.company_name ?? '',
      currency: initialData?.currency ?? 'INR',
      currency_symbol: initialData?.currency_symbol ?? '₹',
      timezone: initialData?.timezone ?? 'Asia/Kolkata',
      financial_year_start: initialData?.financial_year_start ?? 4,
    },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await apiPatch<unknown>('/api/admin/settings', values)
    // Every failure path re-enables the button.
    setSaving(false)
    if (!res.ok) return
    toast.success(t('settingsSaved').en)
  }

  return (
    <Card className="md:max-w-lg">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">
            <Bi k="companySettings" />
          </h2>

          <FormField
            labelKey="companyName"
            htmlFor="company_name"
            required
            error={errors.company_name?.message ?? null}
          >
            <Input id="company_name" {...register('company_name')} />
          </FormField>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              labelKey="currencyCode"
              htmlFor="currency"
              required
              error={errors.currency?.message ?? null}
            >
              <Input id="currency" placeholder="INR" {...register('currency')} />
            </FormField>
            <FormField
              labelKey="currencySymbol"
              htmlFor="currency_symbol"
              required
              error={errors.currency_symbol?.message ?? null}
            >
              <Input id="currency_symbol" placeholder="₹" {...register('currency_symbol')} />
            </FormField>
          </div>

          <FormField
            labelKey="timezone"
            htmlFor="timezone"
            required
            error={errors.timezone?.message ?? null}
          >
            <Input id="timezone" placeholder="Asia/Kolkata" {...register('timezone')} />
          </FormField>

          <FormField
            labelKey="financialYearStart"
            htmlFor="financial_year_start"
            required
            error={errors.financial_year_start?.message ?? null}
          >
            <Input
              id="financial_year_start"
              type="number"
              min={1}
              max={12}
              {...register('financial_year_start', { valueAsNumber: true })}
            />
          </FormField>

          <Button type="submit" size="lg" disabled={saving} className="md:self-start">
            {saving ? <Loader2 className="animate-spin" /> : null}
            <Bi k={saving ? 'savingChanges' : 'saveChanges'} />
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
