'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { toast } from 'sonner'
import { Eye, EyeOff, KeyRound } from 'lucide-react'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { ActionButton } from '@/components/ui/action-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { apiPost } from '@/lib/api-client'
import { labels } from '@/lib/i18n'

const schema = z.object({
  current_password: z.string().min(1, labels.passwordRequired.en),
  new_password: z.string().min(8, labels.passwordTooShort.en),
  confirm_password: z.string().min(1, labels.passwordRequired.en),
}).refine(data => data.new_password === data.confirm_password, {
  message: labels.passwordsDoNotMatch.en,
  path: ['confirm_password'],
})

type FormValues = z.infer<typeof schema>

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false)
  const [show, setShow] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setSaving(true)
    const res = await apiPost('/api/change-password', {
      current_password: values.current_password,
      new_password: values.new_password,
    })
    // The button always comes back. apiPost never throws and has already
    // toasted on failure, so there is nothing to catch here.
    setSaving(false)
    if (!res.ok) return
    toast.success(labels.passwordChanged.en)
    reset()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          <Bi k="changePassword" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            labelKey="currentPassword"
            htmlFor="current_password"
            required
            error={errors.current_password?.message}
          >
            <Input
              id="current_password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="next"
              {...register('current_password')}
            />
          </FormField>

          <FormField
            labelKey="newPassword"
            htmlFor="new_password"
            required
            error={errors.new_password?.message}
            hint={<Bi k="passwordMinLength" />}
          >
            <div className="relative">
              <Input
                id="new_password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                enterKeyHint="next"
                className="pr-14"
                {...register('new_password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={labels[show ? 'hidePassword' : 'showPassword'].en}
                aria-pressed={show}
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShow(v => !v)}
              >
                {show ? <EyeOff /> : <Eye />}
              </Button>
            </div>
          </FormField>

          <FormField
            labelKey="confirmPassword"
            htmlFor="confirm_password"
            required
            error={errors.confirm_password?.message}
          >
            <Input
              id="confirm_password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              enterKeyHint="done"
              {...register('confirm_password')}
            />
          </FormField>

          <ActionButton
            type="submit"
            icon={KeyRound}
            labelKey={saving ? 'saving' : 'changePassword'}
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
