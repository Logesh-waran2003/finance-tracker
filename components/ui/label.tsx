"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Bilingual-friendly label. `text-base` on phone so Tamil stays readable. */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-base leading-tight font-medium select-none md:text-sm group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
