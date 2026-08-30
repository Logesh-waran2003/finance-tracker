'use client'

import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Pencil, Loader2, MapPin, Navigation } from 'lucide-react'
import { GMapsLink } from '@/components/ui/gmaps-link'

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

interface Props {
  initialBranches: Branch[]
}

const schema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required').max(10),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const emptyEditForm: EditForm = {
  name: '', code: '', address: '', city: '', state: '', phone: '', email: '',
  office_lat: '', office_lng: '',
}

export function BranchesPanel({ initialBranches }: Props) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm)
  const [gpsState, setGpsState] = useState<'idle' | 'acquiring' | 'done' | 'denied'>('idle')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onAdd(values: FormValues) {
    setAdding(true)
    try {
      const res = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setBranches(prev => [...prev, data])
      reset()
      toast.success('Branch created')
    } catch {
      toast.error('Network error')
    } finally {
      setAdding(false)
    }
  }

  async function toggleActive(branch: Branch) {
    setTogglingId(branch.id)
    try {
      const res = await fetch(`/api/admin/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !branch.is_active }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setBranches(prev => prev.map(b => b.id === branch.id ? data : b))
    } catch {
      toast.error('Network error')
    } finally {
      setTogglingId(null)
    }
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch)
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
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return }
    setGpsState('acquiring')
    navigator.geolocation.getCurrentPosition(
      pos => {
        setEditForm(f => ({
          ...f,
          office_lat: String(pos.coords.latitude),
          office_lng: String(pos.coords.longitude),
        }))
        setGpsState('done')
        toast.success(`Location captured — ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`)
      },
      () => {
        setGpsState('denied')
        toast.error('Location access is off. Enable it in your browser: Settings → Privacy & Security → Location → Allow', {
          duration: 6000,
        })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    )
  }, [])

  async function saveEdit() {
    if (!editingBranch) return
    if (!editForm.name.trim() || !editForm.code.trim()) {
      toast.error('Name and code are required')
      return
    }
    setEditSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        code: editForm.code,
        address: editForm.address || null,
        city: editForm.city || null,
        state: editForm.state || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        office_lat: editForm.office_lat ? parseFloat(editForm.office_lat) : null,
        office_lng: editForm.office_lng ? parseFloat(editForm.office_lng) : null,
      }
      const res = await fetch(`/api/admin/branches/${editingBranch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setBranches(prev => prev.map(b => b.id === editingBranch.id ? data : b))
      toast.success('Branch updated')
      setEditingBranch(null)
    } catch {
      toast.error('Network error')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Branches</CardTitle>
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <p className="text-sm text-gray-500">No branches yet.</p>
          ) : (
            <div className="divide-y">
              {branches.map(branch => (
                <div key={branch.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{branch.name}</span>
                        <span className="text-xs text-gray-400 font-mono">{branch.code}</span>
                      </div>
                      {(branch.city || branch.state) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[branch.city, branch.state].filter(Boolean).join(', ')}
                        </p>
                      )}
                      {branch.address && (
                        <p className="text-xs text-gray-400">{branch.address}</p>
                      )}
                      {branch.office_lat && branch.office_lng && (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                          <MapPin size={10} /> Office GPS set
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={branch.is_active ? 'secondary' : 'outline'}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(branch)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={togglingId === branch.id}
                        onClick={() => toggleActive(branch)}
                        className="text-xs h-7"
                      >
                        {branch.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                  <GMapsLink
                    query={[branch.name, branch.address, branch.city, branch.state].filter(Boolean).join(', ')}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingBranch} onOpenChange={open => { if (!open) setEditingBranch(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogTitle className="font-semibold">Edit Branch</DialogTitle>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Branch Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Code *</Label>
                <Input
                  value={editForm.code}
                  onChange={e => setEditForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
              />
              <GMapsLink query={[editForm.address, editForm.city, editForm.state].filter(Boolean).join(', ')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  value={editForm.state}
                  onChange={e => setEditForm(f => ({ ...f, state: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            {/* Office Location */}
            <div className="space-y-2 pt-1 border-t">
              <div className="flex items-center justify-between">
                <Label>Office Location (GPS)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={captureCurrentLocation}
                  disabled={gpsState === 'acquiring'}
                >
                  {gpsState === 'acquiring'
                    ? <><Loader2 size={11} className="animate-spin" /> Getting location...</>
                    : <><Navigation size={11} /> Use my current location</>}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Latitude</Label>
                  <Input
                    value={editForm.office_lat}
                    onChange={e => setEditForm(f => ({ ...f, office_lat: e.target.value }))}
                    placeholder="e.g. 13.0827"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-500">Longitude</Label>
                  <Input
                    value={editForm.office_lng}
                    onChange={e => setEditForm(f => ({ ...f, office_lng: e.target.value }))}
                    placeholder="e.g. 80.2707"
                  />
                </div>
              </div>
              {editForm.office_lat && editForm.office_lng && (
                <a
                  href={`https://maps.google.com/?q=${editForm.office_lat},${editForm.office_lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  <MapPin size={11} /> Preview office on map
                </a>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={saveEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={() => setEditingBranch(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Separator />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Add New Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onAdd)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Branch Name</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" placeholder="HQ" {...register('code')} />
                {errors.code && <p className="text-xs text-red-500">{errors.code.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" {...register('city')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input id="state" {...register('state')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="bp_phone">Phone</Label>
                <Input id="bp_phone" type="tel" {...register('phone')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bp_email">Email</Label>
                <Input id="bp_email" type="email" {...register('email')} />
              </div>
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? 'Adding...' : 'Add Branch'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
