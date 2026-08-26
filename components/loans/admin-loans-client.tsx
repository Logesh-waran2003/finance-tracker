'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  OVERDUE: 'bg-red-100 text-red-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  DRAFT: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
  MISSED: 'bg-red-100 text-red-700',
}

function fmt(n: number | string) {
  const v = typeof n === 'string' ? parseFloat(n) : n
  return `₹${(isNaN(v) ? 0 : v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Loan {
  id: string
  loan_number: string
  customer_name: string | null
  assigned_agent_name: string | null
  loan_amount: string
  disbursed_amount: string
  daily_installment: string
  principal_outstanding: string
  penalty_outstanding: string
  total_outstanding: string
  status: string
  disbursement_date: string
}

interface Customer {
  id: string
  full_name: string
  customer_code: string
}

interface Agent {
  id: string
  full_name: string
  employee_code: string | null
}

interface Props {
  loans: Loan[]
  customers: Customer[]
  agents: Agent[]
}

interface FormState {
  customer_id: string
  agent_id: string
  loan_amount: string
  interest_pct: string
  daily_installment: string
  penalty_amount: string
  disbursement_date: string
  notes: string
}

const EMPTY_FORM: FormState = {
  customer_id: '',
  agent_id: '',
  loan_amount: '',
  interest_pct: '',
  daily_installment: '',
  penalty_amount: '0',
  disbursement_date: '',
  notes: '',
}

export function AdminLoansClient({ loans: initialLoans, customers, agents }: Props) {
  const [loans, setLoans] = useState<Loan[]>(initialLoans)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [agentFilter, setAgentFilter] = useState('ALL')

  // Derived summary values
  const totalLoans = loans.length
  const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'OVERDUE').length
  const totalLoanAmount = loans.reduce((sum, l) => sum + parseFloat(l.loan_amount || '0'), 0)
  const totalPrincipalOs = loans.reduce((sum, l) => sum + parseFloat(l.principal_outstanding || '0'), 0)

  // Computed interest preview
  const loanAmt = parseFloat(form.loan_amount) || 0
  const interestPct = parseFloat(form.interest_pct) || 0
  const interestAmt = loanAmt * interestPct / 100
  const disbursedAmt = loanAmt - interestAmt
  const showInterestPreview = loanAmt > 0 && interestPct > 0

  // Filtered loans
  const filtered = loans.filter(l => {
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      (l.customer_name ?? '').toLowerCase().includes(q) ||
      l.loan_number.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'ALL' || l.status === statusFilter
    const matchesAgent =
      agentFilter === 'ALL' ||
      (l.assigned_agent_name &&
        agents.find(a => a.id === agentFilter)?.full_name === l.assigned_agent_name)
    return matchesSearch && matchesStatus && matchesAgent
  })

  function handleClose() {
    setDialogOpen(false)
    setForm(EMPTY_FORM)
  }

  function setField(key: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: form.customer_id,
          assigned_agent_id: form.agent_id || undefined,
          loan_amount: parseFloat(form.loan_amount),
          interest_percentage: parseFloat(form.interest_pct) || 0,
          daily_installment: parseFloat(form.daily_installment),
          penalty_amount: parseFloat(form.penalty_amount) || 0,
          disbursement_date: form.disbursement_date,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create loan')
        return
      }
      toast.success('Loan created')
      setLoans(prev => [data, ...prev])
      handleClose()
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Button variant="default" onClick={() => setDialogOpen(true)}>
          Create Loan
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLoans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeLoans}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Loan Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalLoanAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Principal Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalPrincipalOs)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search customer / loan #"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={v => v !== null && setStatusFilter(v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
            <SelectItem value="OVERDUE">OVERDUE</SelectItem>
            <SelectItem value="COMPLETED">COMPLETED</SelectItem>
            <SelectItem value="CANCELLED">CANCELLED</SelectItem>
            <SelectItem value="DRAFT">DRAFT</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={v => v !== null && setAgentFilter(v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Agents</SelectItem>
            {agents.map(a => (
              <SelectItem key={a.id} value={a.id}>
                {a.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Loan Amt</TableHead>
                <TableHead>Disbursed</TableHead>
                <TableHead>Daily Inst.</TableHead>
                <TableHead>Principal O/S</TableHead>
                <TableHead>Penalty O/S</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-gray-500 py-8">
                    No loans found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(row => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.loan_number}</TableCell>
                    <TableCell>{row.customer_name ?? '—'}</TableCell>
                    <TableCell>{row.assigned_agent_name ?? '—'}</TableCell>
                    <TableCell>{fmt(row.loan_amount)}</TableCell>
                    <TableCell>{fmt(row.disbursed_amount)}</TableCell>
                    <TableCell>{fmt(row.daily_installment)}</TableCell>
                    <TableCell>{fmt(row.principal_outstanding)}</TableCell>
                    <TableCell>{fmt(row.penalty_outstanding)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          STATUS_COLOR[row.status] ?? 'bg-gray-100',
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link href={'/admin/loans/' + row.id}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Create Loan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) handleClose() }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Loan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Customer */}
            <div className="space-y-1">
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={v => v !== null && setField('customer_id', v)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} ({c.customer_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agent */}
            <div className="space-y-1">
              <Label>Agent</Label>
              <Select value={form.agent_id} onValueChange={v => v !== null && setField('agent_id', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Loan Amount + Interest in 2 cols */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Loan Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.loan_amount}
                  onChange={e => setField('loan_amount', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Interest %</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0.00"
                  value={form.interest_pct}
                  onChange={e => setField('interest_pct', e.target.value)}
                />
                {showInterestPreview && (
                  <p className="text-xs text-gray-500">
                    Interest: {fmt(interestAmt)} → Disbursed: {fmt(disbursedAmt)}
                  </p>
                )}
              </div>
            </div>

            {/* Daily Installment + Penalty in 2 cols */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Daily Installment</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.daily_installment}
                  onChange={e => setField('daily_installment', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Penalty Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.penalty_amount}
                  onChange={e => setField('penalty_amount', e.target.value)}
                />
              </div>
            </div>

            {/* Disbursement Date */}
            <div className="space-y-1">
              <Label>Disbursement Date</Label>
              <Input
                type="date"
                value={form.disbursement_date}
                onChange={e => setField('disbursement_date', e.target.value)}
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={2}
                placeholder="Any notes..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Loan'
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
