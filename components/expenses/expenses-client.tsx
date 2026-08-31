'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ExpenseRow {
  id: string
  category_name: string | null
  amount: string
  payment_mode: string
  description: string
  expense_date: string
  status: string
  rejection_reason: string | null
}

interface Category { id: string; name: string }

const STATUS_COLOR: Record<string, string> = {
  PENDING:  'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']

export function ExpensesClient({ initial, categories }: { initial: ExpenseRow[]; categories: Category[] }) {
  const [rows, setRows] = useState<ExpenseRow[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  // One key per dialog open, not per tap — a retry after a timeout must reuse
  // it or the server records the expense twice. Same contract as collections.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    payment_mode: 'CASH',
    description: '',
    expense_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
  })

  function openDialog() {
    setForm({
      category_id: '',
      amount: '',
      payment_mode: 'CASH',
      description: '',
      expense_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    })
    setIdempotencyKey(crypto.randomUUID())  // new expense => new key
    setDialogOpen(true)
  }

  async function handleSubmit() {
    if (!form.category_id || !form.amount || !form.expense_date) {
      toast.error('Category, amount, and date are required'); return
    }
    if (parseFloat(form.amount) <= 0) { toast.error('Amount must be greater than 0'); return }

    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount), idempotency_key: idempotencyKey }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to submit'); setSaving(false); return }

    const cat = categories.find(c => c.id === form.category_id)
    setRows(prev => [{ ...data, category_name: cat?.name ?? null }, ...prev])
    toast.success('Expense submitted')
    setDialogOpen(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== id))
      toast.success('Expense deleted')
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Failed to delete')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Office Expenses</h1>
        <Button size="sm" onClick={openDialog}><Plus size={16} className="mr-1" />Add Expense</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Date', 'Category', 'Description', 'Amount', 'Mode', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No expenses yet</td></tr>}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{r.expense_date}</td>
                    <td className="px-4 py-2 text-gray-600">{r.category_name ?? '—'}</td>
                    <td className="px-4 py-2">{r.description}</td>
                    <td className="px-4 py-2 font-medium">₹{parseFloat(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-500">{r.payment_mode}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>
                        {r.status}
                      </span>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{r.rejection_reason}</p>}
                    </td>
                    <td className="px-4 py-2">
                      {r.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600"
                          onClick={() => handleDelete(r.id)}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sm:hidden space-y-3 p-3">
            {rows.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No expenses yet</p>}
            {rows.map(r => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.category_name ?? '—'}</p>
                      <p className="text-xs text-gray-500">{r.expense_date}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
                  </div>
                  <p className="text-sm text-gray-700">{r.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-3 text-sm">
                      <span className="font-medium">₹{parseFloat(r.amount).toLocaleString()}</span>
                      <span className="text-gray-500">{r.payment_mode}</span>
                    </div>
                    {r.status === 'PENDING' && (
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 w-7 p-0" onClick={() => handleDelete(r.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                  {r.rejection_reason && <p className="text-xs text-red-500">{r.rejection_reason}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-xl p-4">
          <DialogTitle className="font-semibold">Add Expense</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Category *</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v || '' }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (₹) *</Label>
                <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input type="date" value={form.expense_date}
                  onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment Mode</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(f => ({ ...f, payment_mode: v || 'CASH' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What was this expense for?" />
            </div>
          </div>
          <div className="flex gap-2 pt-3">
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Submit
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
