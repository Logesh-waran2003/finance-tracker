'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, MapPin, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Customer { id: string; customer_code: string; full_name: string; outstanding_total: string }
interface Due { id: string; invoice_number: string | null; outstanding_amount: string; status: string }
interface CollectionRow {
  id: string
  collection_number: string | null
  customer_name: string | null
  amount: string
  payment_mode: string
  status: string
  collected_at: string | null
  notes: string | null
  rejected_reason: string | null
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const PAYMENT_MODES = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']

function fmtDateTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function generateKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function CollectionForm({ customers, initial }: { customers: Customer[]; initial: CollectionRow[] }) {
  const [rows, setRows] = useState<CollectionRow[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [dues, setDues] = useState<Due[]>([])
  const [loadingDues, setLoadingDues] = useState(false)
  const [form, setForm] = useState({
    customer_id: '', due_id: '', amount: '', payment_mode: 'CASH',
    payment_reference: '', notes: '',
  })
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [gpsState, setGpsState] = useState<'idle' | 'acquiring' | 'ready' | 'denied'>('idle')

  // Summary
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
  const todayRows = rows.filter(r => r.collected_at && new Date(r.collected_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === today)
  const todayTotal = todayRows.filter(r => ['CONFIRMED', 'PENDING'].includes(r.status)).reduce((s, r) => s + parseFloat(r.amount), 0)
  const pendingTotal = todayRows.filter(r => r.status === 'PENDING').reduce((s, r) => s + parseFloat(r.amount), 0)
  const cashPending = todayRows.filter(r => r.status === 'CONFIRMED' && r.payment_mode === 'CASH').reduce((s, r) => s + parseFloat(r.amount), 0)

  async function loadDues(customerId: string) {
    setLoadingDues(true); setDues([])
    const res = await fetch(`/api/admin/dues?customer_id=${customerId}`)
    if (res.ok) {
      const data = await res.json()
      setDues(data.filter((d: Due) => d.status === 'OPEN' || d.status === 'PARTIALLY_PAID'))
    }
    setLoadingDues(false)
  }

  function openDialog() {
    setForm({ customer_id: '', due_id: '', amount: '', payment_mode: 'CASH', payment_reference: '', notes: '' })
    setDues([]); setSelectedCustomer(''); setGps(null); setGpsState('idle'); setDialogOpen(true)
  }

  const acquireGps = useCallback((): Promise<void> => {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(); return }
      setGpsState('acquiring')
      navigator.geolocation.getCurrentPosition(
        pos => { setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGpsState('ready'); resolve() },
        () => { setGpsState('denied'); resolve() },
        { timeout: 8000 }
      )
    })
  }, [])

