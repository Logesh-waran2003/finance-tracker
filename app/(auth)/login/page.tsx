'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, LogIn } from 'lucide-react'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { ActionButton } from '@/components/ui/action-button'
import { labels, type LabelKey } from '@/lib/i18n'

/**
 * The first screen a new agent ever sees, and many of them are first-time
 * smartphone users. One column, 56px controls, one big button, and errors
 * that say what to do — never a raw server string.
 */
export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorKey, setErrorKey] = useState<LabelKey | null>(null)

  // Read the redirect reason from the URL directly. `useSearchParams()` would
  // force this whole page into a Suspense boundary for no benefit.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('error')
    if (reason === 'account_inactive') setErrorKey('accountInactive')
  }, [])

  // Already signed in — skip the form.
  useEffect(() => {
    getSession().then(s => {
      if (s?.user) router.replace('/dashboard')
    })
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setErrorKey('emailRequired'); return }
    if (!password) { setErrorKey('passwordRequired'); return }

    setLoading(true)
    setErrorKey(null)

    const res = await signIn('credentials', {
      email: email.trim(),
      password,
      redirect: false,
    })

    // The button must become usable again on every failure path, or a wrong
    // password locks the agent out of retrying.
    if (!res || res.error) {
      setErrorKey('invalidCredentials')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground">
      <h2 className="text-xl font-bold">
        <Bi k="signIn" />
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <Bi k="signInSubtitle" />
      </p>

      <form onSubmit={handleLogin} className="mt-5 space-y-4" suppressHydrationWarning>
        {errorKey && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-muted bg-danger-muted p-3 text-sm text-danger-muted-foreground"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <Bi k={errorKey} />
          </p>
        )}

        <FormField labelKey="email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="next"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            suppressHydrationWarning
          />
        </FormField>

        <FormField labelKey="password" htmlFor="password" required>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              enterKeyHint="go"
              className="pr-14"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              suppressHydrationWarning
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={labels[showPassword ? 'hidePassword' : 'showPassword'].en}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
              onClick={() => setShowPassword(v => !v)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </FormField>

        <ActionButton
          type="submit"
          icon={LogIn}
          labelKey={loading ? 'signingIn' : 'signIn'}
          intent="primary"
          size="lg"
          loading={loading}
          className="w-full md:w-full"
        />

        <p className="text-center text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            <Bi k="forgotPassword" />
          </span>{' '}
          <Bi k="forgotPasswordHelp" />
        </p>
      </form>
    </div>
  )
}
