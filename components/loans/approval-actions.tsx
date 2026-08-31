'use client'

/**
 * The approve / reject interaction, defined ONCE.
 *
 * It repeats on three screens — loan requests, collection approval and the
 * payments tab of a loan — and those three had drifted apart: different button
 * sizes, different colours, one of them 28px tall, and a reject that captured
 * no reason. Everything to do with that interaction lives here so the three
 * screens cannot drift again.
 *
 * The rules it encodes:
 * - Approve and reject are large coloured icon-led buttons, never a text link.
 * - An approve moves real money, so it always needs a second, deliberate tap
 *   in a dialog that shows the amount as <Money size="stat">.
 * - A reject always captures a written reason in a real <FormField>.
 * - No window.confirm / window.prompt: a native dialog blocks the page and is
 *   hostile on a phone.
 */

import * as React from 'react'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Money } from '@/components/ui/money'
import { Textarea } from '@/components/ui/textarea'
import { labels, type LabelKey } from '@/lib/i18n'

export interface ApprovalActionsProps {
  onApprove: () => void
  onReject: () => void
  disabled?: boolean
  /** Approve label. Defaults to "Approve". */
  approveKey?: LabelKey
  /** Reject label. Defaults to "Reject". */
  rejectKey?: LabelKey
}

/**
 * The two buttons at the foot of a queue card.
 * Full width and stacked on a phone, inline from `md:`.
 */
export function ApprovalActions({
  onApprove,
  onReject,
  disabled,
  approveKey = 'approve',
  rejectKey = 'reject',
}: ApprovalActionsProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:justify-end">
      <Button
        variant="success"
        size="lg"
        disabled={disabled}
        onClick={onApprove}
        className="w-full md:w-auto"
      >
        <CheckCircle2 />
        <Bi k={approveKey} />
      </Button>
      <Button
        variant="destructive"
        size="lg"
        disabled={disabled}
        onClick={onReject}
        className="w-full md:w-auto"
      >
        <XCircle />
        <Bi k={rejectKey} />
      </Button>
    </div>
  )
}

interface ConfirmBodyProps {
  amount: string | number
  headline: string
  meta?: React.ReactNode
}

/** Amount first and biggest, then who it belongs to. */
function ConfirmBody({ amount, headline, meta }: ConfirmBodyProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 p-4">
      <Money value={amount} size="stat" intent="neutral" />
      <p className="text-sm font-medium">{headline}</p>
      {meta ? <div className="text-xs text-muted-foreground">{meta}</div> : null}
    </div>
  )
}

export interface ApproveDialogProps extends ConfirmBodyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey: LabelKey
  descriptionKey: LabelKey
  loading?: boolean
  onConfirm: () => void
}

/** Second tap before money moves. The amount is shown before anything is sent. */
export function ApproveDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  amount,
  headline,
  meta,
  loading,
  onConfirm,
}: ApproveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Bi k={titleKey} />
          </DialogTitle>
          <DialogDescription>
            <Bi k={descriptionKey} />
          </DialogDescription>
        </DialogHeader>

        <ConfirmBody amount={amount} headline={headline} meta={meta} />

        <p className="text-sm text-warning-muted-foreground">
          <Bi k="moneyMovesWarning" />
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            <Bi k="cancel" />
          </Button>
          <Button variant="success" size="lg" disabled={loading} onClick={onConfirm}>
            {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            <Bi k={loading ? 'saving' : 'approve'} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface RejectDialogProps extends ConfirmBodyProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleKey: LabelKey
  descriptionKey: LabelKey
  /** Unique id so the label points at this textarea. */
  fieldId: string
  reason: string
  onReasonChange: (value: string) => void
  loading?: boolean
  onConfirm: () => void
}

/** A reject always captures a written reason. The agent reads it. */
export function RejectDialog({
  open,
  onOpenChange,
  titleKey,
  descriptionKey,
  fieldId,
  amount,
  headline,
  meta,
  reason,
  onReasonChange,
  loading,
  onConfirm,
}: RejectDialogProps) {
  const empty = reason.trim().length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Bi k={titleKey} />
          </DialogTitle>
          <DialogDescription>
            <Bi k={descriptionKey} />
          </DialogDescription>
        </DialogHeader>

        <ConfirmBody amount={amount} headline={headline} meta={meta} />

        <FormField
          labelKey="reason"
          htmlFor={fieldId}
          required
          hint={labels.reasonVisibleToAgent.en}
        >
          <Textarea
            id={fieldId}
            rows={3}
            className="resize-none"
            placeholder={labels.enterReason.en}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </FormField>

        <DialogFooter>
          <Button
            variant="outline"
            size="lg"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            <Bi k="cancel" />
          </Button>
          <Button
            variant="destructive"
            size="lg"
            disabled={loading || empty}
            onClick={onConfirm}
          >
            {loading ? <Loader2 className="animate-spin" /> : <XCircle />}
            <Bi k={loading ? 'saving' : 'reject'} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
