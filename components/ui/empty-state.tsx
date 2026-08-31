import * as React from "react"
import { Inbox, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Bi } from "@/components/ui/bi"
import type { Label, LabelKey } from "@/lib/i18n"

export interface EmptyStateProps {
  icon?: LucideIcon
  titleKey?: LabelKey
  title?: Label
  descriptionKey?: LabelKey
  description?: Label
  /** Usually an <ActionButton> or a <Button>. */
  action?: React.ReactNode
  className?: string
}

/** Shown wherever a list has no rows. Never leave a blank panel. */
function EmptyState({
  icon: Icon = Inbox,
  titleKey = "noDataYet",
  title,
  descriptionKey,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <Bi
        k={title ? undefined : titleKey}
        label={title}
        className="text-base font-semibold"
      />
      {descriptionKey || description ? (
        <Bi
          k={descriptionKey}
          label={description}
          className="max-w-xs text-sm text-muted-foreground"
        />
      ) : null}
      {action ? <div className="mt-2 w-full max-w-xs">{action}</div> : null}
    </div>
  )
}

export { EmptyState }
