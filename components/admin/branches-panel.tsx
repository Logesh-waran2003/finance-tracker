'use client'

import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Loader2, MapPin, Navigation, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Bi } from '@/components/ui/bi'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataList, type DataListColumn } from '@/components/ui/data-list'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { GMapsLink } from '@/components/ui/gmaps-link'
import { Input } from '@/components/ui/input'
import { LocationDeniedDialog } from '@/components/ui/location-denied-dialog'
import { StatusBadge } from '@/components/ui/status-badge'
import { apiPatch, apiPost } from '@/lib/api-client'
import { t } from '@/lib/i18n'

interface Branch {
  id: string
  name: string
  code: string
  address?: string | null
  city?: string | null
  state?: string | null
  phone?: string | null
  email?: string | null
  is_active?: boolean | null
  office_lat?: string | null
  office_lng?: string | null
}

interface EditForm {
  name: string
  code: string
  address: string
  city: string
  state: string
  phone: string
  email: string
  office_lat: string
  office_lng: string
}

const emptyEditForm: EditForm = {
  name: '',
  code: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  office_lat: '',
  office_lng: '',
}

const schema = z.object({
  name: z.string().min(1, t('requiredField').en),
  code: z.string().min(1, t('requiredField').en).max(10),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function BranchesPanel({ initialBranches }: { initialBranches: Branch[] }) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [gpsState, setGpsState] = useState<'idle' | 'acquiring' | 'done' | 'denied'>('idle')
  const [showLocationDenied, setShowLocationDenied] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onAdd(values: FormValues) {
    setAdding(true)
    const res = await apiPost<Branch>('/api/admin/branches', values)
    // Every failure path re-enables the button.
    setAdding(false)
    if (!res.ok) return
    setBranches(prev => [...prev, res.data])
    reset()
    toast.success(t('branchCreated').en)
  }

  async function setActive(branch: Branch, next: boolean) {
    setTogglingId(branch.id)
    const res = await apiPatch<Branch>(`/api/admin/branches/${branch.id}`, { is_active: next })
    setTogglingId(null)
    // Failure: the row stays exactly as it was.
    if (!res.ok) return
    setBranches(prev => prev.map(b => (b.id === branch.id ? res.data : b)))
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch)
    setEditError(null)
    setGpsState('idle')
    setEditForm({
      name: branch.name ?? '',
      code: branch.code ?? '',
      address: branch.address ?? '',
      city: branch.city ?? '',
      state: branch.state ?? '',
      phone: branch.phone ?? '',
      email: branch.email ?? '',
      office_lat: branch.office_lat ?? '',
      office_lng: branch.office_lng ?? '',
    })
  }

  const captureCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error(t('geolocationUnsupported').en)
      return
    }
    setGpsState('acquiring')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setEditForm(f => ({
          ...f,
          office_lat: String(pos.coords.latitude),
          office_lng: String(pos.coords.longitude),
        }))
        setGpsState('done')
        toast.success(t('locationCaptured').en)
      },
      () => {
        setGpsState('denied')
        setShowLocationDenied(true)
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }, [])

  async function saveEdit() {
    const target = editingBranch
    if (!target) return
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setEditError(t('allFieldsRequired').en)
      return
    }
    setEditSaving(true)
    setEditError(null)
    const res = await apiPatch<Branch>(`/api/admin/branches/${target.id}`, {
      name: editForm.name,
      code: editForm.code,
      address: editForm.address || null,
      city: editForm.city || null,
      state: editForm.state || null,
      phone: editForm.phone || null,
      email: editForm.email || null,
      office_lat: editForm.office_lat ? Number(editForm.office_lat) : null,
      office_lng: editForm.office_lng ? Number(editForm.office_lng) : null,
    })
    setEditSaving(false)
    // Failure: the dialog stays open with everything the admin typed.
    if (!res.ok) {
      setEditError(res.error)
      return
    }
    setBranches(prev => prev.map(b => (b.id === target.id ? res.data : b)))
    setEditingBranch(null)
    toast.success(t('branchUpdated').en)
  }

  function rowActions(branch: Branch, layout: 'card' | 'row') {
    const size = layout === 'card' ? 'default' : 'sm'
    const busy = togglingId === branch.id
    return (
      <div className={layout === 'card' ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
        <Button variant="outline" size={size} onClick={() => openEdit(branch)}>
          <Pencil />
          <Bi k="edit" />
        </Button>
        <Button
          variant={branch.is_active ? 'destructive' : 'success'}
          size={size}
          disabled={busy}
          onClick={() => setActive(branch, !branch.is_active)}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          <Bi k={branch.is_active ? 'deactivate' : 'activate'} />
        </Button>
      </div>
    )
  }

  const columns: DataListColumn<Branch>[] = [
    {
      key: 'name',
      header: <Bi k="branchName" />,
      primary: true,
      cell: b => <span className="font-medium">{b.name}</span>,
    },
    {
      key: 'code',
      header: <Bi k="branchCode" />,
      cell: b => <span className="font-mono text-xs text-muted-foreground">{b.code}</span>,
    },
    {
      key: 'city',
      header: <Bi k="city" />,
      cell: b => (
        <span className="text-muted-foreground">
          {[b.city, b.state].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'gps',
      header: <Bi k="officeLocation" />,
      hideOnMobile: true,
      cell: b =>
        b.office_lat && b.office_lng ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <MapPin aria-hidden="true" className="size-3.5" />
            <Bi k="officeGpsSet" />
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: <Bi k="status" />,
      cell: b => <StatusBadge status={b.is_active ? 'ACTIVE' : 'INACTIVE'} />,
    },
    {
      key: 'actions',
      header: <Bi k="actions" />,
      align: 'right',
      hideOnMobile: true,
      cell: b => rowActions(b, 'row'),
    },
  ]

  const renderCard = (b: Branch) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{b.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{b.code}</p>
        </div>
        <StatusBadge status={b.is_active ? 'ACTIVE' : 'INACTIVE'} />
      </div>
      <p className="text-sm text-muted-foreground">
        {[b.address, b.city, b.state].filter(Boolean).join(', ') || '—'}
      </p>
      {b.office_lat && b.office_lng ? (
        <span className="inline-flex w-fit items-center gap-1 text-xs text-success">
          <MapPin aria-hidden="true" className="size-3.5" />
          <Bi k="officeGpsSet" />
        </span>
      ) : null}
      <GMapsLink query={[b.name, b.address, b.city, b.state].filter(Boolean).join(', ')} />
      {rowActions(b, 'card')}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">
          <Bi k="allBranches" />
        </h2>
        <DataList
          items={branches}
          getKey={b => b.id}
          columns={columns}
          renderCard={renderCard}
          empty={<EmptyState titleKey="noBranchesYet" />}
        />
      </section>

      {/* Add a branch */}
      <Card className="md:max-w-lg">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit(onAdd)} className="flex flex-col gap-4">
            <h2 className="text-base font-semibold">
              <Bi k="newBranch" />
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                labelKey="branchName"
                htmlFor="branch-name"
                required
                error={errors.name?.message ?? null}
              >
                <Input id="branch-name" {...register('name')} />
              </FormField>
              <FormField
                labelKey="branchCode"
                htmlFor="branch-code"
                required
                error={errors.code?.message ?? null}
              >
                <Input id="branch-code" placeholder="HQ" {...register('code')} />
              </FormField>
            </div>

            <FormField labelKey="address" htmlFor="branch-address">
              <Input id="branch-address" {...register('address')} />
            </FormField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="city" htmlFor="branch-city">
                <Input id="branch-city" {...register('city')} />
              </FormField>
              <FormField labelKey="state" htmlFor="branch-state">
                <Input id="branch-state" {...register('state')} />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="phone" htmlFor="branch-phone">
                <Input id="branch-phone" type="tel" {...register('phone')} />
              </FormField>
              <FormField labelKey="email" htmlFor="branch-email">
                <Input id="branch-email" type="email" {...register('email')} />
              </FormField>
            </div>

            <Button type="submit" size="lg" disabled={adding} className="md:self-start">
              {adding ? <Loader2 className="animate-spin" /> : <Plus />}
              <Bi k="addBranch" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog
        open={!!editingBranch}
        onOpenChange={open => {
          if (!open && !editSaving) setEditingBranch(null)
        }}
      >
        <DialogContent className="md:max-w-lg">
          <DialogTitle>
            <Bi k="editBranch" />
          </DialogTitle>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="branchName" htmlFor="edit-branch-name" required error={editError}>
                <Input
                  id="edit-branch-name"
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="branchCode" htmlFor="edit-branch-code" required>
                <Input
                  id="edit-branch-code"
                  value={editForm.code}
                  onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField
              labelKey="address"
              htmlFor="edit-branch-address"
              hint={
                <GMapsLink
                  query={[editForm.address, editForm.city, editForm.state]
                    .filter(Boolean)
                    .join(', ')}
                />
              }
            >
              <Input
                id="edit-branch-address"
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="city" htmlFor="edit-branch-city">
                <Input
                  id="edit-branch-city"
                  value={editForm.city}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="state" htmlFor="edit-branch-state">
                <Input
                  id="edit-branch-state"
                  value={editForm.state}
                  onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField labelKey="phone" htmlFor="edit-branch-phone">
                <Input
                  id="edit-branch-phone"
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </FormField>
              <FormField labelKey="email" htmlFor="edit-branch-email">
                <Input
                  id="edit-branch-email"
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </FormField>
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <h3 className="text-sm font-medium">
                <Bi k="officeLocation" />
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={captureCurrentLocation}
                disabled={gpsState === 'acquiring'}
              >
                {gpsState === 'acquiring' ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Navigation />
                )}
                <Bi k={gpsState === 'acquiring' ? 'gpsAcquiring' : 'useMyCurrentLocation'} />
              </Button>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormField labelKey="latitude" htmlFor="edit-branch-lat">
                  <Input
                    id="edit-branch-lat"
                    inputMode="decimal"
                    value={editForm.office_lat}
                    onChange={e => setEditForm(f => ({ ...f, office_lat: e.target.value }))}
                  />
                </FormField>
                <FormField labelKey="longitude" htmlFor="edit-branch-lng">
                  <Input
                    id="edit-branch-lng"
                    inputMode="decimal"
                    value={editForm.office_lng}
                    onChange={e => setEditForm(f => ({ ...f, office_lng: e.target.value }))}
                  />
                </FormField>
              </div>

              {editForm.office_lat && editForm.office_lng ? (
                <GMapsLink query={`${editForm.office_lat},${editForm.office_lng}`} />
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button size="lg" className="md:flex-1" disabled={editSaving} onClick={saveEdit}>
              {editSaving ? <Loader2 className="animate-spin" /> : null}
              <Bi k="saveChanges" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="md:flex-1"
              disabled={editSaving}
              onClick={() => setEditingBranch(null)}
            >
              <Bi k="cancel" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <LocationDeniedDialog
        open={showLocationDenied}
        onClose={() => setShowLocationDenied(false)}
      />
    </div>
  )
}
