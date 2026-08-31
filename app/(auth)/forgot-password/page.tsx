import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { Bi } from '@/components/ui/bi'

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground">
      <h2 className="text-xl font-bold">
        <Bi k="forgotPassword" />
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        <Bi k="forgotPasswordHelp" />
      </p>
      <Link
        href="/login"
        className="mt-4 inline-flex min-h-12 items-center gap-2 text-base font-medium text-primary hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        <Bi k="backToLogin" />
      </Link>
    </div>
  )
}
