'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Pencil } from 'lucide-react'

interface Due {
  id: string
  invoice_number: string | null
  due_date: string | null
  penalty_rate: string | null
  notes: string | null
}

export function EditDueDialog({ due }: { due: Due }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    due_date: due.due_date ?? '',
    penalty_rate: due.penalty_rate ? parseFloat(due.penalty_rate).toString() : '0',
    notes: due.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setSaving(true); setErr('')
    const res = await fetch(`/api/admin/dues/${due.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        due_date: form.due_date || null,
        penalty_rate: parseFloat(form.penalty_rate) || 0,
        notes: form.notes || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Failed to update'); setSaving(false); return }
    setOpen(false)
    setSaving(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setForm({ due_date: due.due_date ?? '', penalty_rate: due.penalty_rate ? parseFloat(due.penalty_rate).toString() : '0', notes: due.notes ?? '' }); setErr(''); setOpen(true) }}>
        <Pencil size={13} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="font-semibold">Edit Due</DialogTitle>
          {due.invoice_number && <p className="text-sm text-gray-500">Invoice: {due.invoice_number}</p>}
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Penalty Rate (% / month)</Label>
              <Input type="number" step="0.01" min="0" max="100" value={form.penalty_rate} onChange={e => setForm(f => ({ ...f, penalty_rate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
