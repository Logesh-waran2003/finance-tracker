'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ReconRow {
  id: string
  date: string
  cash_collected: string
  cash_submitted: string
  difference: string | null
  status: string
  notes: string | null
  verified_at: Date | string | null
  rejection_reason: string | null
}

const STATUS_COLOR: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-500',
  SUBMITTED: 'bg-yellow-100 text-yellow-700',
  VERIFIED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
}

export function ReconciliationClient({ initial, todayCash, todaySubmitted }: {
  initial: ReconRow[]
  todayCash: number
  todaySubmitted: number
}) {
  const [rows, setRows] = useState<ReconRow[]>(initial)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()),
    cash_collected: String(todayCash),
    cash_submitted: '',
    notes: '',
  })

  const pendingHandover = todayCash - todaySubmitted

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.cash_submitted || parseFloat(form.cash_submitted) < 0) {
      toast.error('Enter a valid submitted amount'); return
    }
    setSaving(true)
    const res = await fetch('/api/reconciliation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        cash_collected: parseFloat(form.cash_collected),
        cash_submitted: parseFloat(form.cash_submitted),
        notes: form.notes || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to submit'); setSaving(false); return }
    setRows(prev => [data, ...prev])
    toast.success('Reconciliation submitted')
    setForm(f => ({ ...f, cash_submitted: '', notes: '' }))
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">Cash Reconciliation</h1>

      {/* Today's summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Confirmed Cash</p><p className="font-semibold text-gray-800">₹{todayCash.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Already Submitted</p><p className="font-semibold text-gray-800">₹{todaySubmitted.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Pending Handover</p><p className={`font-semibold ${pendingHandover > 0 ? 'text-orange-600' : 'text-green-600'}`}>₹{pendingHandover.toLocaleString()}</p></CardContent></Card>
      </div>

      {/* Submit form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Submit Cash Handover</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Cash Collected (₹)</Label>
                <Input type="number" min="0" step="0.01" value={form.cash_collected}
                  onChange={e => setForm(f => ({ ...f, cash_collected: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Cash Submitted (₹) *</Label>
                <Input type="number" min="0" step="0.01" value={form.cash_submitted}
                  onChange={e => setForm(f => ({ ...f, cash_submitted: e.target.value }))}
                  placeholder="Amount handing over now" />
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            {form.cash_submitted && (
              <p className="text-sm text-gray-600">
                Difference: <span className={parseFloat(form.cash_collected) - parseFloat(form.cash_submitted) === 0 ? 'text-green-600' : 'text-orange-600'}>
                  ₹{(parseFloat(form.cash_collected || '0') - parseFloat(form.cash_submitted || '0')).toLocaleString()}
                </span>
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Submit Handover
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader><CardTitle className="text-base">History</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Date', 'Collected', 'Submitted', 'Difference', 'Status'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No reconciliations yet</td></tr>}
              {rows.map(r => {
                const diff = parseFloat(r.difference ?? '0')
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{r.date}</td>
                    <td className="px-4 py-2 font-medium">₹{parseFloat(r.cash_collected).toLocaleString()}</td>
                    <td className="px-4 py-2">₹{parseFloat(r.cash_submitted).toLocaleString()}</td>
                    <td className={`px-4 py-2 font-medium ${diff === 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                      ₹{Math.abs(diff).toLocaleString()}{diff !== 0 && (diff < 0 ? ' (short)' : ' (excess)')}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>
                        {r.status}
                      </span>
                      {r.rejection_reason && <p className="text-xs text-red-500 mt-0.5">{r.rejection_reason}</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