  async function handleSubmit() {
    if (!form.customer_id || !form.amount || !form.payment_mode) { toast.error('Customer, amount, and payment mode are required'); return }
    if (parseFloat(form.amount) <= 0) { toast.error('Amount must be greater than 0'); return }

    setSaving(true)
    await acquireGps()

    const res = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        due_id: form.due_id || null,
        amount: parseFloat(form.amount),
        gps_lat: gps?.lat, gps_lng: gps?.lng, gps_accuracy: gps?.accuracy,
        idempotency_key: generateKey(),
      }),
    })

    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Failed to record'); setSaving(false); return }

    const customer = customers.find(c => c.id === form.customer_id)
    setRows(prev => [{ ...data, customer_name: customer?.full_name ?? null }, ...prev])
    toast.success(`Collection recorded — ${data.collection_number ?? 'pending number'}`)
    setDialogOpen(false); setSaving(false)
  }

  async function cancelCollection(id: string) {
    const res = await fetch(`/api/admin/collections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (res.ok) { setRows(prev => prev.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r)); toast.success('Cancelled') }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">My Collections</h1>
        <Button size="sm" onClick={openDialog}><Plus size={16} className="mr-1" />Record Collection</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Today's Total</p><p className="font-semibold text-gray-800">₹{todayTotal.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Pending</p><p className="font-semibold text-yellow-700">₹{pendingTotal.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-gray-500">Cash to Hand Over</p><p className="font-semibold text-orange-600">₹{cashPending.toLocaleString()}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="sm:hidden space-y-3 p-3">
            {rows.length === 0 && <p className="text-center text-gray-400 py-6 text-sm">No collections yet</p>}
            {rows.map(r => (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.customer_name ?? '—'}</p>
                      <p className="text-xs font-mono text-gray-400">{r.collection_number ?? '—'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">₹{parseFloat(r.amount).toLocaleString()}</span>
                    <span className="text-gray-500">{r.payment_mode}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">{fmtDateTime(r.collected_at)}</p>
                    {r.status === 'PENDING' && (
                      <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 px-2 text-xs" onClick={() => cancelCollection(r.id)}>
                        <XCircle size={13} className="mr-1" />Cancel
                      </Button>
                    )}
                  </div>
                  {r.rejected_reason && <p className="text-xs text-red-500">{r.rejected_reason}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['#', 'Customer', 'Amount', 'Mode', 'Status', 'Time', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No collections yet</td></tr>}
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400">{r.collection_number ?? '—'}</td>
                    <td className="px-4 py-2 font-medium">{r.customer_name ?? '—'}</td>
                    <td className="px-4 py-2 font-medium">₹{parseFloat(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-2 text-gray-600">{r.payment_mode}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100'}`}>{r.status}</span>
                      {r.rejected_reason && <p className="text-xs text-red-500 mt-0.5">{r.rejected_reason}</p>}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{fmtDateTime(r.collected_at)}</td>
                    <td className="px-4 py-2">
                      {r.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 text-xs" onClick={() => cancelCollection(r.id)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="font-semibold">Record Collection</DialogTitle>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={v => {
                const val = v || ''
                setForm(f => ({ ...f, customer_id: val, due_id: '' }))
                setSelectedCustomer(val)
                if (val) loadDues(val)
              }}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} ({c.customer_code})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.customer_id && (
              <div className="space-y-1">
                <Label>Due (optional)</Label>
                {loadingDues ? <p className="text-xs text-gray-500">Loading dues...</p> : (
                  <Select value={form.due_id || '_none'} onValueChange={v => {
                    const val = v === '_none' ? '' : (v || '')
                    const due = dues.find(d => d.id === val)
                    setForm(f => ({ ...f, due_id: val, amount: due ? String(parseFloat(due.outstanding_amount)) : f.amount }))
                  }}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None (general payment)</SelectItem>
                      {dues.map(d => <SelectItem key={d.id} value={d.id}>
                        {d.invoice_number ?? 'No invoice'} — ₹{parseFloat(d.outstanding_amount).toLocaleString()} outstanding
                      </SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label>Amount (₹) *</Label>
              <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>

            <div className="space-y-1">
              <Label>Payment Mode *</Label>
              <Select value={form.payment_mode} onValueChange={v => setForm(f => ({ ...f, payment_mode: v || 'CASH' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {form.payment_mode !== 'CASH' && (
              <div className="space-y-1">
                <Label>Payment Reference</Label>
                <Input value={form.payment_reference} onChange={e => setForm(f => ({ ...f, payment_reference: e.target.value }))} placeholder="UPI ref / cheque no / transaction ID" />
              </div>
            )}

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500">
              {gpsState === 'idle' && <span className="flex items-center gap-1"><MapPin size={12} /> GPS captured on submit</span>}
              {gpsState === 'acquiring' && <span className="flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Getting location...</span>}
              {gpsState === 'ready' && <span className="flex items-center gap-1 text-green-600"><MapPin size={12} /> Location captured</span>}
              {gpsState === 'denied' && <span className="flex items-center gap-1 text-gray-400"><XCircle size={12} /> Location unavailable</span>}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Recording...</> : 'Record Collection'}
            </Button>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
