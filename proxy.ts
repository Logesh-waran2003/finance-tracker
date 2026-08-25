import { auth } from '@/auth'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export async function proxy(request: NextRequest) {
  const session = await auth()
  const pathname = request.nextUrl.pathname

  // NextAuth's own handlers are always public
  if (pathname.startsWith('/api/auth')) return NextResponse.next()

  // All other /api/* routes return 401 when unauthenticated
  if (pathname.startsWith('/api/')) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.next()
  }

  const publicPaths = ['/login', '/forgot-password', '/reset-password']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (session && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|js)$).*)',
  ],
}
