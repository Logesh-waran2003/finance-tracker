import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  // Clear next-auth session cookies
  cookieStore.delete('next-auth.session-token')
  cookieStore.delete('__Secure-next-auth.session-token')
  return NextResponse.json({ ok: true })
}
