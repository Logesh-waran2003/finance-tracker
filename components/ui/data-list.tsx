"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type CellAlign,
} from "@/components/ui/table"

export interface DataListColumn<T> {
  /** Stable id for the column. */
  key: string
  /** Header node — normally a <Bi k="…" />. */
  header: React.ReactNode
  /** Cell renderer. */
  cell: (item: T, index: number) => React.ReactNode
  align?: CellAlign
  /** Leave the column out of the phone card. Default false. */
  hideOnMobile?: boolean
  /** Use this column as the card's headline (first column by default). */
  primary?: boolean
  className?: string
}

export interface DataListProps<T> {
  items: readonly T[]
  getKey: (item: T, index: number) => string
  columns: readonly DataListColumn<T>[]
  /** Full control over the phone card. Omit for a card derived from `columns`. */
  renderCard?: (item: T, index: number) => React.ReactNode
  onRowClick?: (item: T, index: number) => void
  /** Shown when there are no items. Defaults to a generic <EmptyState>. */
  empty?: React.ReactNode
  loading?: boolean
  /** Skeleton rows while loading. Default 4. */
  skeletonRows?: number
  className?: string
}

function DataListSkeleton({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex min-h-14 flex-col gap-2 rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-6 w-1/3" />
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-3">
              {Array.from({ length: columns }).map((__, j) => (
                <Skeleton key={j} className="h-6 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

/**
 * One definition, two layouts.
 *
 * - phone: a vertical stack of tappable cards (never a sideways-scrolling table)
 * - `md:` and up: the standard <Table>
 */
function DataList<T>({
  items,
  getKey,
  columns,
  renderCard,
  onRowClick,
  empty,
  loading,
  skeletonRows = 4,
  className,
}: DataListProps<T>) {
  if (loading) {
    return (
      <div data-slot="data-list" className={className}>
        <DataListSkeleton rows={skeletonRows} columns={Math.min(columns.length, 4)} />
      </div>
    )
  }

  if (items.length === 0) {
    // flex-1 + centring: an empty list is usually the last thing on a short
    // screen, and left in normal flow it sat at the top of several hundred
    // pixels of blank space, which reads as a broken layout rather than an
    // intentional empty state.
    return (
      <div
        data-slot="data-list"
        className={cn("flex flex-1 items-center justify-center", className)}
      >
        {empty ?? <EmptyState />}
      </div>
    )
  }

  const mobileColumns = columns.filter((c) => !c.hideOnMobile)
  const headline =
    mobileColumns.find((c) => c.primary) ?? mobileColumns[0] ?? columns[0]
  const rest = mobileColumns.filter((c) => c.key !== headline?.key)
  const trailing = rest.find((c) => c.align === "right")
  const details = rest.filter((c) => c.key !== trailing?.key)

  const defaultCard = (item: T, index: number) => (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 font-medium">
          {headline?.cell(item, index)}
        </div>
        {trailing ? (
          <div className="shrink-0 text-right">{trailing.cell(item, index)}</div>
        ) : null}
      </div>
      {details.length > 0 ? (
        <dl className="mt-2 flex flex-col gap-1.5">
          {details.map((column) => (
            <div
              key={column.key}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <dt className="min-w-0 text-muted-foreground">{column.header}</dt>
              <dd className="min-w-0 text-right">{column.cell(item, index)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </>
  )

  return (
    <div data-slot="data-list" className={className}>
      {/* PHONE — cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {items.map((item, index) => {
          const content = renderCard
            ? renderCard(item, index)
            : defaultCard(item, index)
          const cardClass = cn(
            "flex min-h-14 w-full items-center gap-2 rounded-xl border border-border bg-card p-4 text-left text-card-foreground",
            onRowClick &&
              "transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          )
          return (
            <li key={getKey(item, index)}>
              {onRowClick ? (
                <button
                  type="button"
                  className={cardClass}
                  onClick={() => onRowClick(item, index)}
                >
                  <span className="min-w-0 flex-1">{content}</span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </button>
              ) : (
                <div className={cardClass}>
                  <div className="min-w-0 flex-1">{content}</div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {/* DESKTOP — table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  align={column.align}
                  className={column.className}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow
                key={getKey(item, index)}
                onClick={onRowClick ? () => onRowClick(item, index) : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
              >
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    align={column.align}
                    className={column.className}
                  >
                    {column.cell(item, index)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export { DataList }
