import * as React from "react"

import { cn } from "@/lib/utils"
import { formatMoney, moneySign } from "@/lib/format"

export type MoneySize = "hero" | "stat" | "row" | "caption"
export type MoneyIntent = "in" | "out" | "owed" | "neutral" | "auto"

const sizeClass: Record<MoneySize, string> = {
  hero: "text-5xl font-bold leading-none tracking-tight",
  stat: "text-3xl font-bold leading-none",
  row: "text-base font-semibold leading-tight",
  caption: "text-sm font-normal leading-tight",
}

const intentClass: Record<Exclude<MoneyIntent, "auto">, string> = {
  in: "text-success",
  out: "text-danger",
  /**
   * Money a customer still owes. Deliberately NOT green: green means "money
   * collected / good", and an outstanding balance rendered green told an agent
   * that a ₹12,000 debt was a positive. Amber = "needs action", which is what
   * an outstanding balance actually is.
   */
  owed: "text-warning-muted-foreground",
  neutral: "",
}

export interface MoneyProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Drizzle `numeric` values arrive as strings — pass the string straight through. */
  value: string | number
  size?: MoneySize
  intent?: MoneyIntent
  /** ₹1.2L / ₹3.4Cr / ₹12.5k */
  compact?: boolean
  /** Show paise. Off by default. */
  decimals?: boolean
}

/**
 * Every rupee amount in the app renders through this.
 * Indian lakh/crore grouping, always tabular figures.
 */
function Money({
  value,
  size = "row",
  intent = "neutral",
  compact,
  decimals,
  className,
  ...props
}: MoneyProps) {
  const resolved: Exclude<MoneyIntent, "auto"> =
    intent === "auto"
      ? moneySign(value) < 0
        ? "out"
        : moneySign(value) > 0
          ? "in"
          : "neutral"
      : intent

  const text = formatMoney(value, { compact, decimals })

  return (
    <span
      data-slot="money"
      data-intent={resolved}
      className={cn(
        "tabular whitespace-nowrap",
        sizeClass[size],
        intentClass[resolved],
        size === "caption" && resolved === "neutral" && "text-muted-foreground",
        className
      )}
      {...props}
    >
      {text}
    </span>
  )
}

export { Money }
