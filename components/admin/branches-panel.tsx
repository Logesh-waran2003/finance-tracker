'use client'

import { useState } from 'react'
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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { MapPin } from 'lucide-react'

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
  office_lat: z.string().optional(),
  office_lng: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function BranchesPanel({ initialBranches }: Props) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [locationBranch, setLocationBranch] = useState<Branch | null>(null)
  const [locForm, setLocForm] = useState({ lat: '', lng: '' })
  const [savingLocation, setSavingLocation] = useState(false)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onAdd(values: FormValues) {
    setAdding(true)
    try {
      const body: Record<string, unknown> = {
        name: values.name,
        code: values.code,
        city: values.city || undefined,
        state: values.state || undefined,
        phone: values.phone || undefined,
        email: values.email || undefined,
        address: values.address || undefined,
      }
      if (values.office_lat && values.office_lng) {
        body.office_lat = parseFloat(values.office_lat)
        body.office_lng = parseFloat(values.office_lng)
      }
      const res = await fetch('/api/admin/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  function openLocationDialog(branch: Branch) {
    setLocationBranch(branch)
    setLocForm({
      lat: branch.office_lat ?? '',
      lng: branch.office_lng ?? '',
    })
  }

  async function saveLocation() {
    if (!locationBranch) return
    const lat = parseFloat(locForm.lat)
    const lng = parseFloat(locForm.lng)
    if (isNaN(lat) || isNaN(lng)) { toast.error('Enter valid lat/lng numbers'); return }
    if (lat < -90 || lat > 90) { toast.error('Latitude must be between -90 and 90'); return }
    if (lng < -180 || lng > 180) { toast.error('Longitude must be between -180 and 180'); return }
    setSavingLocation(true)
    try {
      const res = await fetch(`/api/admin/branches/${locationBranch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_lat: lat, office_lng: lng }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setBranches(prev => prev.map(b => b.id === locationBranch.id ? data : b))
      toast.success('Office location saved')
      setLocationBranch(null)
    } catch {
      toast.error('Network error')
    } finally {
      setSavingLocation(false)
    }
  }

  async function clearLocation(branch: Branch) {
    try {
      const res = await fetch(`/api/admin/branches/${branch.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ office_lat: null, office_lng: null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      setBranches(prev => prev.map(b => b.id === branch.id ? data : b))
      toast.success('Location cleared')
    } catch {
      toast.error('Network error')
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
                <div key={branch.id} className="py-3 space-y-2">
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
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={branch.is_active ? 'secondary' : 'outline'}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
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

                  {/* Office location row */}
                  <div className="flex items-center gap-3 text-xs">
                    {branch.office_lat && branch.office_lng ? (
                      <>
                        <span className="text-gray-500 flex items-center gap-1">
                          <MapPin size={11} className="text-green-500" />
                          Office: {parseFloat(branch.office_lat).toFixed(5)}, {parseFloat(branch.office_lng).toFixed(5)}
                        </span>
                        <a
                          href={`https://maps.google.com/?q=${branch.office_lat},${branch.office_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View map
                        </a>
                        <button
                          onClick={() => openLocationDialog(branch)}
                          className="text-gray-500 hover:text-gray-700 underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => clearLocation(branch)}
                          className="text-red-400 hover:text-red-600 underline"
                        >
                          Clear
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => openLocationDialog(branch)}
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <MapPin size={11} />
                        Set office location
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Office Location (optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="office_lat">Latitude</Label>
                  <Input id="office_lat" type="number" step="any" placeholder="e.g. 13.0827" {...register('office_lat')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="office_lng">Longitude</Label>
                  <Input id="office_lng" type="number" step="any" placeholder="e.g. 80.2707" {...register('office_lng')} />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={adding}>
              {adding ? 'Adding...' : 'Add Branch'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Set Location Dialog */}
      <Dialog open={!!locationBranch} onOpenChange={open => { if (!open) setLocationBranch(null) }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm rounded-xl">
          <DialogTitle>Office Location — {locationBranch?.name}</DialogTitle>
          <DialogDescription className="text-sm">
            Enter the GPS coordinates of the office. You can get these from Google Maps by right-clicking the location.
          </DialogDescription>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 13.0827"
                value={locForm.lat}
                onChange={e => setLocForm(f => ({ ...f, lat: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 80.2707"
                value={locForm.lng}
                onChange={e => setLocForm(f => ({ ...f, lng: e.target.value }))}
              />
            </div>
            {locForm.lat && locForm.lng && !isNaN(parseFloat(locForm.lat)) && !isNaN(parseFloat(locForm.lng)) && (
              <a
                href={`https://maps.google.com/?q=${locForm.lat},${locForm.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
              >
                <MapPin size={11} /> Preview on map
              </a>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={saveLocation} disabled={savingLocation}>
              {savingLocation ? 'Saving...' : 'Save Location'}
            </Button>
            <Button variant="outline" onClick={() => setLocationBranch(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
