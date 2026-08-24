'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Pencil } from 'lucide-react'

interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: string
  employee_code: string | null
  department: string | null
  designation: string | null
  branch_id: string | null
  joining_date: string | null
  last_login_at: string | null
}

interface Branch { id: string; name: string }

const roleBadge: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  COLLECTION_AGENT: 'bg-blue-100 text-blue-700',
  STAFF: 'bg-gray-100 text-gray-700',
}

export function ProfileClient({ profile: initial, branch }: { profile: Profile; branch: Branch | null }) {
  const [profile, setProfile] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initial.full_name)
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Change password state
  const [current, setCurrent] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')

  async function saveProfile() {
    setSaving(true)
    setMsg('')
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, phone }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProfile(prev => ({ ...prev, full_name: updated.full_name, phone: updated.phone }))
      setMsg('Profile updated')
      setEditing(false)
    } else {
      setMsg('Failed to update')
    }
    setSaving(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw !== confirmPw) { setPwErr('Passwords do not match'); return }
    if (newPw.length < 8) { setPwErr('Password must be at least 8 characters'); return }
    setPwLoading(true)
    setPwErr('')
    setPwMsg('')
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: current, new_password: newPw }),
    })
    const data = await res.json()
    if (res.ok) {
      setPwMsg('Password changed successfully')
      setCurrent(''); setNewPw(''); setConfirmPw('')
    } else {
      setPwErr(data.error ?? 'Failed to update password')
    }
    setPwLoading(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">My Profile</h1>

      {/* Profile info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Personal Information</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={14} className="mr-1" /> Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {msg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{msg}</p>}
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Full Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={saveProfile} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); setName(profile.full_name); setPhone(profile.phone ?? '') }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Name</span><p className="font-medium mt-0.5">{profile.full_name}</p></div>
              <div><span className="text-gray-500">Email</span><p className="font-medium mt-0.5">{profile.email}</p></div>
              <div><span className="text-gray-500">Phone</span><p className="font-medium mt-0.5">{profile.phone ?? '—'}</p></div>
              <div><span className="text-gray-500">Role</span>
                <p className="mt-0.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleBadge[profile.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {profile.role}
                  </span>
                </p>
              </div>
              <div><span className="text-gray-500">Employee Code</span><p className="font-medium mt-0.5">{profile.employee_code ?? '—'}</p></div>
              <div><span className="text-gray-500">Department</span><p className="font-medium mt-0.5">{profile.department ?? '—'}</p></div>
              <div><span className="text-gray-500">Designation</span><p className="font-medium mt-0.5">{profile.designation ?? '—'}</p></div>
              <div><span className="text-gray-500">Branch</span><p className="font-medium mt-0.5">{branch?.name ?? '—'}</p></div>
              <div><span className="text-gray-500">Joining Date</span><p className="font-medium mt-0.5">{profile.joining_date ?? '—'}</p></div>
              <div><span className="text-gray-500">Last Login</span><p className="font-medium mt-0.5">{profile.last_login_at ? new Date(profile.last_login_at).toLocaleString() : '—'}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader><CardTitle className="text-base">Change Password</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-3 max-w-sm">
            {pwErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{pwErr}</p>}
            {pwMsg && <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">{pwMsg}</p>}
            <div className="space-y-1">
              <Label>Current Password</Label>
              <Input type="password" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password" />
            </div>
            <div className="space-y-1">
              <Label>New Password</Label>
              <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="space-y-1">
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" size="sm" disabled={pwLoading}>
              {pwLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</> : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
