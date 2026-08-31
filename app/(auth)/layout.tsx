import { Building2 } from 'lucide-react'

import { Bi } from '@/components/ui/bi'

/**
 * Auth shell. No tab bar and no sidebar here, so the page scrolls itself.
 * `min-h-dvh` is correct on this screen — there is no fixed bottom bar for a
 * changing viewport height to fight with.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 aria-hidden="true" className="size-7" />
          </span>
          <h1 className="text-2xl font-bold">
            <Bi k="appName" />
          </h1>
        </div>
        {children}
      </div>
    </div>
  )
}
