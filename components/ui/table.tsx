"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Desktop half of `<DataList>`. On a phone the DataList renders cards instead,
 * so this table never has to scroll sideways.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full">
      <table
        data-slot="table"
        className={cn("w-full table-auto caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "sticky top-0 z-10 bg-card [&_tr]:border-b",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

type CellAlign = "left" | "center" | "right"

const alignClass: Record<CellAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
}

function TableHead({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"th">, "align"> & { align?: CellAlign }) {
  return (
    <th
      data-slot="table-head"
      data-align={align}
      className={cn(
        "h-12 px-3 align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        alignClass[align],
        className
      )}
      {...props}
    />
  )
}

/** `align="right"` also turns on tabular figures — use it for every money column. */
function TableCell({
  className,
  align = "left",
  ...props
}: Omit<React.ComponentProps<"td">, "align"> & { align?: CellAlign }) {
  return (
    <td
      data-slot="table-cell"
      data-align={align}
      className={cn(
        "h-12 px-3 align-middle [&:has([role=checkbox])]:pr-0",
        alignClass[align],
        align === "right" && "tabular",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
export type { CellAlign }
