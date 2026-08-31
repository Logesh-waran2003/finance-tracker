'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { toast } from 'sonner'
import { useTheme } from 'next-themes'
import { Check, MonitorSmartphone, Moon, Save, Sun } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Bi } from '@/components/ui/bi'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { ActionButton } from '@/components/ui/action-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiPatch } from '@/lib/api-client'
import { labels } from '@/lib/i18n'

const schema = z.object({
  full_name: z.string().min(1, labels.nameRequired.en),
  phone: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  initialName: string
  initialPhone: string
}

export function ProfileEditForm({ initialName, initialPhone }: Props) {
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { full_name: initialName, phone: initialPhone },
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await apiPatch('/api/profile', values)
    setSaving(false)
    if (!res.ok) return
    toast.success(labels.profileUpdated.en)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Bi k="editProfile" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            labelKey="fullName"
            htmlFor="full_name"
            required
            error={errors.full_name?.message}
          >
            <Input
              id="full_name"
              autoComplete="name"
              enterKeyHint="next"
              {...register('full_name')}
            />
          </FormField>

          <FormField labelKey="phone" htmlFor="phone">
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="done"
              {...register('phone')}
            />
          </FormField>

          <ActionButton
            type="submit"
            icon={Save}
            labelKey={saving ? 'saving' : 'saveChanges'}
            intent="primary"
            size="lg"
            loading={saving}
            className="w-full md:w-full"
          />
        </form>
      </CardContent>
    </Card>
  )
}

/**
 * Dark mode switch.
 *
 * `<ThemeProvider>` has been live for a while but nothing in the UI reached
 * it, so every `dark:` utility in the app was unreachable by a real user.
 * Agents work outdoors in daylight and indoors at night; this is the control
 * for that.
 */
export function AppearanceCard() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // next-themes only knows the chosen theme on the client. Rendering the
  // selected state before mount produces a hydration mismatch.
  useEffect(() => { setMounted(true) }, [])

  const options = [
    { value: 'light', icon: Sun, k: 'lightMode' },
    { value: 'dark', icon: Moon, k: 'darkMode' },
    { value: 'system', icon: MonitorSmartphone, k: 'system' },
  ] as const

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Bi k="appearance" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {options.map(option => {
          const selected = mounted && theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 text-base font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:bg-muted',
              )}
            >
              <option.icon aria-hidden="true" className="size-5 shrink-0" />
              <Bi k={option.k} className="min-w-0 flex-1 truncate text-left" />
              {selected && <Check aria-hidden="true" className="size-5 shrink-0" />}
            </button>
          )
        })}
        <p className="text-sm text-muted-foreground">
          <Bi k="useDarkScreenHint" />
        </p>
      </CardContent>
    </Card>
  )
}
