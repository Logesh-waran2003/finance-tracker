'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface LoanRequestCustomer {
  request_id: string
  request_number: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  customer_id: string | null
  customer_name: string | null
  customer_code: string | null
  new_customer_name: string | null
  new_customer_phone: string | null
  new_customer_area: string | null
  loan_amount: string
  disbursement_date: string
  created_at: string | null
  outstanding_total: string | null
}

interface Props {
  initial: LoanRequestCustomer[]
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function fmt(n: string | number | null) {
  const v = parseFloat(String(n ?? '0'))
  return `₹${isNaN(v) ? 0 : v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function toIST(s: string | null): string {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AgentCustomersClient({ initial }: Props) {
  const [requestedDate, setRequestedDate] = useState('')
  const [disbursedDate, setDisbursedDate] = useState('')

  const filtered = initial.filter(r => {
    if (requestedDate && toIST(r.created_at) !== requestedDate) return false
    if (disbursedDate && r.disbursement_date !== disbursedDate) return false
    return true
  })

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">My Customers</h1>
      <p className="text-sm text-gray-500">{initial.length} loan request{initial.length !== 1 ? 's' : ''}</p>

      {/* Date filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Requested Date</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={requestedDate}
              onChange={e => setRequestedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {requestedDate && (
              <button onClick={() => setRequestedDate('')} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium">Disbursement Date</p>
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={disbursedDate}
              onChange={e => setDisbursedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {disbursedDate && (
              <button onClick={() => setDisbursedDate('')} className="text-xs text-gray-400 hover:text-gray-600 underline">
                Clear
              </button>
            )}
          </div>
        </div>

        {(requestedDate || disbursedDate) && (
          <p className="text-xs text-gray-500 self-end pb-2">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400 text-sm">
          No loan requests{requestedDate || disbursedDate ? ' for the selected filter' : ' yet'}
        </div>
      )}

      {/* Mobile cards */}
      {filtered.length > 0 && (
        <>
          <div className="sm:hidden space-y-3">
            {filtered.map(r => (
              <div key={r.request_id} className="bg-white rounded-xl border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.customer_name ?? r.new_customer_name ?? '—'}</p>
                    {r.customer_code && <p className="text-xs text-gray-400">{r.customer_code}</p>}
                    {!r.customer_id && r.new_customer_phone && (
                      <p className="text-xs text-gray-400">{r.new_customer_phone}{r.new_customer_area ? ` · ${r.new_customer_area}` : ''}</p>
                    )}
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', STATUS_STYLE[r.status])}>
                    {r.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Loan Amount</span>
                    <span className="font-medium">{fmt(r.loan_amount)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Outstanding</span>
                    <span className={r.customer_id ? 'font-medium text-orange-600' : 'text-gray-400'}>
                      {r.customer_id && r.outstanding_total ? fmt(r.outstanding_total) : '—'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Requested: {fmtDate(r.created_at)}</span>
                  <span>Disburse: {fmtDate(r.disbursement_date)}</span>
                </div>
                {r.customer_id && (
                  <Link href={`/customers/${r.customer_id}`} className="text-xs text-blue-600 hover:underline">
                    View customer →
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Customer', 'Loan Amount', 'Outstanding', 'Requested', 'Disburse', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(r => (
                  <tr key={r.request_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.customer_name ?? r.new_customer_name ?? '—'}</p>
                      {r.customer_code && <p className="text-xs text-gray-400">{r.customer_code}</p>}
                      {!r.customer_id && r.new_customer_phone && (
                        <p className="text-xs text-gray-400">{r.new_customer_phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">{fmt(r.loan_amount)}</td>
                    <td className="px-4 py-3">
                      {r.customer_id && r.outstanding_total
                        ? <span className="font-medium text-orange-600">{fmt(r.outstanding_total)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(r.disbursement_date)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_STYLE[r.status])}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.customer_id && (
                        <Link href={`/customers/${r.customer_id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
