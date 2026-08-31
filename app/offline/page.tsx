import { Bi } from '@/components/ui/bi'
import { labels } from '@/lib/i18n'
import { WifiOff, RefreshCw, CloudUpload } from 'lucide-react'

/**
 * The service worker falls back here when a navigation cannot reach the server.
 *
 * SERVER COMPONENT, NO DATA FETCHING, NO CLIENT JAVASCRIPT.
 * It has to render from the cache with no network at all, so the retry is a
 * plain <a>: the browser re-requests the page instead of a router navigation
 * that would be served straight back out of the same cache.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 py-10 pt-safe pb-safe text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-danger-muted text-danger-muted-foreground">
        <WifiOff aria-hidden="true" className="size-12" />
      </span>

      <div className="space-y-2">
        <h1 lang="ta" className="text-2xl leading-tight font-bold text-foreground">
          {labels.offlineTitle.en}
        </h1>
        <p lang="en" className="text-sm text-muted-foreground">
          {labels.offlineTitle.en}
        </p>
      </div>

      <p className="flex max-w-sm items-start gap-3 rounded-xl bg-success-muted p-4 text-left text-base leading-relaxed text-success-muted-foreground">
        <CloudUpload aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <Bi k="offlineHelp" />
      </p>

      <a
        href="/dashboard"
        className="flex min-h-14 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <RefreshCw aria-hidden="true" className="size-5 shrink-0" />
        <Bi k="tryAgain" inline className="[&_span]:text-current [&>span:last-child]:opacity-75" />
      </a>
    </main>
  )
}
