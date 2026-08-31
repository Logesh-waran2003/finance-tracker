'use client'

import { Banknote, HandCoins, Phone, PhoneOff, ReceiptText } from 'lucide-react'

import { PageHeader } from '@/components/ui/page-header'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from '@/components/ui/stat-tile'
import { StatusBadge } from '@/components/ui/status-badge'
import { Money } from '@/components/ui/money'
import { Bi } from '@/components/ui/bi'
import { EditDueDialog } from '@/components/customers/edit-due-dialog'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, formatPercent, toNumber } from '@/lib/format'
import { statusLabel, t } from '@/lib/i18n'

export interface CustomerSummary {
  id: string
  full_name: string
  customer_code: string
  phone: string | null
  email: string | null
  area: string | null
  city: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  gps_lat: string | null
  gps_lng: string | null
}

export interface DueRow {
  id: string
  invoice_number: string | null
  amount: string
  outstanding_amount: string
  due_date: string | null
  penalty_rate: string | null
  status: string
  notes: string | null
}

export interface CollectionRow {
  id: string
  collection_number: string | null
  amount: string
  payment_mode: string
  status: string
  collected_at: string | null
}

export interface LoanRow {
  id: string
  loan_number: string
  loan_amount: string
  total_outstanding: string
  daily_installment: string
  status: string
  disbursement_date: string | null
}

interface Props {
  customer: CustomerSummary
  agentName: string | null
  totalOutstanding: string
  duesOutstanding: string
  collectedTotal: string
  activeLoanCount: number
  dues: DueRow[]
  collections: CollectionRow[]
  loans: LoanRow[]
  isAdmin: boolean
}

function Section({ titleKey, children }: { titleKey: Parameters<typeof Bi>[0]['k']; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        <Bi k={titleKey} />
      </h2>
      {children}
    </section>
  )
}

function InfoRow({ labelKey, value }: { labelKey: Parameters<typeof Bi>[0]['k']; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <dt className="shrink-0 text-muted-foreground">
        <Bi k={labelKey} />
      </dt>
      <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
    </div>
  )
}

