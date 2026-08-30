'use client'

import { MapPin } from 'lucide-react'

interface Props {
  query: string
  className?: string
}

export function GMapsLink({ query, className }: Props) {
  const q = query.trim()
  if (!q) return null
  const url = `https://maps.google.com/?q=${encodeURIComponent(q)}`
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-blue-600 hover:underline ${className ?? ''}`}
    >
      <MapPin size={11} />
      View on Google Maps
    </a>
  )
}
