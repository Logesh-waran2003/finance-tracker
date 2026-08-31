"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { labels, type Label, type LabelKey } from "@/lib/i18n"

export interface PageHeaderProps {
  titleKey?: LabelKey
  title?: Label
  /** Optional muted line under the title. */
  subtitle?: React.ReactNode
  /** Right-hand action — one button, no more. */
  action?: React.ReactNode
  /** Shows a back button that calls router.back(), or navigates to `backHref`. */
  back?: boolean
  backHref?: string
  /** Sticks under the 56px top bar on a phone. Default true. */
  sticky?: boolean
  className?: string
}

/**
 * Screen title + one action.
 *
 * The title renders ONLY from `md:` up. On a phone the app-shell top bar
 * already shows the screen name, and rendering it here too put the same words
 * on screen twice, one under the other. The action and back button render at
 * every width, so a phone gets just those.
 */
function PageHeader({
  titleKey,
  title,
  subtitle,
  action,
  back,
  backHref,
  sticky = true,
  className,
}: PageHeaderProps) {
  const router = useRouter()
  const value: Label | undefined = title ?? (titleKey ? labels[titleKey] : undefined)

  return (
    <header
      data-slot="page-header"
      className={cn(
        "flex items-center gap-3 bg-background md:items-start md:border-b md:border-border md:py-4",
        sticky && "md:static",
        className
      )}
    >
      {back ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          className="-ml-2 shrink-0"
          onClick={() => (backHref ? router.push(backHref) : router.back())}
        >
          <ChevronLeft />
        </Button>
      ) : null}

      <div className="min-w-0 flex-1">
        {value ? (
          <h1 className="hidden truncate text-2xl leading-tight font-bold md:block">
            {value.en}
          </h1>
        ) : null}
        {subtitle ? (
          <div className="text-sm text-muted-foreground md:mt-1">{subtitle}</div>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

export { PageHeader }
