"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 overflow-y-auto overscroll-contain bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          // bottom / top sheets
          "data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:max-h-[90dvh] data-[side=bottom]:rounded-t-2xl data-[side=bottom]:border-t data-[side=bottom]:pb-[env(safe-area-inset-bottom)] data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem]",
          "data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:max-h-[90dvh] data-[side=top]:rounded-b-2xl data-[side=top]:border-b data-[side=top]:pt-[env(safe-area-inset-top)] data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem]",
          // side sheets on desktop
          "md:data-[side=left]:inset-y-0 md:data-[side=left]:left-0 md:data-[side=left]:h-full md:data-[side=left]:w-3/4 md:data-[side=left]:max-w-sm md:data-[side=left]:rounded-none md:data-[side=left]:border-r md:data-[side=left]:data-ending-style:translate-x-[-2.5rem] md:data-[side=left]:data-starting-style:translate-x-[-2.5rem]",
          "md:data-[side=right]:inset-y-0 md:data-[side=right]:right-0 md:data-[side=right]:h-full md:data-[side=right]:w-3/4 md:data-[side=right]:max-w-sm md:data-[side=right]:rounded-none md:data-[side=right]:border-l md:data-[side=right]:data-ending-style:translate-x-[2.5rem] md:data-[side=right]:data-starting-style:translate-x-[2.5rem]",
          // PHONE: a left/right sheet is a bottom sheet instead — no side drawers on a phone.
          "max-md:data-[side=left]:inset-x-0 max-md:data-[side=left]:bottom-0 max-md:data-[side=left]:h-auto max-md:data-[side=left]:max-h-[90dvh] max-md:data-[side=left]:w-full max-md:data-[side=left]:rounded-t-2xl max-md:data-[side=left]:border-t max-md:data-[side=left]:pb-[env(safe-area-inset-bottom)] max-md:data-[side=left]:data-ending-style:translate-y-[2.5rem] max-md:data-[side=left]:data-starting-style:translate-y-[2.5rem]",
          "max-md:data-[side=right]:inset-x-0 max-md:data-[side=right]:bottom-0 max-md:data-[side=right]:h-auto max-md:data-[side=right]:max-h-[90dvh] max-md:data-[side=right]:w-full max-md:data-[side=right]:rounded-t-2xl max-md:data-[side=right]:border-t max-md:data-[side=right]:pb-[env(safe-area-inset-bottom)] max-md:data-[side=right]:data-ending-style:translate-y-[2.5rem] max-md:data-[side=right]:data-starting-style:translate-y-[2.5rem]",
          className
        )}
        {...props}
      >
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden"
        />
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-4 [&>*]:w-full md:flex-row md:justify-end md:[&>*]:w-auto", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading pr-10 text-lg leading-snug font-semibold text-foreground md:text-base",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
