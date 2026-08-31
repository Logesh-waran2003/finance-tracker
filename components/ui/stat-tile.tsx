import * as React from "react"
import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Bi } from "@/components/ui/bi"
import { Money } from "@/components/ui/money"
import { formatCount } from "@/lib/format"
import type { Label, LabelKey } from "@/lib/i18n"

export type TileIntent = "primary" | "success" | "warning" | "danger" | "info" | "neutral"

const chipClass: Record<TileIntent, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-muted text-success-muted-foreground",
  warning: "bg-warning-muted text-warning-muted-foreground",
  danger: "bg-danger-muted text-danger-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
}

const valueClass: Record<TileIntent, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning-muted-foreground",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-foreground",
}

export interface StatTileProps {
  icon?: LucideIcon
  /** Label key from `lib/i18n.ts`. */
  labelKey?: LabelKey
  /** Escape hatch for a dynamic label. */
  label?: Label
  /** A money string/number when `kind="money"`, otherwise a plain count. */
  value: string | number
  /** `money` renders <Money size="stat">, `count` renders a big tabular number. */
  kind?: "money" | "count"
  intent?: TileIntent
  /** Small caption under the number. */
  captionKey?: LabelKey
  caption?: React.ReactNode
  /** Makes the whole tile a link with a chevron. */
  href?: string
  onClick?: () => void
  compact?: boolean
  className?: string
}

/**
 * Big tappable KPI card. The number dominates; the label is secondary.
 * Minimum height 96px so it is comfortably tappable.
 */
function StatTile({
  icon: Icon,
  labelKey,
  label,
  value,
  kind = "money",
  intent = "neutral",
  captionKey,
  caption,
  href,
  onClick,
  compact,
  className,
}: StatTileProps) {
  const interactive = Boolean(href || onClick)

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {Icon ? (
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded",
                chipClass[intent]
              )}
            >
              <Icon aria-hidden="true" className="size-3" />
            </span>
          ) : null}
          {/* The label is a caption, deliberately quieter than the number.
              It used to be text-sm font-medium, which competed with the value
              and made a KPI tile read as a sentence with a number after it. */}
          <Bi
            k={labelKey}
            label={label}
            className="min-w-0 truncate text-xs font-medium text-muted-foreground"
          />
        </div>
        {href ? (
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground"
          />
        ) : null}
      </div>

      <div className="mt-1">
        {kind === "money" ? (
          <Money
            value={value}
            size="stat"
            compact={compact}
            className={valueClass[intent]}
          />
        ) : (
          <span className={cn("tabular text-3xl font-bold leading-none", valueClass[intent])}>
            {formatCount(value)}
          </span>
        )}
        {captionKey || caption ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {captionKey ? <Bi k={captionKey} inline /> : caption}
          </div>
        ) : null}
      </div>
    </>
  )

  const shared = cn(
    "flex flex-col justify-center gap-0.5 rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition",
    interactive &&
      "active:scale-[0.98] hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    className
  )

  if (href) {
    return (
      <Link href={href} data-slot="stat-tile" className={shared}>
        {body}
      </Link>
    )
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-slot="stat-tile" className={shared}>
        {body}
      </button>
    )
  }

  return (
    <div data-slot="stat-tile" className={shared}>
      {body}
    </div>
  )
}

export { StatTile }
