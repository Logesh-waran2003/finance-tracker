'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus } from 'lucide-react'

interface Settings {
  id: string
  company_name: string
  currency: string
  currency_symbol: string
  timezone: string
  financial_year_start: number
}

interface Branch {
  id: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  is_active: boolean | null
}

interface Props {
  settings: Settings | null
  branches: Branch[]
}

export function SettingsClient({ settings: initial, branches: initialBranches }: Props) {
  const [settings, setSettings] = useState<Partial<Settings>>(initial ?? {})
  const [branches, setBranches] = useState<Branch[]>(initialBranches)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [newBranch, setNewBranch] = useState({ name: '', code: '', city: '', state: '', address: '', phone: '', email: '' })
  const [addingBranch, setAddingBranch] = useState(false)

  async function saveSettings() {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    if (res.ok) setMsg('Settings saved')
    else setMsg('Failed to save')
    setSaving(false)
  }

  async function addBranch() {
    if (!newBranch.name || !newBranch.code) return
    setAddingBranch(true)
    const res = await fetch('/api/admin/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBranch),
    })
    if (res.ok) {
      const b = await res.json()
      setBranches(prev => [...prev, b])
      setNewBranch({ name: '', code: '', city: '', state: '', address: '', phone: '', email: '' })
      setShowAddBranch(false)
    }
    setAddingBranch(false)
  }

  async function toggleBranch(id: string, current: boolean) {
    const res = await fetch(`/api/admin/branches/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !current }),
    })
    if (res.ok) {
      setBranches(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>

        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Company Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{msg}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Company Name</Label>
                  <Input value={settings.company_name ?? ''} onChange={e => setSettings(s => ({ ...s, company_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Currency Code</Label>
                  <Input value={settings.currency ?? ''} onChange={e => setSettings(s => ({ ...s, currency: e.target.value }))} placeholder="INR" />
                </div>
                <div className="space-y-1">
                  <Label>Currency Symbol</Label>
                  <Input value={settings.currency_symbol ?? ''} onChange={e => setSettings(s => ({ ...s, currency_symbol: e.target.value }))} placeholder="₹" />
                </div>
                <div className="space-y-1">
                  <Label>Timezone</Label>
                  <Input value={settings.timezone ?? ''} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))} placeholder="Asia/Kolkata" />
                </div>
                <div className="space-y-1">
                  <Label>Financial Year Start (month)</Label>
                  <Input type="number" min={1} max={12} value={settings.financial_year_start ?? 4} onChange={e => setSettings(s => ({ ...s, financial_year_start: parseInt(e.target.value) }))} />
                </div>
              </div>
              <Button onClick={saveSettings} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Settings'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Branches</CardTitle>
              <Button size="sm" onClick={() => setShowAddBranch(v => !v)}>
                <Plus size={16} className="mr-1" /> Add Branch
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddBranch && (
                <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
                  <p className="text-sm font-medium">New Branch</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Name *</Label><Input value={newBranch.name} onChange={e => setNewBranch(b => ({ ...b, name: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Code *</Label><Input value={newBranch.code} onChange={e => setNewBranch(b => ({ ...b, code: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>City</Label><Input value={newBranch.city} onChange={e => setNewBranch(b => ({ ...b, city: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>State</Label><Input value={newBranch.state} onChange={e => setNewBranch(b => ({ ...b, state: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Phone</Label><Input value={newBranch.phone} onChange={e => setNewBranch(b => ({ ...b, phone: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Email</Label><Input value={newBranch.email} onChange={e => setNewBranch(b => ({ ...b, email: e.target.value }))} /></div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addBranch} disabled={addingBranch || !newBranch.name || !newBranch.code}>
                      {addingBranch ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddBranch(false)}>Cancel</Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {branches.length === 0 && <p className="text-sm text-gray-500">No branches yet.</p>}
                {branches.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{b.name} <span className="text-gray-400 text-xs">({b.code})</span></p>
                      {b.city && <p className="text-xs text-gray-500">{b.city}{b.state ? `, ${b.state}` : ''}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={b.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => toggleBranch(b.id, b.is_active ?? true)}>
                        {b.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