export function CustomerDetailClient({
  customer,
  agentName,
  totalOutstanding,
  duesOutstanding,
  collectedTotal,
  activeLoanCount,
  dues,
  collections,
  loans,
  isAdmin,
}: Props) {
  const dueColumns: DataListColumn<DueRow>[] = [
    {
      key: 'invoice',
      header: <Bi k="invoiceNumber" />,
      primary: true,
      cell: d => <span className="font-medium">{d.invoice_number ?? t('none').en}</span>,
    },
    {
      key: 'dueDate',
      header: <Bi k="dueDate" />,
      cell: d => <span className="text-muted-foreground">{formatDate(d.due_date)}</span>,
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      cell: d => <Money value={d.amount} size="row" />,
    },
    {
      key: 'penalty',
      header: <Bi k="penaltyRate" />,
      cell: d =>
        toNumber(d.penalty_rate) > 0 ? (
          <span className="tabular">{formatPercent(d.penalty_rate)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: d => <StatusBadge status={d.status} />,
    },
    {
      key: 'outstanding',
      header: <Bi k="outstanding" />,
      align: 'right',
      cell: d => <Money value={d.outstanding_amount} size="row" intent="owed" />,
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: d =>
        isAdmin ? (
          <EditDueDialog
            due={{
              id: d.id,
              invoice_number: d.invoice_number,
              due_date: d.due_date,
              penalty_rate: d.penalty_rate,
              notes: d.notes,
            }}
          />
        ) : null,
    },
  ]

  const collectionColumns: DataListColumn<CollectionRow>[] = [
    {
      key: 'number',
      header: <Bi k="collectionNumber" />,
      primary: true,
      cell: c => <span className="font-medium">{c.collection_number ?? t('none').en}</span>,
    },
    {
      key: 'when',
      header: <Bi k="date" />,
      cell: c => <span className="text-muted-foreground">{formatDateTime(c.collected_at)}</span>,
    },
    {
      key: 'mode',
      header: <Bi k="paymentMode" />,
      cell: c => <Bi label={statusLabel(c.payment_mode)} className="text-muted-foreground" />,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: c => <StatusBadge status={c.status} />,
    },
    {
      key: 'amount',
      header: <Bi k="amount" />,
      align: 'right',
      cell: c => <Money value={c.amount} size="row" intent="in" />,
    },
  ]

  const loanColumns: DataListColumn<LoanRow>[] = [
    {
      key: 'number',
      header: <Bi k="loanNumber" />,
      primary: true,
      cell: l => <span className="font-medium">{l.loan_number}</span>,
    },
    {
      key: 'loanAmount',
      header: <Bi k="loanAmount" />,
      cell: l => <Money value={l.loan_amount} size="row" />,
    },
    {
      key: 'daily',
      header: <Bi k="dailyInstallment" />,
      cell: l => <Money value={l.daily_installment} size="row" />,
    },
    {
      key: 'disbursed',
      header: <Bi k="disbursedOn" />,
      cell: l => <span className="text-muted-foreground">{formatDate(l.disbursement_date)}</span>,
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: l => <StatusBadge status={l.status} />,
    },
    {
      key: 'outstanding',
      header: <Bi k="outstanding" />,
      align: 'right',
      cell: l => <Money value={l.total_outstanding} size="row" intent="owed" />,
    },
  ]

  const area = [customer.area, customer.city].filter(Boolean).join(', ')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titleKey="customer" back backHref="/customers" />

      {/* Hero — who, and how much they owe. */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl leading-tight font-bold">{customer.full_name}</h1>
            <p className="text-sm text-muted-foreground">{customer.customer_code}</p>
          </div>
          <StatusBadge status={customer.is_active ? 'ACTIVE' : 'INACTIVE'} />
        </div>

        <div>
          <Bi k="totalOutstanding" className="text-sm text-muted-foreground" />
          <div className="mt-1">
            <Money value={totalOutstanding} size="hero" intent="owed" />
          </div>
        </div>

        {/* Tap to call — an agent outside a locked gate needs the phone. */}
        {customer.phone ? (
          <a
            href={`tel:${customer.phone}`}
            className={cn(
              'flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition',
              'active:scale-[0.99] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
            )}
          >
            <Phone aria-hidden="true" className="size-5" />
            <Bi k="callCustomer" />
            <span className="tabular">{customer.phone}</span>
          </a>
        ) : (
          <p className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
            <PhoneOff aria-hidden="true" className="size-4" />
            <Bi k="noPhoneNumber" />
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-2">
        <StatTile labelKey="totalDues" value={duesOutstanding} intent="warning" compact />
        <StatTile labelKey="collected" value={collectedTotal} intent="success" compact />
        <StatTile
          labelKey="activeLoans"
          value={activeLoanCount}
          kind="count"
          intent="info"
          compact
        />
      </div>

      {/* Contact details */}
      <section className="rounded-xl border border-border bg-card px-4 py-1 text-card-foreground">
        <dl className="divide-y divide-border">
          <InfoRow labelKey="area" value={area || t('none').en} />
          <InfoRow labelKey="address" value={customer.address ?? t('none').en} />
          <InfoRow labelKey="assignedAgent" value={agentName ?? t('unassigned').en} />
          {customer.gps_lat && customer.gps_lng ? (
            <InfoRow labelKey="gpsCoordinates" value={`${customer.gps_lat}, ${customer.gps_lng}`} />
          ) : null}
          {customer.notes ? <InfoRow labelKey="notes" value={customer.notes} /> : null}
        </dl>
      </section>

      <Section titleKey="loans">
        <DataList
          items={loans}
          getKey={l => l.id}
          columns={loanColumns}
          empty={<EmptyState icon={Banknote} titleKey="noLoans" />}
        />
      </Section>

      <Section titleKey="dues">
        <DataList
          items={dues}
          getKey={d => d.id}
          columns={dueColumns}
          renderCard={d => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.invoice_number ?? t('none').en}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(d.due_date)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Money value={d.outstanding_amount} size="row" intent="owed" />
                  <p className="text-xs text-muted-foreground">
                    <Bi k="outstanding" />
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={d.status} />
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Bi k="amount" />
                    <Money value={d.amount} size="caption" />
                  </span>
                  {isAdmin ? (
                    <EditDueDialog
                      due={{
                        id: d.id,
                        invoice_number: d.invoice_number,
                        due_date: d.due_date,
                        penalty_rate: d.penalty_rate,
                        notes: d.notes,
                      }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          )}
          empty={<EmptyState icon={ReceiptText} titleKey="noDues" />}
        />
      </Section>

      <Section titleKey="collectionHistory">
        <DataList
          items={collections}
          getKey={c => c.id}
          columns={collectionColumns}
          empty={<EmptyState icon={HandCoins} titleKey="noCollectionsYet" />}
        />
      </Section>
    </div>
  )
}
