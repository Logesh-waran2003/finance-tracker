'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { Money } from '@/components/ui/money'
import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { formatCount, formatDate, toNumber } from '@/lib/format'
import { t } from '@/lib/i18n'

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

/** The date the agent picked in the filter is an IST calendar date. */
function toIstDate(s: string | null): string {
  if (!s) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(s))
}

function displayName(r: LoanRequestCustomer): string {
  return r.customer_name ?? r.new_customer_name ?? t('customer').en
}

export default function AgentCustomersClient({ initial }: Props) {
  const router = useRouter()
  const [requestedDate, setRequestedDate] = useState('')
  const [disbursedDate, setDisbursedDate] = useState('')

  const filtered = initial
    .filter(r => {
      if (requestedDate && toIstDate(r.created_at) !== requestedDate) return false
      if (disbursedDate && r.disbursement_date !== disbursedDate) return false
      return true
    })
    // Outstanding is the whole point of this screen: the agent visits the
    // biggest arrear first, so that is the default order.
    .sort((a, b) => toNumber(b.outstanding_total) - toNumber(a.outstanding_total))

  const filtering = Boolean(requestedDate || disbursedDate)

  const columns: DataListColumn<LoanRequestCustomer>[] = [
    {
      key: 'customer',
      header: <Bi k="customer" />,
      primary: true,
      cell: r => (
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName(r)}</p>
          {r.customer_code ? (
            <p className="text-xs text-muted-foreground">{r.customer_code}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <Bi k="newCustomerNotCreated" />
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'loanAmount',
      header: <Bi k="loanAmount" />,
      cell: r => <Money value={r.loan_amount} size="row" intent="neutral" />,
    },
    {
      key: 'requested',
      header: <Bi k="requestedOn" />,
      cell: r => <span className="text-muted-foreground">{formatDate(r.created_at)}</span>,
    },
    {
      key: 'disburse',
      header: <Bi k="disburseOn" />,
      cell: r => <span className="text-muted-foreground">{formatDate(r.disbursement_date)}</span>,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: r => <StatusBadge status={r.status} />,
    },
    {
      key: 'outstanding',
      header: <Bi k="outstanding" />,
      align: 'right',
      cell: r =>
        r.customer_id ? (
          // `owed`, never `in`/`auto`: an arrear rendered green reads as good news.
          <Money value={r.outstanding_total ?? '0'} size="row" intent="owed" />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
  ]

  const renderCard = (r: LoanRequestCustomer) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{displayName(r)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.customer_code ?? r.new_customer_phone ?? t('newCustomerNotCreated').en}
          </p>
        </div>
        <div className="shrink-0 text-right">
          {r.customer_id ? (
            <Money value={r.outstanding_total ?? '0'} size="row" intent="owed" />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          <p className="text-xs text-muted-foreground">
            <Bi k="outstanding" />
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={r.status} />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bi k="loanAmount" />
          <Money value={r.loan_amount} size="caption" />
        </span>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        titleKey="myCustomers"
        subtitle={
          <span className="flex items-center gap-1">
            <span className="tabular">{formatCount(initial.length)}</span>
            <Bi k="loanRequestsCount" />
            <span aria-hidden="true">·</span>
            <Bi k="highestOutstandingFirst" />
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField labelKey="requestedDate" htmlFor="filter-requested">
          <Input
            id="filter-requested"
            type="date"
            value={requestedDate}
            onChange={e => setRequestedDate(e.target.value)}
          />
        </FormField>
        <FormField labelKey="disbursementDate" htmlFor="filter-disbursed">
          <Input
            id="filter-disbursed"
            type="date"
            value={disbursedDate}
            onChange={e => setDisbursedDate(e.target.value)}
          />
        </FormField>
      </div>

      {filtering ? (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <span className="tabular">{formatCount(filtered.length)}</span>
            <Bi k="results" />
          </span>
          <Button
            variant="outline"
            onClick={() => {
              setRequestedDate('')
              setDisbursedDate('')
            }}
          >
            <Bi k="clear" />
          </Button>
        </div>
      ) : null}

      <DataList
        items={filtered}
        getKey={r => r.request_id}
        columns={columns}
        renderCard={renderCard}
        onRowClick={r => {
          if (r.customer_id) router.push(`/customers/${r.customer_id}`)
        }}
        empty={
          <EmptyState
            icon={Users}
            titleKey={filtering ? 'noResultsForFilter' : 'noLoanRequestsYet'}
            descriptionKey={filtering ? undefined : 'noCustomersAssigned'}
          />
        }
      />
    </div>
  )
}
