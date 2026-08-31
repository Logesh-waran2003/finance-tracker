import * as React from "react"

import { labels, type Label, type LabelKey } from "@/lib/i18n"

export interface BiProps {
  /** Key in `lib/i18n.ts`. Ignored when `label` is given. */
  k?: LabelKey
  /** Escape hatch for dynamic text (a resolved status, a category name). */
  label?: Label
  /**
   * No-ops. This component was briefly bilingual (Tamil line + English line);
   * the app is English-only now, so there is nothing to stack or pick between.
   * They are kept in the signature so the ~130 existing call sites still
   * compile, and so a second language can return without touching them.
   */
  inline?: boolean
  only?: Lang
  className?: string
}

type Lang = "en"

/**
 * The only way to render a user-facing label.
 * Renders one English string. Every label lives in `lib/i18n.ts` — never
 * hardcode a user-facing string in a feature file.
 */
function Bi({ k, label, className }: BiProps) {
  const value: Label | undefined = label ?? (k ? labels[k] : undefined)
  if (!value) return null

  return <span className={className}>{value.en}</span>
}

export { Bi }
