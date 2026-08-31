'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { ActionButton } from '@/components/ui/action-button'
import { Bi } from '@/components/ui/bi'
import { apiPatch } from '@/lib/api-client'
import { toNumber } from '@/lib/format'
import { t } from '@/lib/i18n'

interface Due {
  id: string
  invoice_number: string | null
  due_date: string | null
  penalty_rate: string | null
  notes: string | null
}

interface DueResponse {
  id: string
}

function initialForm(due: Due) {
  return {
    due_date: due.due_date ?? '',
    penalty_rate: due.penalty_rate ? String(toNumber(due.penalty_rate)) : '0',
    notes: due.notes ?? '',
  }
}

export function EditDueDialog({ due }: { due: Due }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => initialForm(due))
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setErr(null)
    const res = await apiPatch<DueResponse>(`/api/admin/dues/${due.id}`, {
      due_date: form.due_date || null,
      penalty_rate: toNumber(form.penalty_rate),
      notes: form.notes || null,
    })
    if (!res.ok) {
      setErr(res.error)
      setSaving(false)
      return
    }
    toast.success(t('dueUpdated').en)
    setOpen(false)
    setSaving(false)
    router.refresh()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('editDue').en}
        onClick={() => {
          setForm(initialForm(due))
          setErr(null)
          setOpen(true)
        }}
      >
        <Pencil />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="text-lg font-semibold">
            <Bi k="editDue" />
          </DialogTitle>
          {due.invoice_number ? (
            <p className="text-sm text-muted-foreground">{due.invoice_number}</p>
          ) : null}

          <FormField labelKey="dueDate" htmlFor={`edit-due-date-${due.id}`} error={err}>
            <Input
              id={`edit-due-date-${due.id}`}
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            />
          </FormField>

          <FormField labelKey="penaltyRatePerMonth" htmlFor={`edit-due-penalty-${due.id}`}>
            <Input
              id={`edit-due-penalty-${due.id}`}
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0"
              value={form.penalty_rate}
              onChange={e =>
                setForm(f => ({ ...f, penalty_rate: e.target.value.replace(/[^\d.]/g, '') }))
              }
            />
          </FormField>

          <FormField labelKey="notesOptional" htmlFor={`edit-due-notes-${due.id}`}>
            <Input
              id={`edit-due-notes-${due.id}`}
              enterKeyHint="done"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </FormField>

          <ActionButton
            size="lg"
            icon={Save}
            labelKey="save"
            loading={saving}
            onClick={save}
            className="shrink-0 md:w-full"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
