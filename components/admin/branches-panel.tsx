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

export function BranchesPanel({ initialBranches }: Props) {
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [adding, setAdding] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

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
                <div key={branch.id} className="flex items-center justify-between py-3">
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
            <Button type="submit" disabled={adding}>
              {adding ? 'Adding...' : 'Add Branch'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
