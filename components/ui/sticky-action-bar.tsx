import * as React from "react"

import { cn } from "@/lib/utils"

export interface StickyActionBarProps extends React.ComponentProps<"div"> {
  /**
   * Sit above the 64px bottom tab bar on a phone. Default true.
   * Set false inside a dialog or on a screen with no tab bar.
   */
  aboveTabBar?: boolean
}

/**
 * Holds the primary submit. Fixed to the bottom on a phone, inline from `md:`.
 *
 * It renders its own in-flow spacer, so a screen using this needs NO extra
 * bottom padding. Screens previously each added their own `pb-40` on top of
 * the shell's `pb-24`, which stacked to ~256px of dead space and made short
 * screens scroll for no reason.
 */
function StickyActionBar({
  aboveTabBar = true,
  className,
  children,
  ...props
}: StickyActionBarProps) {
  return (
    <>
      {/* Reserves the height the fixed bar occupies. Phone only — from md: the
          bar is in normal flow and takes its own space. */}
      <div aria-hidden="true" className="h-20 shrink-0 md:hidden" />
      <div
      data-slot="sticky-action-bar"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card p-3 pb-safe md:static md:border-0 md:bg-transparent md:p-0",
        aboveTabBar &&
          "bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-auto",
        className
      )}
      {...props}
    >
      <div className="flex flex-col gap-2 md:flex-row md:justify-end">
        {children}
      </div>
      </div>
    </>
  )
}

export { StickyActionBar }
