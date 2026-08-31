import * as React from "react"
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Bi } from "@/components/ui/bi"
import { statusLabel } from "@/lib/i18n"

export type StatusIntent = "success" | "warning" | "danger" | "info" | "neutral"

/**
 * Canonical status → intent map (design contract §7).
 * Exported so charts, tiles and rows can colour themselves the same way.
 */
export const STATUS_INTENT: Record<string, StatusIntent> = {
  // success — money in / confirmed / present
  CONFIRMED: "success",
  PAID: "success",
  APPROVED: "success",
  VERIFIED: "success",
  PRESENT: "success",
  ACTIVE: "success",
  CREDIT: "success",
  // warning — waiting
  PENDING: "warning",
  SUBMITTED: "warning",
  PARTIALLY_PAID: "warning",
  LATE: "warning",
  HALF_DAY: "warning",
  LEAVE: "warning",
  // danger — money out / failed
  REJECTED: "danger",
  CANCELLED: "danger",
  ABSENT: "danger",
  OVERDUE: "danger",
  INACTIVE: "danger",
  DEBIT: "danger",
  REVERSAL: "danger",
  // info — neutral fact
  OPEN: "info",
  DRAFT: "info",
  WEEK_OFF: "info",
  RECONCILIATION: "info",
}

export function statusIntent(status: string): StatusIntent {
  return STATUS_INTENT[status?.toUpperCase?.() ?? ""] ?? "neutral"
}

const intentIcon: Record<StatusIntent, LucideIcon> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  info: Circle,
  neutral: Circle,
}

const intentClass: Record<StatusIntent, string> = {
  success: "bg-success-muted text-success-muted-foreground",
  warning: "bg-warning-muted text-warning-muted-foreground",
  danger: "bg-danger-muted text-danger-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
}

export interface StatusBadgeProps
  extends Omit<React.ComponentProps<"span">, "children"> {
  /** Any enum string from the database. Unknown values degrade gracefully. */
  status: string
  /** Hide the English half. Tamil + icon only. */
  compact?: boolean
}

/**
 * Colour is never the only signal: every badge carries an icon and a word.
 */
function StatusBadge({
  status,
  compact,
  className,
  ...props
}: StatusBadgeProps) {
  const intent = statusIntent(status)
  const Icon = intentIcon[intent]
  const label = statusLabel(status)

  return (
    <span
      data-slot="status-badge"
      data-intent={intent}
      className={cn(
        "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        intentClass[intent],
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {compact ? (
        <Bi label={label} />
      ) : (
        <Bi label={label} inline className="[&_span]:text-xs [&_span]:text-current [&>span:last-child]:opacity-75" />
      )}
    </span>
  )
}

export { StatusBadge }
