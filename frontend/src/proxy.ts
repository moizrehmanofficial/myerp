import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The platform admin sign-in lives at a private address set on Vercel:
//   ADMIN_LOGIN_PATH=/something-only-you-know
// The page itself is /admin-signin, which cannot be opened directly when a
// private address is set. This hides the admin sign-in from the public site;
// it is not a replacement for a strong password (and 2-step sign-in later).
const INTERNAL = '/admin-signin'

function adminPath() {
  const p = (process.env.ADMIN_LOGIN_PATH || '').trim()
  if (!p || p === '/' || !/^\/[A-Za-z0-9/_-]+$/.test(p)) return INTERNAL
  return p.replace(/\/+$/, '')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const secret = adminPath()

  if (pathname === secret && secret !== INTERNAL) {
    return NextResponse.rewrite(new URL(INTERNAL, request.url))
  }
  if (secret !== INTERNAL && (pathname === INTERNAL || pathname.startsWith(`${INTERNAL}/`))) {
    return new NextResponse('Not found', { status: 404 })
  }
  // Old addresses
  if (pathname === '/login') {
    return NextResponse.redirect(new URL('/signin', request.url), 308)
  }
  return NextResponse.next()
}

export const config = {
  // Pages only (not scripts, styles, images or files)
  matcher: ['/((?!_next/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}
