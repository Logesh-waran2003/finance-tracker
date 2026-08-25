'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus } from 'lucide-react'

interface FormState {
  invoice_number: string
  reference: string
  amount: string
  due_date: string
  notes: string
  penalty_rate: string
}

const emptyForm: FormState = {
  invoice_number: '', reference: '', amount: '', due_date: '', notes: '', penalty_rate: '0',
}

export function AddDueDialog({ customerId }: { customerId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function field<K extends keyof FormState>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function save() {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      setErr('Amount must be a positive number')
      return
    }
    setSaving(true); setErr('')

    const res = await fetch('/api/admin/dues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        invoice_number: form.invoice_number || null,
        reference: form.reference || null,
        amount: form.amount,
        due_date: form.due_date || null,
        notes: form.notes || null,
        penalty_rate: parseFloat(form.penalty_rate) || 0,
      }),
    })

    const data = await res.json()
    if (!res.ok) { setErr(data.error ?? 'Failed to create due'); setSaving(false); return }

    setOpen(false)
    setForm(emptyForm)
    setSaving(false)
    router.refresh()
  }

  return (
    <>
      <Button size="sm" onClick={() => { setForm(emptyForm); setErr(''); setOpen(true) }}>
        <Plus size={16} className="mr-1" />Add Due
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-semibold text-lg">Add Due</DialogTitle>
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Amount *</Label>
              <Input type="number" step="0.01" placeholder="0.00" value={form.amount} onChange={e => field('amount', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => field('due_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Penalty Rate (% / month)</Label>
              <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" value={form.penalty_rate} onChange={e => field('penalty_rate', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Invoice Number</Label>
              <Input value={form.invoice_number} onChange={e => field('invoice_number', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={form.reference} onChange={e => field('reference', e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => field('notes', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Due'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
