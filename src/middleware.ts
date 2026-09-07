import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { authConfig } from '@/lib/auth.config'

// Use the Edge-safe auth config here (no bcrypt/Prisma), since
// middleware runs on the Edge runtime and cannot bundle Node-only
// dependencies pulled in by src/lib/auth.ts.
const { auth } = NextAuth(authConfig)

// Behind a reverse proxy (Railway), req.nextUrl carries the container's own
// host/port (0.0.0.0:8080), not the public one. Rebuild redirects from the
// forwarded headers so users land on the real domain.
function redirectTo(path: string, req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return NextResponse.redirect(new URL(path, req.nextUrl))
  const proto = req.headers.get('x-forwarded-proto') ?? req.nextUrl.protocol.replace(':', '')
  return NextResponse.redirect(new URL(path, `${proto}://${host}`))
}

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isLoginPage = req.nextUrl.pathname === '/login'
  const isApiRoute = req.nextUrl.pathname.startsWith('/api/')

  if (!isLoggedIn && isApiRoute) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isLoggedIn && !isLoginPage) {
    return redirectTo('/login', req)
  }
  if (isLoggedIn && isLoginPage) {
    return redirectTo('/map', req)
  }
})

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|logo\\.png|logo-white\\.png).*)'],
}
