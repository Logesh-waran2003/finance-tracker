"use client"

import * as React from "react"
import { Loader2, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Bi } from "@/components/ui/bi"
import { Money } from "@/components/ui/money"
import type { Label, LabelKey } from "@/lib/i18n"

export type ActionIntent = "primary" | "success" | "warning" | "danger" | "info" | "neutral"

const surfaceClass: Record<ActionIntent, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  success: "bg-success text-success-foreground hover:bg-success/90",
  warning: "bg-warning text-warning-foreground hover:bg-warning/90",
  danger: "bg-danger text-danger-foreground hover:bg-danger/90",
  info: "bg-info text-info-foreground hover:bg-info/90",
  neutral: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
}

export interface ActionButtonProps
  extends Omit<React.ComponentProps<"button">, "children"> {
  icon?: LucideIcon
  labelKey?: LabelKey
  label?: Label
  /** Small second line under the label. */
  sublabelKey?: LabelKey
  sublabel?: Label
  intent?: ActionIntent
  /** Amount shown on the trailing edge — pass the raw numeric string. */
  amount?: string | number
  /** Shows a spinner and disables the button. */
  loading?: boolean
  size?: "default" | "lg"
}

/**
 * The one big coloured action on a screen. Full width on a phone, 56px tall,
 * icon in a chip so it is understandable with the text covered.
 */
function ActionButton({
  icon: Icon,
  labelKey,
  label,
  sublabelKey,
  sublabel,
  intent = "primary",
  amount,
  loading,
  size = "default",
  className,
  disabled,
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      data-slot="action-button"
      data-intent={intent}
      disabled={disabled || loading}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-4 text-left font-semibold transition select-none active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 md:w-auto md:min-w-64",
        size === "lg" ? "h-16" : "h-14",
        surfaceClass[intent],
        className
      )}
      {...props}
    >
      {loading ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-current/15">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        </span>
      ) : Icon ? (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-current/15">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col">
        <Bi
          k={labelKey}
          label={label}
          className="text-base leading-tight [&>span:last-child]:text-current [&>span:last-child]:opacity-75"
        />
        {sublabelKey || sublabel ? (
          <Bi
            k={sublabelKey}
            label={sublabel}
            className="text-xs font-normal opacity-80"
          />
        ) : null}
      </span>

      {amount !== undefined ? (
        <Money value={amount} size="row" className="shrink-0" />
      ) : null}
    </button>
  )
}

export { ActionButton }
