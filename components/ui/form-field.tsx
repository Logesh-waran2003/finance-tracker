"use client"

import * as React from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import { Bi } from "@/components/ui/bi"
import { Label as UiLabel } from "@/components/ui/label"
import type { Label, LabelKey } from "@/lib/i18n"

export interface FormFieldProps {
  /** Label key from `lib/i18n.ts`. */
  labelKey?: LabelKey
  /** Escape hatch for a dynamic label. */
  label?: Label
  /** id of the control, so the label points at it. */
  htmlFor?: string
  required?: boolean
  /** Error text. Bilingual where possible; a plain string is accepted. */
  error?: string | Label | null
  /** Muted helper line under the control. */
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/** Bilingual label + a 56px control row + an error line. */
function FormField({
  labelKey,
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  const errorLabel: Label | null =
    typeof error === "string" ? { en: error } : (error ?? null)

  return (
    <div data-slot="form-field" className={cn("flex flex-col gap-2", className)}>
      {labelKey || label ? (
        <UiLabel htmlFor={htmlFor} className="items-start">
          <Bi k={labelKey} label={label} />
          {required ? (
            <span aria-hidden="true" className="text-danger">
              *
            </span>
          ) : null}
        </UiLabel>
      ) : null}

      {children}

      {hint && !errorLabel ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}

      {errorLabel ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 text-sm text-danger"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <Bi label={errorLabel} className="[&_span]:text-current" />
        </p>
      ) : null}
    </div>
  )
}

export { FormField }
