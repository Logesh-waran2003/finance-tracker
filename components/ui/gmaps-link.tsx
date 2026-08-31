'use client'

import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Bi } from '@/components/ui/bi'
import type { LabelKey } from '@/lib/i18n'

interface Props {
  /** Free-text place, address, or "lat,lng". Renders nothing when empty. */
  query: string
  /** Defaults to "View on map". */
  labelKey?: LabelKey
  className?: string
}

/**
 * Opens a place in Google Maps.
 *
 * Previously hardcoded `text-blue-600` and the literal string "View on Google
 * Maps" — both contract violations: colour must come from a token so the link
 * is readable in dark mode, and user-facing text must live in lib/i18n.ts.
 */
export function GMapsLink({ query, labelKey = 'viewOnMap', className }: Props) {
  const q = query.trim()
  if (!q) return null

  return (
    <a
      href={`https://maps.google.com/?q=${encodeURIComponent(q)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 text-sm text-primary hover:underline',
        className,
      )}
    >
      <MapPin aria-hidden="true" className="size-4 shrink-0" />
      <Bi k={labelKey} />
    </a>
  )
}
